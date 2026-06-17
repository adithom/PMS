package com.adith.os.HMS.billing.payment.dto;

import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record PaymentUpdateDto(
        @Positive(message = "Payment amount must be positive")
        BigDecimal amount,
        String notes
) {}
