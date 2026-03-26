package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PosProductUpdateDto(
        String name,
        String description,
        UUID categoryId,
        BigDecimal price,
        BigDecimal cost,
        BigDecimal taxRate,
        BigDecimal discountRate,
        Boolean isAvailable,
        Integer preparationTime,
        String imageUrl
) {}
