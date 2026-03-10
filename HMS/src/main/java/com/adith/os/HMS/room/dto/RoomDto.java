package com.adith.os.HMS.room.dto;

import com.adith.os.HMS.room.RoomStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RoomDto(
        UUID id,
        @NotBlank String propertyCode,
        String unitName,
        @NotBlank String number,
        @NotBlank String type,
        @NotNull Integer capacity,
        @NotNull BigDecimal baseRate,
        @NotBlank RoomStatus status,
        OffsetDateTime lastMaintained
) {
}