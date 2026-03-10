package com.adith.os.HMS.billing.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record RefundDto(
        @NotNull(message = "Refund amount is required")
        @Positive(message = "Refund amount must be positive")
        BigDecimal amount,

        @NotBlank(message = "Refund reason is required")
        String reason,

        String processedBy
) {}
