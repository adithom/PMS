package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BookingUpdateDto(
        UUID roomId,

        UUID guestId,

        UUID unitId,

        LocalDate checkIn,

        LocalDate checkOut,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        String currency,

        BigDecimal totalPrice,

        @PositiveOrZero
        BigDecimal nightlyRate,

        @PositiveOrZero
        BigDecimal nightlyRateExTax,

        BigDecimal paidAmount,

        BookingStatus status,

        String specialRequests,

        Boolean isTwinBed,

        String referenceNumber,

        UUID travelAgentId,         // null = no change (PATCH) or remove agent (PUT)

        Boolean clearTravelAgent,   // PATCH only: if true, explicitly removes travel agent

        MealPlanType mealPlanType,  // null = no change (PATCH)

        Boolean clearMealPlan,      // PATCH only: if true, explicitly removes meal plan

        @PositiveOrZero(message = "Meal plan price cannot be negative")
        BigDecimal mealPlanPricePerNight,  // Optional — overrides property default adult price per person

        @PositiveOrZero(message = "Children meal plan price cannot be negative")
        BigDecimal mealPlanChildrenPricePerNight,  // Optional — overrides property default children price per person

        @PositiveOrZero(message = "Extra beds cannot be negative")
        Integer extraBeds,

        @PositiveOrZero(message = "Extra bed rate cannot be negative")
        BigDecimal extraBedRatePerNight,

        ChargeCode extraBedChargeCode  // ROOM_RENT or MISC

  ) {
}
