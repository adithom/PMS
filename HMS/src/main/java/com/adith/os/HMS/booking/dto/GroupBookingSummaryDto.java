package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.booking.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO returned after creating or fetching a group booking.
 * Contains the parent booking summary plus all child booking summaries.
 */
public record GroupBookingSummaryDto(

        // --- Parent booking info ---
        UUID parentBookingId,
        String groupReference,
        UUID organizerGuestId,
        String organizerGuestName,
        LocalDate checkIn,
        LocalDate checkOut,
        BookingStatus overallStatus,    // Derived: worst-case status across children
        int totalRooms,
        BigDecimal totalGroupPrice,     // Sum of all child booking totalPrices
        String currency,
        OffsetDateTime createdAt,

        // --- Billing ---
        String billingMode,             // "SEPARATE" or "CONSOLIDATED"
        UUID masterFolioId,             // The organizer's folio (used for consolidated billing)

        // --- Children ---
        List<ChildBookingSummaryDto> childBookings
) {

    /**
     * Summary of a single child booking within the group.
     */
    public record ChildBookingSummaryDto(
            UUID bookingId,
            UUID guestId,
            String guestName,
            UUID unitId,
            String unitName,
            String roomNumber,          // null if not yet assigned
            BookingStatus status,
            BigDecimal totalPrice,
            BigDecimal balanceDue,
            UUID folioId,
            String folioNumber,
            boolean folioIsRouted,      // true if routed to master folio
            String specialRequests
    ) {}
}
