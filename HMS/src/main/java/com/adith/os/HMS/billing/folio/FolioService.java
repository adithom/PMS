package com.adith.os.HMS.billing.folio;


import com.adith.os.HMS.billing.bills.BillRepository;
import com.adith.os.HMS.billing.bills.BillType;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.folio.dto.ChargeUpdateDto;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioDetailDto;
import com.adith.os.HMS.billing.folio.dto.FolioDiscountDto;
import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.billing.payment.PaymentRepository;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class FolioService {

    private final FolioRepository folioRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final PropertyRepository propertyRepository;
    private final GuestRepository guestRepository;
    private final BookingRepository bookingRepository;
    private final FolioMapper folioMapper;
    private final PaymentRepository paymentRepository;
    private final BillRepository billRepository;

    private static final Set<BillType> CUMULATIVE_BILL_TYPES =
            Set.of(BillType.ROOM_RENT, BillType.ANCILLARY);

    public FolioService(
            FolioRepository folioRepository,
            FolioChargeRepository folioChargeRepository,
            PropertyRepository propertyRepository,
            GuestRepository guestRepository,
            BookingRepository bookingRepository,
            FolioMapper folioMapper,
            PaymentRepository paymentRepository,
            BillRepository billRepository) {
        this.folioRepository = folioRepository;
        this.folioChargeRepository = folioChargeRepository;
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
        this.bookingRepository = bookingRepository;
        this.folioMapper = folioMapper;
        this.paymentRepository = paymentRepository;
        this.billRepository = billRepository;
    }

    /**
     * Recompute folio totals end-to-end:
     *  1. Charge-side math (folio.recalculateTotals()) — sums non-voided charges.
     *  2. paidAmount — sum of completed payments for this folio's booking, queried via
     *     PaymentRepository.sumCompletedByBookingId. Reservation-level payments are NOT
     *     included here (they appear on the master bill, not a booking folio).
     *  3. balanceDue — settleable charges (own non-routed) minus paidAmount.
     *  Saves and returns the folio.
     */
    @Transactional
    public Folio recomputeFolioTotals(Folio folio) {
        folio.recalculateTotals();

        // Apply folio-level discounts on top of per-charge discounts
        BigDecimal roomDisc = FolioDiscountCalculator.computeRoomDiscountAmount(folio);
        BigDecimal ancDisc  = FolioDiscountCalculator.computeAncillaryDiscountAmount(folio);
        BigDecimal folioDiscount = roomDisc.add(ancDisc);
        if (folioDiscount.compareTo(BigDecimal.ZERO) > 0) {
            folio.setDiscountAmount(folio.getDiscountAmount().add(folioDiscount));
            folio.setTotalAmount(folio.getTotalAmount().subtract(folioDiscount).max(BigDecimal.ZERO));
        }

        BigDecimal paid = folio.getBooking() != null
                ? paymentRepository.sumCompletedByBookingId(folio.getBooking().getId())
                : BigDecimal.ZERO;
        if (paid == null) paid = BigDecimal.ZERO;
        BigDecimal balance = folio.getSettleableTotal().subtract(folioDiscount).subtract(paid).max(BigDecimal.ZERO);
        folio.setPaidAmount(paid);
        folio.setBalanceDue(balance);
        return folioRepository.save(folio);
    }

    /**
     * Create a new folio
     */
    @Transactional
    public FolioDto createFolio(UUID propertyId, @Valid FolioCreationDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio creation data is required");
        }

        // Validate property
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        // Validate guest
        Guest guest = guestRepository.findById(dto.guestId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found"));

        // Validate booking if provided
        Booking booking = null;
        if (dto.bookingId() != null) {
            booking = bookingRepository.findById(dto.bookingId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

            if (!booking.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Booking does not belong to the specified property");
            }
        }

        try {
            Folio folio = folioMapper.toEntity(dto, property, guest, booking);
            folio.setFolioNumber(generateFolioNumber(property));
            folio.setCreatedBy(dto.createdBy() != null ? dto.createdBy() : "SYSTEM");

            Folio savedFolio = folioRepository.save(folio);
            return folioMapper.toDto(savedFolio);
        } catch (ResponseStatusException e) {
            throw e;  // let 4xx errors pass through untouched
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create folio: " + e.getMessage());
        }

    }

    /**
     * Get folio by ID
     */
    public FolioDto getFolioById(UUID propertyId, UUID folioId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        return folioMapper.toDto(folio);
    }

    /**
     * Get folio with full details (includes charges and payments)
     */
    public FolioDetailDto getFolioDetails(UUID propertyId, UUID folioId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        return folioMapper.toDetailDto(folio);
    }

    /**
     * Get folio by booking ID
     */
    public FolioDto getFolioByBooking(UUID propertyId, UUID bookingId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        // Each booking has exactly one folio
        Folio folio = folioRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Folio not found for booking"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        return folioMapper.toDto(folio);
    }

    /**
     * Get all folios for a booking (including split folios)
     */
    public List<FolioDto> getAllFoliosByBooking(UUID propertyId, UUID bookingId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        List<Folio> folios = folioRepository.findAllByBookingId(bookingId);

        // Verify all folios belong to the property
        boolean allBelongToProperty = folios.stream()
                .allMatch(f -> f.getProperty().getId().equals(propertyId));

        if (!allBelongToProperty) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Some folios do not belong to the specified property");
        }

        return folioMapper.toDtoList(folios);
    }

    /**
     * Get all open folios for a property
     */
    public List<FolioDto> getOpenFolios(UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        List<Folio> folios = folioRepository.findByPropertyAndStatus(propertyId, FolioStatus.OPEN);
        return folioMapper.toDtoList(folios);
    }

    /**
     * Add charge to folio
     */
    @Transactional
    public FolioDto addCharge(UUID propertyId, UUID folioId, @Valid ChargeCreationDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Charge data is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        if (folio.getStatus() != FolioStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot add charges to a closed or posted folio");
        }

        try {
            FolioCharge charge = new FolioCharge();
            charge.setFolio(folio);
            LocalDate chargeDate = dto.chargeDate() != null ? dto.chargeDate() : LocalDate.now();
            if (chargeDate.isAfter(LocalDate.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Charge date cannot be in the future");
            }
            charge.setChargeDate(chargeDate);
            charge.setChargeCode(dto.chargeCode());
            charge.setDescription(dto.description());
            charge.setUnitPrice(dto.unitPrice());
            charge.setQuantity(dto.quantity() != null ? dto.quantity() : BigDecimal.ONE);
            BigDecimal taxRate;
            if (dto.taxRate() != null) {
                taxRate = dto.taxRate();
            } else if (dto.chargeCode() == ChargeCode.ROOM_RENT) {
                taxRate = ChargeCode.computeRoomRentTaxRate(dto.unitPrice());
            } else {
                taxRate = dto.chargeCode().getDefaultTaxRate();
            }
            charge.setTaxRate(taxRate);
            charge.setDiscountRate(dto.discountRate() != null ? dto.discountRate() : BigDecimal.ZERO);
            charge.setReferenceType(dto.referenceType());
            charge.setReferenceId(dto.referenceId());
            charge.setNotes(dto.notes());
            charge.setPostedBy(dto.postedBy() != null ? dto.postedBy() : "SYSTEM");

            boolean routeToMaster;
            if (dto.routeToMaster() != null) {
                routeToMaster = dto.routeToMaster();
            } else if (folio.getBooking() != null && folio.getBooking().getReservation() != null) {
                routeToMaster = folio.getBooking().getReservation().isDefaultRouteToMaster();
            } else {
                routeToMaster = false;
            }
            charge.setRouteToMaster(routeToMaster);

            folioChargeRepository.save(charge);

            if (folio.getCharges() != null) {
                folio.getCharges().add(charge);
            }

            // Recompute totals (charge-side math + paidAmount via PaymentRepository)
            Folio savedFolio = recomputeFolioTotals(folio);

            return folioMapper.toDto(savedFolio);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to add charge: " + e.getMessage());
        }
    }

    /**
     * Edit mutable fields on an existing charge.
     *
     * Editable charges: anything without referenceType "POS_TICKET" (room rent, meal plan,
     * extra bed, and manually posted charges all qualify). POS ticket charges are excluded.
     *
     * Blocked when: charge is voided, folio is not OPEN, or the folio has any active
     * (non-voided) ROOM_RENT or ANCILLARY bill — void the bill first.
     *
     * Night audit safety: the audit deduplicates by existence (existsByFolio…AndChargeDate…).
     * Editing a charge does not void it, so the existence check still finds it and night audit
     * will not re-post the same date.
     */
    @Transactional
    public FolioDto updateCharge(UUID propertyId, UUID folioId, UUID chargeId, @Valid ChargeUpdateDto dto) {
        if (propertyId == null || folioId == null || chargeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Property, folio, and charge IDs are required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));
        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }
        if (folio.getStatus() != FolioStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot edit charges on a closed or posted folio");
        }

        FolioCharge charge = folioChargeRepository.findById(chargeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Charge not found"));
        if (!charge.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Charge does not belong to the specified folio");
        }
        if (charge.isVoided()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot edit a voided charge");
        }
        if ("POS_TICKET".equals(charge.getReferenceType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "POS ticket charges cannot be edited directly");
        }

        if (billRepository.existsByFolioIdAndBillTypeInAndIsVoidedFalse(folioId, CUMULATIVE_BILL_TYPES)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot edit charges while a Main or Ancillary bill is active. Void the bill first.");
        }

        charge.setDescription(dto.description());
        charge.setUnitPrice(dto.unitPrice());
        charge.setQuantity(dto.quantity());
        charge.setTaxRate(dto.taxRate());
        folioChargeRepository.save(charge);

        Folio savedFolio = recomputeFolioTotals(folio);
        return folioMapper.toDto(savedFolio);
    }

    /**
     * Phase B: flip a charge's routeToMaster flag.
     *
     * Lock granularity is the folio: if the folio has any *active* (non-voided) bill, charges in it
     * are immutable. Voiding a bill clears that lock — charges that were once on a now-voided bill
     * become editable (and re-routable) again. A voided charge itself is also locked.
     */
    @Transactional
    public FolioDto setChargeRoute(UUID propertyId, UUID folioId, UUID chargeId, boolean routeToMaster) {
        if (propertyId == null || folioId == null || chargeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property, folio, and charge IDs are required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));
        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        FolioCharge charge = folioChargeRepository.findById(chargeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Charge not found"));
        if (!charge.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Charge does not belong to the specified folio");
        }
        if (charge.isVoided()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reroute a voided charge");
        }

        boolean folioHasActiveBill = folio.getBills() != null
                && folio.getBills().stream().anyMatch(b -> !b.isVoided());
        if (folioHasActiveBill) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reroute charges on a folio with an active bill. Void the bill first.");
        }

        charge.setRouteToMaster(routeToMaster);
        folioChargeRepository.save(charge);

        Folio savedFolio = recomputeFolioTotals(folio);
        return folioMapper.toDto(savedFolio);
    }

    /**
     * Void a charge
     */
    @Transactional
    public FolioDto voidCharge(UUID propertyId, UUID folioId, UUID chargeId, String reason, String voidedBy) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }
        if (chargeId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Charge ID is required");
        }
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Void reason is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        FolioCharge charge = folioChargeRepository.findById(chargeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Charge not found"));

        if (!charge.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Charge does not belong to the specified folio");
        }

        if (folio.getStatus() != FolioStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot void charges on a closed or posted folio");
        }

        if (charge.getBill() != null || charge.getGroupBill() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot void a charge that has already been finalized on a bill/invoice");
        }

        try {
            charge.voidCharge(voidedBy != null ? voidedBy : "SYSTEM", reason);
            folioChargeRepository.save(charge);

            Folio savedFolio = recomputeFolioTotals(folio);
            return folioMapper.toDto(savedFolio);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to void charge: " + e.getMessage());
        }
    }

    /**
     * Close folio (prepare for payment)
     */
    @Transactional
    public FolioDto closeFolio(UUID propertyId, UUID folioId, String closedBy) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        try {
            folio.close();
            folio.setUpdatedBy(closedBy != null ? closedBy : "SYSTEM");
            Folio savedFolio = folioRepository.save(folio);

            return folioMapper.toDto(savedFolio);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to close folio: " + e.getMessage());
        }
    }

    /**
     * Post folio (after full payment)
     */
    @Transactional
    public FolioDto postFolio(UUID propertyId, UUID folioId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        try {
            folio.post();
            Folio savedFolio = folioRepository.save(folio);

            return folioMapper.toDto(savedFolio);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to post folio: " + e.getMessage());
        }
    }

    /**
     * Reopen folio (if needed for corrections)
     */
    @Transactional
    public FolioDto reopenFolio(UUID propertyId, UUID folioId, String reopenedBy) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        if (folio.getStatus() == FolioStatus.POSTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reopen a posted folio");
        }

        try {
            folio.setStatus(FolioStatus.OPEN);
            folio.setClosedAt(null);
            folio.setUpdatedBy(reopenedBy != null ? reopenedBy : "SYSTEM");

            Folio savedFolio = folioRepository.save(folio);

            return folioMapper.toDto(savedFolio);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to reopen folio: " + e.getMessage());
        }
    }

    /**
     * Generate unique folio number
     */
    private String generateFolioNumber(Property property) {
        String propertyCode = property.getCode();
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = folioRepository.count() + 1;

        String folioNumber;
        int attempts = 0;
        do {
            folioNumber = String.format("FO-%s-%s-%05d", propertyCode, date, count + attempts);
            attempts++;
        } while (folioRepository.existsByFolioNumber(folioNumber) && attempts < 100);

        if (attempts >= 100) {
            throw new RuntimeException("Failed to generate unique folio number after 100 attempts");
        }

        return folioNumber;
    }

    /**
     * Set or replace a folio-level discount for the given bill type ("room" or "ancillary").
     * Only allowed while the folio is OPEN.
     */
    @Transactional
    public FolioDto setDiscount(UUID propertyId, UUID folioId, String billType, @Valid FolioDiscountDto dto) {
        Folio folio = loadFolioForProperty(propertyId, folioId);
        if (folio.getStatus() != FolioStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Discounts can only be set on open folios");
        }
        if ("room".equalsIgnoreCase(billType)) {
            folio.setRoomDiscountType(dto.discountType());
            folio.setRoomDiscountValue(dto.value());
        } else if ("ancillary".equalsIgnoreCase(billType)) {
            folio.setAncillaryDiscountType(dto.discountType());
            folio.setAncillaryDiscountValue(dto.value());
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "billType must be 'room' or 'ancillary'");
        }
        Folio saved = recomputeFolioTotals(folio);
        return folioMapper.toDto(saved);
    }

    /**
     * Remove a folio-level discount for the given bill type ("room" or "ancillary").
     * Only allowed while the folio is OPEN.
     */
    @Transactional
    public FolioDto deleteDiscount(UUID propertyId, UUID folioId, String billType) {
        Folio folio = loadFolioForProperty(propertyId, folioId);
        if (folio.getStatus() != FolioStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Discounts can only be removed from open folios");
        }
        if ("room".equalsIgnoreCase(billType)) {
            folio.setRoomDiscountType(null);
            folio.setRoomDiscountValue(null);
        } else if ("ancillary".equalsIgnoreCase(billType)) {
            folio.setAncillaryDiscountType(null);
            folio.setAncillaryDiscountValue(null);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "billType must be 'room' or 'ancillary'");
        }
        Folio saved = recomputeFolioTotals(folio);
        return folioMapper.toDto(saved);
    }

    private Folio loadFolioForProperty(UUID propertyId, UUID folioId) {
        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));
        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }
        return folio;
    }

    /**
     * Close all OPEN folios for a booking at checkout time.
     */
    @Transactional
    public void closeOpenFoliosForBooking(UUID bookingId) {
        List<Folio> folios = folioRepository.findAllByBookingId(bookingId);
        for (Folio folio : folios) {
            if (folio.getStatus() == FolioStatus.OPEN) {
                folio.close();
                folioRepository.save(folio);
            }
        }
    }
}
