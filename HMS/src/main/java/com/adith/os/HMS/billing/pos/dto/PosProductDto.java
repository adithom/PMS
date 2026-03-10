package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductDto(
        UUID id,
        String name,
        String code,
        String description,
        BigDecimal price,
        BigDecimal cost,
        String category,
        UUID posLocationId,
        BigDecimal taxRate,
        boolean isAvailable,
        Integer preparationTime,
        String imageUrl) {
}
