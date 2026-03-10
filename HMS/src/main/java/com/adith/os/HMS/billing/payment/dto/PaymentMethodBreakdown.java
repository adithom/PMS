package com.adith.os.HMS.billing.payment.dto;

import com.adith.os.HMS.billing.payment.PaymentMethod;

import java.math.BigDecimal;

public record PaymentMethodBreakdown(
        PaymentMethod paymentMethod,
        BigDecimal amount,
        int count
) {}
