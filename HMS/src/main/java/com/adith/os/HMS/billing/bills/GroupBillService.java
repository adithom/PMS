package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.FolioRepository;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.GroupBillDto;
import com.adith.os.HMS.property.PropertyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class GroupBillService {

    private final BookingRepository bookingRepository;
    private final FolioRepository folioRepository;
    private final PropertyRepository propertyRepository;

    public GroupBillService(
            BookingRepository bookingRepository,
            FolioRepository folioRepository,
            PropertyRepository propertyRepository) {
        this.bookingRepository = bookingRepository;
        this.folioRepository = folioRepository;
        this.propertyRepository = propertyRepository;
    }

    // =========================================================================
    // CONSOLIDATED BILLING VIEW
    // =========================================================================

    /**
     * Returns the full itemized billing view for a group booking.
     *
     * Each child booking gets its own RoomBillSection with all its charge
     * line-items. The group-level totals aggregate across all rooms.
     *
     * Works for both SEPARATE and CONSOLIDATED billing modes — in SEPARATE
     * mode the group totals are still computed (useful for the manager overview)
     * but each room settles its own folio independently.
     */
    public GroupBillDto getGroupBillView(UUID propertyId, UUID parentBookingId) {
        // --- Validate property ---
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        // --- Validate and load parent ---
        Booking parent = bookingRepository.findById(parentBookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Group booking not found"));

        if (!parent.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to this property");
        }

        if (!parent.isGroupMaster()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking " + parentBookingId + " is not a group master");
        }

        // --- Load children ---
        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);

        if (children.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No child bookings found for this group");
        }

        // --- Determine billing mode from folio routing ---
        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);

        // --- Build per-room sections ---
        List<GroupBillDto.RoomBillSection> roomSections = new ArrayList<>();

        BigDecimal groupSubtotal       = BigDecimal.ZERO;
        BigDecimal groupTaxAmount      = BigDecimal.ZERO;
        BigDecimal groupDiscountAmount = BigDecimal.ZERO;
        BigDecimal groupTotalAmount    = BigDecimal.ZERO;
        BigDecimal groupPaidAmount     = BigDecimal.ZERO;

        for (Booking child : children) {
            Folio folio = child.getMasterFolio();

            if (folio == null) {
                // Child has no folio yet — include an empty section so the
                // response is complete and the frontend can show "no charges"
                roomSections.add(new GroupBillDto.RoomBillSection(
                        child.getId(),
                        null, null,
                        child.getGuest().getId(),
                        child.getGuest().getFullName(),
                        child.getRoom() != null ? child.getRoom().getNumber() : null,
                        child.getUnit() != null ? child.getUnit().getName() : null,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        false, null,
                        List.of()
                ));
                continue;
            }

            // Filter to non-voided charges only
            List<ChargeDto> chargeDtos = buildChargeDtos(folio);

            // Build section totals from the folio entity (already computed by recalculateTotals)
            BigDecimal roomSubtotal       = folio.getSubtotal();
            BigDecimal roomTaxAmount      = folio.getTaxAmount();
            BigDecimal roomDiscountAmount = folio.getDiscountAmount();
            BigDecimal roomTotalAmount    = folio.getTotalAmount();
            BigDecimal roomPaidAmount     = folio.getPaidAmount();
            BigDecimal roomBalanceDue     = folio.getBalanceDue();

            roomSections.add(new GroupBillDto.RoomBillSection(
                    child.getId(),
                    folio.getId(),
                    folio.getFolioNumber(),
                    child.getGuest().getId(),
                    child.getGuest().getFullName(),
                    child.getRoom() != null ? child.getRoom().getNumber() : null,
                    child.getUnit() != null ? child.getUnit().getName() : null,
                    roomSubtotal,
                    roomTaxAmount,
                    roomDiscountAmount,
                    roomTotalAmount,
                    roomPaidAmount,
                    roomBalanceDue,
                    folio.isRouted(),
                    folio.isRouted() ? folio.getRoutedToFolio().getId() : null,
                    chargeDtos
            ));

            // Accumulate group totals
            groupSubtotal       = groupSubtotal.add(roomSubtotal);
            groupTaxAmount      = groupTaxAmount.add(roomTaxAmount);
            groupDiscountAmount = groupDiscountAmount.add(roomDiscountAmount);
            groupTotalAmount    = groupTotalAmount.add(roomTotalAmount);
            groupPaidAmount     = groupPaidAmount.add(roomPaidAmount);
        }

        BigDecimal groupBalanceDue = groupTotalAmount.subtract(groupPaidAmount)
                .max(BigDecimal.ZERO);

        return new GroupBillDto(
                parent.getId(),
                parent.getGroupReference(),
                parent.getGuest().getFullName(),
                parent.getCheckIn(),
                parent.getCheckOut(),
                parent.getCurrency(),
                billingMode,
                OffsetDateTime.now(),
                groupSubtotal,
                groupTaxAmount,
                groupDiscountAmount,
                groupTotalAmount,
                groupPaidAmount,
                groupBalanceDue,
                roomSections
        );
    }

    /**
     * Returns only the charge line-items that belong to folios routed to the
     * given target folio. Useful when the organizer's folio needs to be settled
     * and the front desk wants to see exactly what's been routed in.
     *
     * This is a flat list — all routed charges from all child rooms merged
     * together, sorted by charge date.
     */
    public List<ChargeDto> getRoutedChargesForFolio(UUID propertyId, UUID targetFolioId) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        Folio targetFolio = folioRepository.findById(targetFolioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Folio not found"));

        if (!targetFolio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to this property");
        }

        // Find all folios routing to this target
        List<Folio> routedFolios = folioRepository.findByRoutedToFolioId(targetFolioId);

        return routedFolios.stream()
                .flatMap(folio -> buildChargeDtos(folio).stream())
                .sorted((a, b) -> {
                    if (a.chargeDate() == null) return 1;
                    if (b.chargeDate() == null) return -1;
                    return a.chargeDate().compareTo(b.chargeDate());
                })
                .collect(Collectors.toList());
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    /**
     * Maps non-voided FolioCharges to ChargeDtos.
     * Voided charges are excluded from billing views — they're already
     * excluded from folio totals by recalculateTotals() but we also
     * exclude them here so they don't clutter line-item views.
     */
    private List<ChargeDto> buildChargeDtos(Folio folio) {
        if (folio.getCharges() == null || folio.getCharges().isEmpty()) {
            return List.of();
        }

        return folio.getCharges().stream()
                .filter(c -> !c.isVoided())
                .map(this::toChargeDto)
                .collect(Collectors.toList());
    }

    private ChargeDto toChargeDto(FolioCharge charge) {
        return new ChargeDto(
                charge.getId(),
                charge.getChargeDate(),
                charge.getPostingDate(),
                charge.getChargeCode(),
                charge.getDescription(),
                charge.getQuantity(),
                charge.getUnitPrice(),
                charge.getSubtotal(),
                charge.getTaxRate(),
                charge.getTaxAmount(),
                charge.getDiscountAmount(),
                charge.getTotalAmount(),
                charge.isVoided(),
                charge.getVoidReason(),
                charge.getNotes()
        );
    }

    private String inferBillingMode(List<Booking> children, UUID parentFolioId) {
        if (parentFolioId == null || children.isEmpty()) return "SEPARATE";

        boolean allRouted = children.stream().allMatch(child -> {
            Folio f = child.getMasterFolio();
            return f != null && f.isRouted()
                    && f.getRoutedToFolio().getId().equals(parentFolioId);
        });

        return allRouted ? "CONSOLIDATED" : "SEPARATE";
    }
}
