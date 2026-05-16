package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.MealType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PosTicketHistoryDto(
        UUID id,
        String invoiceNumber,
        String locationName,
        String guestName,
        String roomNumber,
        MealType mealType,
        boolean mealPlanCovered,
        OffsetDateTime closedAt,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        String createdBy,
        List<PosOrderItemDto> items,
        String paymentMethod,
        String transactionReference
) {
}
