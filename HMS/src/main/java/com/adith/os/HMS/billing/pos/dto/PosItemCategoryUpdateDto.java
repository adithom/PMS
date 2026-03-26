package com.adith.os.HMS.billing.pos.dto;

public record PosItemCategoryUpdateDto(
        String name,
        Integer displayOrder,
        Boolean isActive) {
}
