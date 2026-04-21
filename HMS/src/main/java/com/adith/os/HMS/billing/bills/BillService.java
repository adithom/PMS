package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.*;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.storage.R2StorageService;
import com.adith.os.HMS.storage.R2UploadException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class BillService {

    private static final Logger log = LoggerFactory.getLogger(BillService.class);

    private final FolioRepository folioRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final BillRepository billRepository;
    private final PropertyInvoiceSequenceRepository sequenceRepository;
    private final ChargeMapper chargeMapper;
    private final PdfGenerationService pdfGenerationService;
    private final R2StorageService r2StorageService;

    public BillService(FolioRepository folioRepository,
                       FolioChargeRepository folioChargeRepository,
                       BillRepository billRepository,
                       PropertyInvoiceSequenceRepository sequenceRepository,
                       ChargeMapper chargeMapper,
                       PdfGenerationService pdfGenerationService,
                       R2StorageService r2StorageService) {
        this.folioRepository = folioRepository;
        this.folioChargeRepository = folioChargeRepository;
        this.billRepository = billRepository;
        this.sequenceRepository = sequenceRepository;
        this.chargeMapper = chargeMapper;
        this.pdfGenerationService = pdfGenerationService;
        this.r2StorageService = r2StorageService;
    }

    @Transactional
    public MultiBillDto generateMultiBill(UUID folioId, String guestGstNumber) {

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        long activeBills = billRepository.countByFolioIdAndIsVoidedFalse(folioId);
        if (activeBills > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Active bills already exist for this folio. Void them before generating new ones.");
        }

        UUID batchId = UUID.randomUUID();

        List<FolioCharge> unbilledCharges = folio.getCharges().stream()
                .filter(c -> c.getBill() == null && c.getGroupBill() == null)
                .toList();

        if (unbilledCharges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No unbilled charges available to generate a bill.");
        }

        Property property = folio.getProperty();
        String baseInvoiceNumber = generateInvoiceNumber(property);

        List<BillDto> generatedBills = new ArrayList<>();
        int suffixIdx = 0;

        for (BillType bt : BillType.values()) {
            List<FolioCharge> charges = unbilledCharges.stream()
                    .filter(c -> BillType.forChargeCode(c.getChargeCode()) == bt)
                    .toList();
            if (charges.isEmpty()) continue;

            String invoiceNumber = suffixIdx == 0
                    ? baseInvoiceNumber
                    : baseInvoiceNumber + (char) ('a' + suffixIdx - 1);
            suffixIdx++;

            Bill bill = createAndSaveBill(folio, charges, bt, invoiceNumber, guestGstNumber, batchId);

            List<ChargeDto> chargeDtos = chargeMapper.toDtos(charges);
            BillDto dtoForPdf = BillMapper.toBillDto(bill, folio, chargeDtos, guestGstNumber);
            String localPath = pdfGenerationService.generateInvoicePdf(dtoForPdf);
            String objectKey = "invoices/" + bill.getInvoiceNumber() + ".pdf";
            String signedUrl = uploadToR2WithFallback(localPath, objectKey, "INV_" + bill.getInvoiceNumber() + ".pdf");
            bill.setPdfFilePath(objectKey);
            billRepository.save(bill);
            generatedBills.add(BillMapper.toBillDto(bill, folio, chargeDtos, guestGstNumber, signedUrl));
        }

        return new MultiBillDto(generatedBills);
    }

    public List<BillDto> getBillsForFolio(UUID folioId) {
        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));
        return billRepository.findByFolioId(folioId).stream()
                .map(bill -> BillMapper.toBillDto(bill, folio, chargeMapper.toDtos(
                        folioChargeRepository.findByBillId(bill.getId())), bill.getGuestGstNumber()))
                .toList();
    }

    public String generateDownloadUrl(UUID billId) {
        Bill bill = billRepository.findById(billId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found"));
        if (bill.getPdfFilePath() == null || bill.getPdfFilePath().isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No PDF available for this bill");
        }
        String fileName = "INV_" + bill.getInvoiceNumber() + ".pdf";
        return r2StorageService.generatePresignedDownloadUrl(bill.getPdfFilePath(), fileName);
    }

    @Transactional
    public BillDto voidBill(UUID billId, String reason, String username) {
        Bill bill = billRepository.findById(billId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found"));

        if (bill.isVoided()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bill is already voided");
        }

        bill.setVoided(true);
        bill.setVoidReason(reason);
        bill.setVoidedAt(LocalDateTime.now());
        bill.setVoidedBy(username);

        List<FolioCharge> charges = folioChargeRepository.findByBillId(billId);
        for (FolioCharge charge : charges) {
            charge.setBill(null);
        }
        folioChargeRepository.saveAll(charges);

        Bill savedBill = billRepository.save(bill);

        Folio folio = savedBill.getFolio();
        folio.recalculateTotals();
        folioRepository.save(folio);

        return BillMapper.toBillDto(savedBill, folio, chargeMapper.toDtos(charges), savedBill.getGuestGstNumber());
    }

    @Transactional
    public List<BillDto> voidActiveBillsForFolio(UUID folioId, String reason, String username) {
        List<Bill> activeBills = billRepository.findByFolioIdAndIsVoidedFalse(folioId);

        if (activeBills.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active bills found for this folio.");
        }

        return activeBills.stream()
                .map(bill -> voidBill(bill.getId(), reason, username))
                .toList();
    }

    @Transactional(readOnly = true)
    public BillBatchPageDto getLedger(OffsetDateTime from, OffsetDateTime to, boolean includeVoided) {
        List<Bill> bills = includeVoided
                ? billRepository.findAllBillsInRange(from, to)
                : billRepository.findActiveBillsInRange(from, to);

        // Group by generationBatchId; bills without a batch ID get their own singleton group
        Map<UUID, List<Bill>> grouped = bills.stream()
                .collect(Collectors.groupingBy(b ->
                        b.getGenerationBatchId() != null ? b.getGenerationBatchId() : b.getId()));

        List<BillBatchRowDto> batchRows = grouped.values().stream()
                .map(BillMapper::toBatchRowDto)
                .sorted(Comparator.comparing(BillBatchRowDto::billDate).reversed()
                        .thenComparing(BillBatchRowDto::mainInvoiceNumber))
                .toList();

        BigDecimal grandTotalSum = batchRows.stream()
                .map(BillBatchRowDto::grandTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new BillBatchPageDto(batchRows, batchRows.size(), grandTotalSum);
    }

    public void downloadBillsAsZip(List<UUID> billIds, OutputStream out) throws IOException {
        List<Bill> bills = billRepository.findActiveByIds(billIds);

        // Group bills into batches; the folder name is the lexicographically smallest invoice
        // number in each batch (the base number without a suffix letter).
        Map<UUID, List<Bill>> byBatch = bills.stream()
                .collect(Collectors.groupingBy(b ->
                        b.getGenerationBatchId() != null ? b.getGenerationBatchId() : b.getId()));

        try (ZipOutputStream zip = new ZipOutputStream(new BufferedOutputStream(out))) {
            for (List<Bill> batch : byBatch.values()) {
                String folderName = batch.stream()
                        .map(Bill::getInvoiceNumber)
                        .min(Comparator.naturalOrder())
                        .orElse("UNKNOWN");

                for (Bill bill : batch) {
                    if (bill.getPdfFilePath() == null || bill.getPdfFilePath().isBlank()) {
                        log.warn("Bill {} has no pdfFilePath, skipping from ZIP", bill.getId());
                        continue;
                    }
                    byte[] pdf = r2StorageService.downloadObjectAsBytes(bill.getPdfFilePath());
                    String entryName = folderName + "/INV_" + bill.getInvoiceNumber() + ".pdf";
                    ZipEntry entry = new ZipEntry(entryName);
                    entry.setSize(pdf.length);
                    zip.putNextEntry(entry);
                    zip.write(pdf);
                    zip.closeEntry();
                }
            }
        }
    }

    private Bill createAndSaveBill(Folio folio, List<FolioCharge> charges, BillType billType,
                                   String invoiceNumber, String gstNumber, UUID batchId) {
        Bill bill = new Bill();
        bill.setFolio(folio);
        bill.setGenerationBatchId(batchId);
        bill.setBillType(billType);
        bill.setInvoiceNumber(invoiceNumber);
        bill.setGuestGstNumber(gstNumber);

        List<FolioCharge> activeCharges = charges.stream().filter(c -> !c.isVoided()).toList();
        BigDecimal subtotal = activeCharges.stream().map(FolioCharge::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax      = activeCharges.stream().map(FolioCharge::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = activeCharges.stream().map(FolioCharge::getDiscountAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total    = activeCharges.stream().map(FolioCharge::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        bill.setSubtotal(subtotal);
        bill.setTaxAmount(tax);
        bill.setDiscountAmount(discount);
        bill.setTotalAmount(total);

        Bill savedBill = billRepository.save(bill);

        for (FolioCharge charge : charges) {
            charge.setBill(savedBill);
        }
        folioChargeRepository.saveAll(charges);

        return savedBill;
    }

    private String uploadToR2WithFallback(String localPath, String objectKey, String fileName) {
        if (!r2StorageService.isConfigured()) {
            return null;
        }
        try {
            r2StorageService.uploadPdf(Path.of(localPath), objectKey);
            return r2StorageService.generatePresignedDownloadUrl(objectKey, fileName);
        } catch (R2UploadException e) {
            log.error("R2 upload failed for key={}. PDF is saved locally at {}.", objectKey, localPath, e);
            return null;
        }
    }

    private String generateInvoiceNumber(Property property) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        PropertyInvoiceSequence sequence = sequenceRepository
                .findByPropertyAndDateWithLock(property.getId(), today)
                .orElse(new PropertyInvoiceSequence(property, today, 1));

        int current = sequence.getNextVal();
        sequence.setNextVal(current + 1);
        sequenceRepository.save(sequence);

        return property.getCode().toUpperCase()
                + today.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"))
                + String.format("%04d", current);
    }
}
