package com.adith.os.HMS.billing.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductCreationDto(
        @NotNull UUID locationId,
        @NotBlank String name,
        String description,
        @NotNull UUID categoryId,
        @NotNull BigDecimal price,
        BigDecimal cost,
        BigDecimal taxRate,
        BigDecimal discountRate,
        boolean isAvailable,
        Integer preparationTime,
        String imageUrl) {
}
