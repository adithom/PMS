package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.adith.os.HMS.reservation.ReservationStatus;

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
        String reservationNumber,
        String groupReference,
        UUID organizerGuestId,
        String organizerGuestName,
        LocalDate checkIn,
        LocalDate checkOut,
        String specialRequests,
        ReservationStatus overallStatus,    // Reservation lifecycle status
        int totalRooms,
        BigDecimal totalGroupPrice,         // Sum of all member booking totalPrices
        String currency,
        OffsetDateTime createdAt,

        // --- Billing ---
        String billingMode,                 // "SEPARATE" or "CONSOLIDATED"

        // --- Travel agent (reservation-level) ---
        UUID travelAgentId,
        String travelAgentName,

        // --- Booking source (from first active booking, uniform across all) ---
        String bookingSource,

        // --- Reservation-level (master) payments — not tied to any single booking's folio ---
        BigDecimal reservationLevelPaidAmount,

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
            String roomNumber,              // null if not yet assigned
            boolean cancelled,             // true if this individual room was cancelled
            Integer adults,
            Integer children,
            BigDecimal totalPrice,
            BigDecimal balanceDue,
            UUID folioId,
            String folioNumber,
            String specialRequests,
            Boolean isTwinBed,
            BigDecimal unitBaseRate,            // baseRate of first active room in unit — for estimate
            BigDecimal mealPlanPricePerNight,   // from booking.mealPlanPricePerNight
            MealPlanType mealPlanType,          // from booking.mealPlanType
            Integer extraBeds,                  // from booking.extraBeds
            BigDecimal nightlyRate              // expectedNightlyRate — kept in sync with assignment rate
    ) {}
}
