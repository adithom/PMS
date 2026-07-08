package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductDto(
        UUID id,
        String name,
        String description,
        BigDecimal price,
        BigDecimal cost,
        UUID categoryId,
        String categoryName,
        UUID posLocationId,
        BigDecimal taxRate,
        BigDecimal discountRate,
        boolean isAvailable,
        Integer preparationTime,
        String imageUrl,
        boolean isPriceOverridable) {
}
