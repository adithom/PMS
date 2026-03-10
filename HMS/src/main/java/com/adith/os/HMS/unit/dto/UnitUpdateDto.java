package com.adith.os.HMS.unit.dto;

import jakarta.validation.constraints.Min;

public record UnitUpdateDto(
        String name,
        Integer sortOrder
) {
}
