package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.booking.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO returned after creating or fetching a group reservation.
 * The reservation is the top-level container; bookings under it are
 * the actual room stays. There is no longer a "parent" booking placeholder.
 */
public record GroupBookingSummaryDto(

        // --- Reservation info ---
        UUID reservationId,
        String groupReference,
        UUID organizerGuestId,
        String organizerGuestName,
        LocalDate checkIn,
        LocalDate checkOut,
        BookingStatus overallStatus,    // Derived: worst-case status across bookings
        int totalRooms,
        BigDecimal totalGroupPrice,     // Sum of all member booking totalPrices
        String currency,
        OffsetDateTime createdAt,

        // --- Billing ---
        String billingMode,             // "SEPARATE" or "CONSOLIDATED" — derived from reservation.defaultRouteToMaster

        // --- Member bookings ---
        List<BookingSummaryDto> bookings
) {

    /**
     * Summary of a single booking within the reservation.
     */
    public record BookingSummaryDto(
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
            String specialRequests,
            Boolean isTwinBed
    ) {}
}
