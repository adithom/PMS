package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;

public record PosProductUpdateDto(
        String name,
        String description,
        String category,
        BigDecimal price,
        BigDecimal cost,
        BigDecimal taxRate,
        Boolean isAvailable,
        Integer preparationTime,
        String imageUrl
) {}
