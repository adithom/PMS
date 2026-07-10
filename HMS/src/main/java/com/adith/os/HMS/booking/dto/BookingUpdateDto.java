package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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

        String specialRequests,

        Boolean isTwinBed,

        String referenceNumber,

        UUID travelAgentId,         // null = no change (PATCH) or remove agent (PUT)

        Boolean clearTravelAgent,   // PATCH only: if true, explicitly removes travel agent

        UUID contactPersonId,       // Optional — contact person at the travel agent for this booking

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

        ChargeCode extraBedChargeCode,  // ROOM_RENT or MISC

        String bookingSource,  // Optional — source of the booking

        @Size(max = 3, message = "Maximum 3 additional guests allowed")
        List<UUID> additionalGuestIds  // Optional — if present, replaces the booking's additional guests list

  ) {
}
