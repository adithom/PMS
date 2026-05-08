package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.GroupMultiBillDto;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.FolioChargeRepository;
import com.adith.os.HMS.billing.folio.FolioRepository;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.storage.R2StorageService;
import com.adith.os.HMS.storage.R2UploadException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class GroupBillGenerationService {

    private static final Logger log = LoggerFactory.getLogger(GroupBillGenerationService.class);

    private final BookingRepository bookingRepository;
    private final FolioRepository folioRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final PropertyRepository propertyRepository;
    private final GroupPdfGenerationService groupPdfGenerationService;
    private final GroupBillRepository groupBillRepository;
    private final PropertyInvoiceSequenceRepository sequenceRepository;
    private final R2StorageService r2StorageService;
    private final ObjectMapper objectMapper;

    public GroupBillGenerationService(
            BookingRepository bookingRepository,
            FolioRepository folioRepository,
            FolioChargeRepository folioChargeRepository,
            PropertyRepository propertyRepository,
            GroupPdfGenerationService groupPdfGenerationService,
            GroupBillRepository groupBillRepository,
            PropertyInvoiceSequenceRepository sequenceRepository,
            R2StorageService r2StorageService) {
        this.bookingRepository = bookingRepository;
        this.folioRepository = folioRepository;
        this.folioChargeRepository = folioChargeRepository;
        this.propertyRepository = propertyRepository;
        this.groupPdfGenerationService = groupPdfGenerationService;
        this.groupBillRepository = groupBillRepository;
        this.sequenceRepository = sequenceRepository;
        this.r2StorageService = r2StorageService;
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    // =========================================================================
    // GENERATE
    // =========================================================================

    @Transactional
    public GroupMultiBillDto generateGroupMultiBill(UUID propertyId,
                                                    UUID parentBookingId,
                                                    String guestGstNumber) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        Booking parent = bookingRepository.findById(parentBookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group booking not found"));

        if (!parent.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking does not belong to this property");
        }

        if (!parent.isGroupMaster()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking " + parentBookingId + " is not a group master");
        }

        long activeBills = groupBillRepository.countActiveByParentBookingId(parentBookingId);
        if (activeBills > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Active group bills already exist for this booking. Void them before generating new ones.");
        }

        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        if (children.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No child bookings found for this group");
        }

        // Accumulate per-BillType: charge entities to link, and per-room sections for PDF
        Map<BillType, List<FolioCharge>>                          chargesByType  = new EnumMap<>(BillType.class);
        Map<BillType, List<GroupMultiBillDto.RoomChargeSection>>  sectionsByType = new EnumMap<>(BillType.class);

        for (Booking child : children) {
            Folio folio = child.getMasterFolio();
            if (folio == null) continue;

            List<FolioCharge> validCharges = folio.getCharges() == null ? List.of()
                    : folio.getCharges().stream()
                           .filter(c -> !c.isVoided() && c.getBill() == null && c.getGroupBill() == null)
                           .filter(FolioCharge::isRouteToMaster)   // Phase B: master bill only includes charges flagged routeToMaster=true
                           .toList();

            // Group this child's charges by BillType
            Map<BillType, List<FolioCharge>> byType = new EnumMap<>(BillType.class);
            for (FolioCharge c : validCharges) {
                byType.computeIfAbsent(BillType.forChargeCode(c.getChargeCode()), k -> new ArrayList<>()).add(c);
            }

            for (Map.Entry<BillType, List<FolioCharge>> entry : byType.entrySet()) {
                BillType bt = entry.getKey();
                List<FolioCharge> charges = entry.getValue();
                chargesByType.computeIfAbsent(bt, k -> new ArrayList<>()).addAll(charges);
                sectionsByType.computeIfAbsent(bt, k -> new ArrayList<>())
                              .add(buildRoomSection(child, folio, charges));
            }
        }

        if (chargesByType.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No unbilled charges available to generate a group bill.");
        }

        UUID batchId = UUID.randomUUID();
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        OffsetDateTime now = OffsetDateTime.now();
        var property  = parent.getProperty();
        var organizer = parent.getGuest();
        String safeGst = guestGstNumber != null ? guestGstNumber : "";

        String baseInvoiceNumber = generateInvoiceNumber(property);

        List<GroupMultiBillDto.GroupBillSectionDto> generatedBills = new ArrayList<>();
        int suffixIdx = 0;

        for (BillType bt : BillType.values()) {
            List<FolioCharge> chargeEntities = chargesByType.get(bt);
            List<GroupMultiBillDto.RoomChargeSection> sections = sectionsByType.get(bt);
            if (chargeEntities == null || chargeEntities.isEmpty()) continue;

            String invoiceNumber = suffixIdx == 0
                    ? baseInvoiceNumber
                    : baseInvoiceNumber + (char) ('a' + suffixIdx - 1);
            suffixIdx++;

            SectionTotals totals = sumSections(sections);

            GroupMultiBillDto.GroupBillSectionDto sectionDto = new GroupMultiBillDto.GroupBillSectionDto(
                    invoiceNumber, today, bt.name(),
                    property.getName(), property.getAddress(), property.getGstNumber(),
                    parent.getId(), parent.getGroupReference(),
                    organizer.getFullName(), organizer.getPhone(), organizer.getEmail(), safeGst,
                    parent.getCheckIn(), parent.getCheckOut(), parent.getCurrency(), now,
                    sections,
                    totals.subtotal(), totals.tax(), totals.discount(), totals.total(),
                    BigDecimal.ZERO, totals.total(),
                    false, null, null, null, null);

            GroupBill billEntity = buildGroupBillEntity(parent, bt, invoiceNumber, safeGst, totals, batchId, sections);
            billEntity = groupBillRepository.save(billEntity);

            for (FolioCharge charge : chargeEntities) {
                charge.setGroupBill(billEntity);
            }
            folioChargeRepository.saveAll(chargeEntities);

            String localPath = groupPdfGenerationService.generateGroupBillPdf(sectionDto);
            String objectKey = "invoices/" + billEntity.getInvoiceNumber() + ".pdf";
            String signedUrl = uploadToR2WithFallback(localPath, objectKey,
                    "GRP_INV_" + billEntity.getInvoiceNumber() + ".pdf");
            billEntity.setPdfFilePath(objectKey);
            groupBillRepository.save(billEntity);
            generatedBills.add(sectionDto.withPdfDownloadUrl(signedUrl));
        }

        return new GroupMultiBillDto(generatedBills);
    }

    // =========================================================================
    // VOID
    // =========================================================================

    @Transactional
    public GroupBill voidGroupBill(UUID groupBillId, String reason, String voidedBy) {
        GroupBill bill = groupBillRepository.findById(groupBillId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group bill not found"));

        if (bill.isVoided()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Group bill is already voided");
        }

        bill.setVoided(true);
        bill.setVoidReason(reason);
        bill.setVoidedAt(LocalDateTime.now());
        bill.setVoidedBy(voidedBy);
        GroupBill savedBill = groupBillRepository.save(bill);

        List<FolioCharge> charges = folioChargeRepository.findByGroupBillId(groupBillId);
        for (FolioCharge charge : charges) {
            charge.setGroupBill(null);
        }
        folioChargeRepository.saveAll(charges);

        return savedBill;
    }

    @Transactional
    public List<GroupBill> voidAllActiveGroupBills(UUID parentBookingId, String reason, String voidedBy) {
        List<GroupBill> active = groupBillRepository.findActiveByParentBookingId(parentBookingId);
        if (active.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No active group bills found for this booking");
        }

        LocalDateTime now = LocalDateTime.now();
        for (GroupBill bill : active) {
            bill.setVoided(true);
            bill.setVoidReason(reason);
            bill.setVoidedAt(now);
            bill.setVoidedBy(voidedBy);

            List<FolioCharge> charges = folioChargeRepository.findByGroupBillId(bill.getId());
            for (FolioCharge charge : charges) {
                charge.setGroupBill(null);
            }
            folioChargeRepository.saveAll(charges);
        }
        return groupBillRepository.saveAll(active);
    }

    // =========================================================================
    // READ
    // =========================================================================

    public List<GroupBill> getGroupBills(UUID parentBookingId) {
        return groupBillRepository.findByParentBookingId(parentBookingId);
    }

    public String generateDownloadUrl(UUID groupBillId) {
        GroupBill bill = groupBillRepository.findById(groupBillId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group bill not found"));
        if (bill.getPdfFilePath() == null || bill.getPdfFilePath().isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No PDF available for this group bill");
        }
        String fileName = "GRP_INV_" + bill.getInvoiceNumber() + ".pdf";
        return r2StorageService.generatePresignedDownloadUrl(bill.getPdfFilePath(), fileName);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private String uploadToR2WithFallback(String localPath, String objectKey, String fileName) {
        if (!r2StorageService.isConfigured()) return null;
        try {
            r2StorageService.uploadPdf(Path.of(localPath), objectKey);
            return r2StorageService.generatePresignedDownloadUrl(objectKey, fileName);
        } catch (R2UploadException e) {
            log.error("R2 upload failed for key={}. PDF saved locally at {}.", objectKey, localPath, e);
            return null;
        }
    }

    private GroupBill buildGroupBillEntity(Booking parent,
                                           BillType billType,
                                           String invoiceNumber,
                                           String guestGstNumber,
                                           SectionTotals totals,
                                           UUID batchId,
                                           List<GroupMultiBillDto.RoomChargeSection> sections) {
        GroupBill entity = new GroupBill();
        entity.setParentBooking(parent);
        entity.setBillType(billType);
        entity.setInvoiceNumber(invoiceNumber);
        entity.setGuestGstNumber(guestGstNumber);
        entity.setGenerationBatchId(batchId);
        entity.setSubtotal(totals.subtotal());
        entity.setTaxAmount(totals.tax());
        entity.setDiscountAmount(totals.discount());
        entity.setTotalAmount(totals.total());
        entity.setRoomBreakdownJson(serializeBreakdown(sections));
        return entity;
    }

    private GroupMultiBillDto.RoomChargeSection buildRoomSection(
            Booking child, Folio folio, List<FolioCharge> charges) {

        List<ChargeDto> dtos = charges.stream().map(this::toChargeDto).toList();

        return new GroupMultiBillDto.RoomChargeSection(
                child.getId(),
                folio.getId(),
                folio.getFolioNumber(),
                child.getGuest().getFullName(),
                child.getRoom() != null ? child.getRoom().getNumber() : null,
                child.getUnit() != null ? child.getUnit().getName()   : null,
                dtos,
                sum(charges, FolioCharge::getSubtotal),
                sum(charges, FolioCharge::getTaxAmount),
                sum(charges, FolioCharge::getDiscountAmount),
                sum(charges, FolioCharge::getTotalAmount)
        );
    }

    private SectionTotals sumSections(List<GroupMultiBillDto.RoomChargeSection> sections) {
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal tax      = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal total    = BigDecimal.ZERO;
        for (var s : sections) {
            subtotal = subtotal.add(nvl(s.subtotal()));
            tax      = tax.add(nvl(s.taxAmount()));
            discount = discount.add(nvl(s.discountAmount()));
            total    = total.add(nvl(s.totalAmount()));
        }
        return new SectionTotals(subtotal, tax, discount, total);
    }

    private String serializeBreakdown(List<GroupMultiBillDto.RoomChargeSection> sections) {
        List<RoomBreakdownSnapshot> snapshots = sections.stream()
                .map(s -> new RoomBreakdownSnapshot(
                        s.childBookingId(), s.folioNumber(), s.guestName(),
                        s.roomNumber(), s.unitName(),
                        s.subtotal(), s.taxAmount(), s.discountAmount(), s.totalAmount()))
                .toList();
        try {
            return objectMapper.writeValueAsString(snapshots);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize room breakdown: {}", e.getMessage(), e);
            return "[]";
        }
    }

    @FunctionalInterface
    private interface ChargeExtractor { BigDecimal extract(FolioCharge c); }

    private BigDecimal sum(List<FolioCharge> charges, ChargeExtractor ex) {
        return charges.stream().map(ex::extract).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal nvl(BigDecimal v) { return v != null ? v : BigDecimal.ZERO; }

    private ChargeDto toChargeDto(FolioCharge c) {
        return new ChargeDto(
                c.getId(), c.getChargeDate(), c.getPostingDate(),
                c.getChargeCode(), c.getDescription(),
                c.getQuantity(), c.getUnitPrice(), c.getSubtotal(),
                c.getTaxRate(), c.getTaxAmount(), c.getDiscountAmount(),
                c.getTotalAmount(), c.isVoided(), c.getVoidReason(), c.getNotes()
        );
    }

    private String generateInvoiceNumber(com.adith.os.HMS.property.Property property) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        PropertyInvoiceSequence seq = sequenceRepository
                .findByPropertyAndDateWithLock(property.getId(), today)
                .orElse(new PropertyInvoiceSequence(property, today, 1));
        int current = seq.getNextVal();
        seq.setNextVal(current + 1);
        sequenceRepository.save(seq);
        return property.getCode().toUpperCase()
                + today.format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + String.format("%04d", current);
    }

    // =========================================================================
    // INNER TYPES
    // =========================================================================

    private record SectionTotals(
            BigDecimal subtotal, BigDecimal tax,
            BigDecimal discount, BigDecimal total) {}

    public record RoomBreakdownSnapshot(
            UUID childBookingId,
            String folioNumber,
            String guestName,
            String roomNumber,
            String unitName,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount) {}
}
