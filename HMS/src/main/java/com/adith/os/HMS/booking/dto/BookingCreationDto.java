package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.adith.os.HMS.travelagent.dto.TravelAgentCreationDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record BookingCreationDto(
        UUID roomId,  // Optional

        @NotNull(message = "Guest ID is required")
        UUID guestId,

        UUID unitId,

        @NotNull(message = "Check-in date is required")
        @FutureOrPresent(message = "Check-in date cannot be in the past")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        String currency,  // Defaults to "INR"

        @PositiveOrZero(message = "Nightly rate cannot be negative")
        BigDecimal nightlyRate,

        @PositiveOrZero(message = "Nightly rate ex-tax cannot be negative")
        BigDecimal nightlyRateExTax,

        @PositiveOrZero(message = "Paid amount cannot be negative")
        BigDecimal paidAmount,

        String specialRequests,

        UUID parentBookingId,       // Set when creating a child booking individually
        String groupReference,       // e.g. "WEDDING-SHARMA-2025", purely informational

        UUID reservationId,          // Set when attaching a new booking to an existing reservation

        Boolean isTwinBed,

        String referenceNumber,      // Optional external booking engine reference

        UUID travelAgentId,          // Optional — reference an existing travel agent

        @Valid
        TravelAgentCreationDto newTravelAgent,  // Optional — create a new travel agent inline

        UUID contactPersonId,        // Optional — contact person at the travel agent for this booking

        MealPlanType mealPlanType,   // Optional — select a meal plan for this booking

        @PositiveOrZero(message = "Meal plan price cannot be negative")
        BigDecimal mealPlanPricePerNight,

        @PositiveOrZero(message = "Children meal plan price cannot be negative")
        BigDecimal mealPlanChildrenPricePerNight,

        @PositiveOrZero(message = "Extra beds cannot be negative")
        Integer extraBeds,

        @PositiveOrZero(message = "Extra bed rate cannot be negative")
        BigDecimal extraBedRatePerNight,

        ChargeCode extraBedChargeCode,

        PaymentMethod advancePaymentMethod,

        String advanceTransactionId,
        String advanceCardLastFour,
        String advanceCardType,
        String advanceBankName,
        String advanceAccountNumber,
        String advanceReferenceNumber,
        String advanceUpiId,
        String advanceNotes,

        String bookingSource,

        @Size(max = 3, message = "Maximum 3 additional guests allowed")
        List<UUID> additionalGuestIds

) {
    public BookingCreationDto {
        if (adults == null) adults = 1;
        if (children == null) children = 0;
        if (currency == null || currency.isBlank()) currency = "INR";
        if (nightlyRate == null) nightlyRate = BigDecimal.ZERO;
        if (paidAmount == null) paidAmount = BigDecimal.ZERO;
        if (travelAgentId != null && newTravelAgent != null) {
            throw new IllegalArgumentException("Provide either travelAgentId OR newTravelAgent, not both");
        }
    }
}
