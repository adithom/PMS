package com.adith.os.HMS.billing.folio;


import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioDetailDto;
import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class FolioService {

    private final FolioRepository folioRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final PropertyRepository propertyRepository;
    private final GuestRepository guestRepository;
    private final BookingRepository bookingRepository;
    private final FolioMapper folioMapper;

    public FolioService(
            FolioRepository folioRepository,
            FolioChargeRepository folioChargeRepository,
            PropertyRepository propertyRepository,
            GuestRepository guestRepository,
            BookingRepository bookingRepository,
            FolioMapper folioMapper) {
        this.folioRepository = folioRepository;
        this.folioChargeRepository = folioChargeRepository;
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
        this.bookingRepository = bookingRepository;
        this.folioMapper = folioMapper;
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

        // Get master folio for booking
        Folio folio = folioRepository.findByBookingAndType(bookingId, FolioType.MASTER)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Master folio not found for booking"));

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
            charge.setChargeDate(dto.chargeDate() != null ? dto.chargeDate() : LocalDate.now());
            charge.setChargeCode(dto.chargeCode());
            charge.setDescription(dto.description());
            charge.setUnitPrice(dto.unitPrice());
            charge.setQuantity(dto.quantity() != null ? dto.quantity() : BigDecimal.ONE);
            charge.setTaxRate(dto.taxRate() != null ? dto.taxRate() : BigDecimal.ZERO);
            charge.setDiscountRate(dto.discountRate() != null ? dto.discountRate() : BigDecimal.ZERO);
            charge.setReferenceType(dto.referenceType());
            charge.setReferenceId(dto.referenceId());
            charge.setNotes(dto.notes());
            charge.setPostedBy(dto.postedBy() != null ? dto.postedBy() : "SYSTEM");

            folioChargeRepository.save(charge);

            // Recalculate folio totals
            folio.recalculateTotals();
            Folio savedFolio = folioRepository.save(folio);

            return folioMapper.toDto(savedFolio);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to add charge: " + e.getMessage());
        }
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

        try {
            charge.voidCharge(voidedBy != null ? voidedBy : "SYSTEM", reason);
            folioChargeRepository.save(charge);

            // Recalculate folio totals
            folio.recalculateTotals();
            Folio savedFolio = folioRepository.save(folio);

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
}
