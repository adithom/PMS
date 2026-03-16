package com.adith.os.HMS.roomassignment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RoomShiftRequestDto(
        @NotNull(message = "New room ID is required")
        UUID newRoomId,

        @NotNull(message = "Shift date is required")
        LocalDate shiftDate,

        @Positive(message = "New rate must be positive")
        BigDecimal newRate,

        String notes
) {
}
