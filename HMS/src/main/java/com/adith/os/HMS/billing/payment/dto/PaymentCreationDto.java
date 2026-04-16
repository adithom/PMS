package com.adith.os.HMS.billing.payment.dto;


import com.adith.os.HMS.billing.folio.ChargeCategory;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.UUID;

public record PaymentCreationDto(
        @NotNull(message = "Payment amount is required")
        @Positive(message = "Amount must be positive")
        BigDecimal amount,

        @NotNull(message = "Payment method is required")
        PaymentMethod paymentMethod,

        ChargeCategory targetCategory,

        // Card payment details
        String transactionId,
        String cardLastFour,
        String cardType,

        // Bank transfer details
        String bankName,
        String accountNumber,
        String referenceNumber,

        // UPI details
        String upiId,

        // General
        String notes,
        String processedBy,

        // Travel agent billing
        UUID travelAgentId
) {}
