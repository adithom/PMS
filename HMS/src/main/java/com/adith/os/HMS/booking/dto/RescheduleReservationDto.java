package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record RescheduleReservationDto(
        @NotNull LocalDate newCheckIn,
        @NotNull LocalDate newCheckOut,
        String reason
) {}
