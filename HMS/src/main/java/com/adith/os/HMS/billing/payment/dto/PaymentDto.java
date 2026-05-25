package com.adith.os.HMS.billing.payment.dto;

import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.billing.payment.PaymentStatus;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PaymentDto(
        UUID id,
        String paymentNumber,
        UUID bookingId,        // populated for folio (booking-level) payments
        UUID reservationId,    // populated for reservation-level (master) payments
        BigDecimal amount,
        String currency,
        PaymentMethod paymentMethod,
        PaymentStatus paymentStatus,

        // Card details (masked)
        String transactionId,
        String cardLastFour,
        String cardType,

        // Bank transfer details
        String referenceNumber,

        // UPI details
        String upiId,

        // Refund info
        BigDecimal refundedAmount,
        boolean isRefundable,
        BigDecimal refundableAmount,
        String refundReason,
        OffsetDateTime refundedAt,

        // Metadata
        String processedBy,
        OffsetDateTime paymentDate,
        OffsetDateTime createdAt,
        String notes,

        // Travel agent billing
        UUID travelAgentId
) {}
