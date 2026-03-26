package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.PosOrderStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PosOrderDto(
        UUID id,
        String orderNumber,
        UUID posLocationId,
        PosOrderStatus status,
        BigDecimal totalAmount,
        UUID folioId,
        List<PosOrderItemDto> items,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt,
        UUID propertyId,
        UUID bookingId,
        UUID roomId,
        String orderType,
        OffsetDateTime orderDate,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal serviceCharge,
        BigDecimal discountAmount,
        String paymentStatus,
        String tableNumber,
        String guestName,
        String specialInstructions,
        String createdBy,
        String servedBy
) {}
