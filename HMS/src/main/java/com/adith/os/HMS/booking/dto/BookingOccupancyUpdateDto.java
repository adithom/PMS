package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.UUID;

public record BookingOccupancyUpdateDto(
        UUID bookingId,
        UUID guestId,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        @PositiveOrZero(message = "Nightly rate cannot be negative")
        BigDecimal nightlyRate
) {}
