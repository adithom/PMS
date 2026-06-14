package com.adith.os.HMS.billing.folio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record ChargeUpdateDto(
        @NotBlank(message = "Description is required")
        String description,

        @NotNull(message = "Unit price is required")
        @Positive(message = "Unit price must be positive")
        BigDecimal unitPrice,

        @NotNull(message = "Quantity is required")
        @Positive(message = "Quantity must be positive")
        BigDecimal quantity,

        @NotNull(message = "Tax rate is required")
        @PositiveOrZero(message = "Tax rate must be zero or positive")
        BigDecimal taxRate
) {}
