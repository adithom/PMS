package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GroupBookingCreationDto(

        @NotNull(message = "Organizer guest ID is required")
        UUID organizerGuestId,

        @NotNull(message = "Check-in date is required")
        @FutureOrPresent(message = "Check-in date cannot be in the past")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @NotNull(message = "At least one room request is required")
        @NotEmpty(message = "At least one room request is required")
        @Valid
        List<GroupRoomRequestDto> roomRequests,

        String groupReference,

        String specialRequests,

        String currency,

        GroupBillingMode billingMode,

        UUID travelAgentId,

        // Meal plan applied uniformly to all rooms
        MealPlanType mealPlanType,

        @PositiveOrZero
        BigDecimal mealPlanPricePerNight,

        @PositiveOrZero
        BigDecimal mealPlanChildrenPricePerNight,

        // Booking source (e.g. "Direct", "MakeMyTrip")
        String bookingSource,

        // Advance payment recorded on organizer's folio at creation
        @PositiveOrZero
        BigDecimal advancePaymentAmount,

        PaymentMethod advancePaymentMethod

) {
    public GroupBookingCreationDto {
        if (currency == null || currency.isBlank()) currency = "INR";
        if (billingMode == null) billingMode = GroupBillingMode.SEPARATE;
        if (advancePaymentMethod == null && advancePaymentAmount != null
                && advancePaymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            advancePaymentMethod = PaymentMethod.CASH;
        }
    }

    public enum GroupBillingMode {
        SEPARATE,       // Each room settles independently
        CONSOLIDATED    // All charges route to the organizer's folio
    }
}
