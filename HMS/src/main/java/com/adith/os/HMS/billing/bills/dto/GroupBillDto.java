package com.adith.os.HMS.billing.bills.dto;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Full consolidated billing view for a group booking.
 *
 * Contains:
 *   - Group-level totals (sum across all rooms)
 *   - Per-room charge breakdown (RoomBillSection)
 *   - All charge line-items per room, each tagged with room number and guest name
 *     so the frontend can render a clear itemized view
 */
public record GroupBillDto(

        // --- Group identity ---
        UUID parentBookingId,
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
     * Billing section for one room/child booking within the group.
     *
     * If billingMode is CONSOLIDATED, all charges here are also reflected
     * in the group totals above. If SEPARATE, each room settles independently
     * and the group totals are informational only.
     */
    public record RoomBillSection(
            UUID childBookingId,
            UUID folioId,
            String folioNumber,
            UUID guestId,
            String guestName,
            String roomNumber,          // null if not yet assigned
            String unitName,

            // Folio totals for this room
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount,
            BigDecimal paidAmount,
            BigDecimal balanceDue,

            boolean isRouted,           // true if routed to master folio
            UUID routedToFolioId,       // the folio this is routed to (if isRouted)

            // Full line-item charges for this room (voided charges excluded)
            List<ChargeDto> charges
    ) {}
}