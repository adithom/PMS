package com.adith.os.HMS.roomassignment.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record RoomShiftRequestDto(
        @NotNull(message = "New room ID is required")
        UUID newRoomId,

        @NotNull(message = "Shift date is required")
        LocalDate shiftDate,

        String notes
) {
}
