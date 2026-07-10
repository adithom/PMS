package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.property.mealplan.MealPlanType;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ReservationUpdateDto(
        UUID organizerGuestId,
        String groupReference,
        String specialRequests,
        List<BookingOccupancyUpdateDto> bookingUpdates,
        MealPlanType mealPlanType,
        BigDecimal mealPlanPricePerNight,
        BigDecimal mealPlanChildrenPricePerNight,
        String bookingSource,
        UUID travelAgentId
) {}
