package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PosOrderItemDto(
        UUID id,
        UUID posProductId,
        String itemName,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal,
        BigDecimal taxRate,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        String specialInstructions,
        String status) {
}
