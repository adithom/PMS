package com.adith.os.HMS.billing.pos.dto;

import java.util.UUID;

public record PosItemCategoryDto(
        UUID id,
        UUID locationId,
        String name,
        Integer displayOrder,
        boolean isActive) {
}
