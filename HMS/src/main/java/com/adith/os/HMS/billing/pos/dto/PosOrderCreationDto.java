package com.adith.os.HMS.billing.pos.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PosOrderCreationDto(
        @NotNull UUID posLocationId,
        List<PosOrderItemCreationDto> items,
        BigDecimal discountRate) {
    public record PosOrderItemCreationDto(
            @NotNull UUID posProductId,
            @NotNull Integer quantity,
            BigDecimal priceOverride) {
    }
}
