package com.adith.os.HMS.billing.pos.dto;

public record CloseTicketDto(
        String paymentMethod,
        String transactionReference
) {
}
