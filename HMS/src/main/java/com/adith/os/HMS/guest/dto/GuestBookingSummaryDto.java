package com.adith.os.HMS.guest.dto;

import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.mealplan.MealPlanType;

import java.time.LocalDate;
import java.util.UUID;

public record GuestBookingSummaryDto(
        UUID bookingId,
        UUID reservationId,
        String groupReference,
        String propertyName,
        String roomNumber,
        String unitName,
        LocalDate checkIn,
        LocalDate checkOut,
        BookingStatus status,
        MealPlanType mealPlanType,
        String role  // "PRIMARY" or "ADDITIONAL"
) {}
