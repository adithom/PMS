package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.*;
import com.adith.os.HMS.storage.R2StorageService;
import com.adith.os.HMS.storage.R2UploadException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class BillService {

    private static final Logger log = LoggerFactory.getLogger(BillService.class);

    private final FolioRepository folioRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final BillRepository billRepository;
    private final InvoiceSequenceRepository sequenceRepository;
    private final ChargeMapper chargeMapper;
    private final PdfGenerationService pdfGenerationService;
    private final R2StorageService r2StorageService;

    public BillService(FolioRepository folioRepository,
                       FolioChargeRepository folioChargeRepository,
                       BillRepository billRepository,
                       InvoiceSequenceRepository sequenceRepository,
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
    public DoubleBillDto generateDoubleBill(UUID folioId, String guestGstNumber) {

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        // Prevent generating bills if active (non-voided) bills already exist
        long activeBills = billRepository.countByFolioIdAndIsVoidedFalse(folioId);
        if (activeBills > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Active bills already exist for this folio. Void them before generating new ones.");
        }

        // NEW: Generate ONE batch ID to link both bills together
        UUID batchId = UUID.randomUUID();

        // 1. Segregate the actual ENTITIES, ignoring voided ones AND charges already billed
        List<FolioCharge> unbilledValidCharges = folio.getCharges().stream()
                .filter(c -> !c.isVoided() && c.getBill() == null && c.getGroupBill() == null)
                .toList();

        if (unbilledValidCharges.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No unbilled charges available to generate a bill.");
        }

        List<FolioCharge> roomCharges = unbilledValidCharges.stream()
                .filter(c -> c.getChargeCode().getCategory() == ChargeCategory.ROOM_RENT
                          || c.getChargeCode().getCategory() == ChargeCategory.MEAL_PLAN)
                .toList();

        List<FolioCharge> ancillaryCharges = unbilledValidCharges.stream()
                .filter(c -> c.getChargeCode().getCategory() == ChargeCategory.ANCILLARY)
                .toList();

        // 2. Process and Save DB Entities
        Bill roomBill = createAndSaveBill(folio, roomCharges, ChargeCategory.ROOM_RENT, guestGstNumber, batchId);
        Bill ancillaryBill = createAndSaveBill(folio, ancillaryCharges, ChargeCategory.ANCILLARY, guestGstNumber, batchId);

        // 3. Map to DTOs, Generate PDFs, upload to R2
        BillDto roomBillDto = null;
        if (roomBill != null) {
            BillDto dtoForPdf = BillMapper.toBillDto(roomBill, folio, chargeMapper.toDtos(roomCharges), guestGstNumber);
            String localPath = pdfGenerationService.generateInvoicePdf(dtoForPdf);
            String objectKey = "invoices/" + roomBill.getInvoiceNumber() + ".pdf";
            String signedUrl = uploadToR2WithFallback(localPath, objectKey, "INV_" + roomBill.getInvoiceNumber() + ".pdf");
            roomBill.setPdfFilePath(objectKey);
            billRepository.save(roomBill);
            roomBillDto = BillMapper.toBillDto(roomBill, folio, chargeMapper.toDtos(roomCharges), guestGstNumber, signedUrl);
        }

        BillDto ancillaryBillDto = null;
        if (ancillaryBill != null) {
            BillDto dtoForPdf = BillMapper.toBillDto(ancillaryBill, folio, chargeMapper.toDtos(ancillaryCharges), guestGstNumber);
            String localPath = pdfGenerationService.generateInvoicePdf(dtoForPdf);
            String objectKey = "invoices/" + ancillaryBill.getInvoiceNumber() + ".pdf";
            String signedUrl = uploadToR2WithFallback(localPath, objectKey, "INV_" + ancillaryBill.getInvoiceNumber() + ".pdf");
            ancillaryBill.setPdfFilePath(objectKey);
            billRepository.save(ancillaryBill);
            ancillaryBillDto = BillMapper.toBillDto(ancillaryBill, folio, chargeMapper.toDtos(ancillaryCharges), guestGstNumber, signedUrl);
        }

        return new DoubleBillDto(roomBillDto, ancillaryBillDto);
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

        // Mark the bill as voided
        bill.setVoided(true);
        bill.setVoidReason(reason);
        bill.setVoidedAt(LocalDateTime.now());
        bill.setVoidedBy(username);

        // Release the charges back to the Folio so they can be re-billed
        List<FolioCharge> charges = folioChargeRepository.findByBillId(billId);
        for (FolioCharge charge : charges) {
            charge.setBill(null);
        }
        folioChargeRepository.saveAll(charges);

        Bill savedBill = billRepository.save(bill);

        // Recalculate folio totals to keep balance in sync
        Folio folio = savedBill.getFolio();
        folio.recalculateTotals();
        folioRepository.save(folio);

        // Map to DTO (passing empty charges since they are detached, or map the existing ones if preferred)
        return BillMapper.toBillDto(savedBill, folio, chargeMapper.toDtos(charges), savedBill.getGuestGstNumber());
    }

    @Transactional
    public List<BillDto> voidActiveBillsForFolio(UUID folioId, String reason, String username) {
        // Find all active (non-voided) bills for this folio
        List<Bill> activeBills = billRepository.findByFolioIdAndIsVoidedFalse(folioId);

        if (activeBills.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active bills found for this folio.");
        }

        // Void them all using your existing method!
        return activeBills.stream()
                .map(bill -> voidBill(bill.getId(), reason, username))
                .toList();
    }

    // Helper method updated to accept Batch ID
    private Bill createAndSaveBill(Folio folio, List<FolioCharge> charges, ChargeCategory category, String gstNumber, UUID batchId) {
        if (charges.isEmpty()) return null;

        Bill bill = new Bill();
        bill.setFolio(folio);
        bill.setGenerationBatchId(batchId); // STAMP BATCH ID
        bill.setCategory(category);
        bill.setInvoiceNumber(generateInvoiceNumber());
        bill.setGuestGstNumber(gstNumber);

        BigDecimal subtotal = charges.stream().map(FolioCharge::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = charges.stream().map(FolioCharge::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = charges.stream().map(FolioCharge::getDiscountAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = charges.stream().map(FolioCharge::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

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

    private String generateInvoiceNumber() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        InvoiceSequence sequence = sequenceRepository.findByIdWithLock(today)
                .orElse(new InvoiceSequence(today, 1));

        int currentSequenceNumber = sequence.getNextVal();
        sequence.setNextVal(currentSequenceNumber + 1);
        sequenceRepository.save(sequence);

        return String.format("%04d%02d%02d%04d",
                today.getYear(), today.getMonthValue(), today.getDayOfMonth(), currentSequenceNumber);
    }
}
