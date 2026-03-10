package com.adith.os.HMS.room.dto;

import com.adith.os.HMS.room.RoomStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RoomUpdateDto(
        UUID unitId,
        String number,
        String type,
        @Positive(message = "Capacity must be positive")
        Integer capacity,
        @Min(value = 0, message = "Base rate cannot be negative")
        BigDecimal baseRate,
        RoomStatus status,
        OffsetDateTime lastMaintained
) {
}