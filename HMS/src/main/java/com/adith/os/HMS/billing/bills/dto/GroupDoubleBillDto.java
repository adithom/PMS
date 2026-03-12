package com.adith.os.HMS.billing.bills.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO returned after generating a group bill.
 *
 * Mirrors the structure of DoubleBillDto but scoped to a group:
 * - roomRentBill  : aggregated room rent charges across all rooms in the group
 * - ancillaryBill : aggregated ancillary charges across all rooms in the group
 *
 * Each bill section contains per-room line-item breakdowns so the printed
 * invoice clearly shows which charges belong to which room/guest.
 */
public record GroupDoubleBillDto(
        GroupBillSectionDto roomRentBill,
        GroupBillSectionDto ancillaryBill
) {

    /**
     * One bill (either ROOM_RENT or ANCILLARY) covering all rooms in the group.
     */
    public record GroupBillSectionDto(

            // --- Invoice identity ---
            String invoiceNumber,
            LocalDate invoiceDate,
            String category,            // "ROOM_RENT" or "ANCILLARY"

            // --- Property ---
            String propertyName,
            String propertyAddress,
            String propertyGstNumber,

            // --- Group / Organizer ---
            UUID parentBookingId,
            String groupReference,
            String organizerGuestName,
            String organizerGuestPhone,
            String organizerGuestEmail,
            String organizerGuestGstNumber, // GST number supplied at bill generation

            // --- Stay ---
            LocalDate checkIn,
            LocalDate checkOut,
            String currency,
            OffsetDateTime generatedAt,

            // --- Per-room line-item sections ---
            List<RoomChargeSection> rooms,

            // --- Group-level totals ---
            BigDecimal groupSubtotal,
            BigDecimal groupTaxAmount,
            BigDecimal groupDiscountAmount,
            BigDecimal groupGrandTotal,
            BigDecimal groupAmountPaid,
            BigDecimal groupBalanceDue,

            // --- Void metadata (populated only if this bill is later voided) ---
            boolean isVoided,
            String voidReason,
            LocalDateTime voidedAt,
            String voidedBy
    ) {}

    /**
     * Charge line-items for one room within the group bill.
     * Rooms with no charges for this category are omitted from the list.
     */
    public record RoomChargeSection(
            UUID childBookingId,
            UUID folioId,
            String folioNumber,
            String guestName,
            String roomNumber,      // null if not yet assigned
            String unitName,

            List<com.adith.os.HMS.billing.folio.dto.ChargeDto> charges,

            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount
    ) {}
}