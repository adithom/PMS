package com.adith.os.HMS.billing.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductCreationDto(
        @NotNull UUID locationId,
        @NotBlank String name,
        @NotBlank String code,
        String description,
        @NotBlank String category,
        @NotNull BigDecimal price,
        BigDecimal cost,
        BigDecimal taxRate,
        boolean isAvailable,
        Integer preparationTime,
        String imageUrl) {
}
