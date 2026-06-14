package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record BookingDto(
        @NotNull
        UUID id,

        @NotNull
        UUID propertyId,

        String roomNumber,  // Nullable if room not assigned

        @NotNull
        UUID guestId,

        @NotBlank
        String guestName,

        UUID unitId,

        String unitName,

        @NotNull
        BookingStatus status,  // CHANGED: Now using BookingStatus enum instead of String

        @JsonFormat(pattern = "yyyy-MM-dd")
        @NotNull
        LocalDate checkIn,

        @JsonFormat(pattern = "yyyy-MM-dd")
        @NotNull
        LocalDate checkOut,

        @NotNull
        Long stayDuration,

        @NotNull
        Integer adults,

        @NotNull
        Integer children,

        @NotBlank
        String currency,

        @NotNull
        BigDecimal totalPrice,

        @NotNull
        BigDecimal paidAmount,

        @NotNull
        BigDecimal balanceDue,

        Boolean isFullyPaid,

        String specialRequests,  // ADDED: Special requests field (can be null)

        @NotNull
        OffsetDateTime createdAt,

        Double paymentProgress,

        UUID reservationId,
        String reservationNumber,

        Boolean isTwinBed,

        String referenceNumber,

        UUID travelAgentId,
        String travelAgentName,
        UUID contactPersonId,
        String contactPersonName,

        MealPlanType mealPlanType,
        String mealPlanDisplayName,
        BigDecimal mealPlanPricePerNight,
        BigDecimal mealPlanChildrenPricePerNight,

        Integer extraBeds,
        BigDecimal extraBedRatePerNight,
        ChargeCode extraBedChargeCode,

        BigDecimal nightlyRate,
        BigDecimal nightlyRateExTax,

        String bookingSource,

        // Audit fields surfaced in the Reservations Detail modal.
        String cancellationReason,
        String rescheduleReason,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate originalCheckIn,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate originalCheckOut,

        List<GuestSummaryDto> additionalGuests
) {
    // Compact constructor for validation and defaults
    public BookingDto {
        // Ensure balanceDue is never null
        if (balanceDue == null) {
            balanceDue = BigDecimal.ZERO;
        }
        // Calculate isFullyPaid if not provided
        if (isFullyPaid == null) {
            isFullyPaid = balanceDue.compareTo(BigDecimal.ZERO) <= 0;
        }
        if (additionalGuests == null) {
            additionalGuests = List.of();
        }
    }
}
