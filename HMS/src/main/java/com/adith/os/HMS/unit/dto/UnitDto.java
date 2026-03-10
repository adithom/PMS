package com.adith.os.HMS.unit.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record UnitDto(
        UUID id,
        @NotBlank String name,
        @NotBlank String PropertyCode,
        Integer sortOrder,
        Integer totalRooms
) {
}
