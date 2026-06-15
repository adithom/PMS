package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.MealType;
import com.adith.os.HMS.billing.pos.PosTicketStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PosTicketDto(
        UUID id,
        String ticketNumber,
        String invoiceNumber,
        UUID posLocationId,
        UUID bookingId,
        String guestName,
        String roomNumber,
        MealType mealType,
        PosTicketStatus status,
        boolean mealPlanCovered,
        String receiptUrl,
        String createdBy,
        OffsetDateTime createdAt,
        OffsetDateTime closedAt,
        List<PosOrderDto> orders,
        String paymentMethod,
        BigDecimal paymentAmount,
        String transactionReference,
        String cancellationReason
) {
}
