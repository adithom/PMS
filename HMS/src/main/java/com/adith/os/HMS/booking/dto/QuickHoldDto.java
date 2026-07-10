package com.adith.os.HMS.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record QuickHoldDto(
        @NotNull(message = "Check-in date is required")
        @FutureOrPresent(message = "Check-in date cannot be in the past")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @NotNull(message = "At least one room request is required")
        @NotEmpty(message = "At least one room request is required")
        @Valid
        List<QuickHoldRoomRequestDto> roomRequests,

        String notes
) {}
