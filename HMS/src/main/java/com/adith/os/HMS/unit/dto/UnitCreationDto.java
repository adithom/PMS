package com.adith.os.HMS.unit.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record UnitCreationDto(
        @NotBlank String name,
        Integer sortOrder
) {
}
