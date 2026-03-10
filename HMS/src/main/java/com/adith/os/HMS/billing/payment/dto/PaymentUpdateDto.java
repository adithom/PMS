package com.adith.os.HMS.billing.payment.dto;

import com.adith.os.HMS.billing.payment.PaymentStatus;

public record PaymentUpdateDto(
        PaymentStatus paymentStatus,
        String transactionId,
        String notes
) {}
