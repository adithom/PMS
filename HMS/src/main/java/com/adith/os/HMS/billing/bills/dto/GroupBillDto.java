package com.adith.os.HMS.billing.bills.dto;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Full consolidated billing view for a group reservation.
 *
 * Contains:
 *   - Group-level totals (sum across all rooms)
 *   - Per-room charge breakdown (RoomBillSection)
 *   - All charge line-items per room
 */
public record GroupBillDto(

        // --- Reservation identity ---
        UUID reservationId,
        String groupReference,
        String organizerGuestName,
        LocalDate checkIn,
        LocalDate checkOut,
        String currency,
        String billingMode,         // "SEPARATE" or "CONSOLIDATED"
        OffsetDateTime generatedAt,

        // --- Group-level totals ---
        BigDecimal groupSubtotal,
        BigDecimal groupTaxAmount,
        BigDecimal groupDiscountAmount,
        BigDecimal groupTotalAmount,
        BigDecimal groupPaidAmount,
        BigDecimal groupBalanceDue,

        // --- Per-room sections ---
        List<RoomBillSection> rooms
) {

    /**
     * Billing section for one booking under the reservation.
     */
    public record RoomBillSection(
            UUID bookingId,
            UUID folioId,
            String folioNumber,
            UUID guestId,
            String guestName,
            String roomNumber,          // null if not yet assigned
            String unitName,

            // Folio totals for this booking
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal balanceDue,

            // Full line-item charges for this booking (voided charges excluded)
            List<ChargeDto> charges
    ) {}
}
