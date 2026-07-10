package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.property.mealplan.MealPlanType;

import java.util.List;
import java.util.UUID;

public record ReservationUpdateDto(
        UUID organizerGuestId,
        String groupReference,
        String specialRequests,
        List<BookingOccupancyUpdateDto> bookingUpdates,
        MealPlanType mealPlanType,
        String bookingSource,
        UUID travelAgentId
) {}
