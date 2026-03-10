package com.adith.os.HMS.room.dto;

import com.adith.os.HMS.room.RoomStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RoomCreationDto(
        UUID unitId,
        @NotBlank(message = "Room number is required")
        String number,
        String type,
        @NotNull(message = "Capacity is required")
        @Positive(message = "Capacity must be positive")
        Integer capacity,
        @NotNull(message = "Base rate is required")
        @Min(value = 0, message = "Base rate cannot be negative")
        BigDecimal baseRate,
        RoomStatus status,
        OffsetDateTime lastMaintained
) {
}