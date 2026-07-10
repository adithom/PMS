package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

public record QuickHoldRoomRequestDto(
        @NotNull(message = "Unit ID is required")
        UUID unitId,

        @Positive(message = "Count must be at least 1")
        int count
) {}
