package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExtendBookingRequestDto(
        @NotNull(message = "New check-out date is required")
        LocalDate newCheckOutDate,

        @PositiveOrZero(message = "Extension rate cannot be negative")
        BigDecimal extensionNightlyRate, // How much to charge per extra night

        String notes // Optional
) {}