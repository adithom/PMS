package com.adith.os.HMS.billing.pos.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record PosSettleDto(
        boolean walkIn,           // true = anonymous walk-in, false = hotel guest with folio
        UUID folioId,             // required when walkIn = false

        @NotBlank(message = "Payment method is required")
        String paymentMethod,     // CASH, CREDIT_CARD, DEBIT_CARD, UPI, BANK_TRANSFER

        String transactionId,
        String cardLastFour,
        String upiId,
        String notes
) {}
