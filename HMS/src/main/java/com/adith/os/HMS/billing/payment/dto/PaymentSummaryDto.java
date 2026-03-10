package com.adith.os.HMS.billing.payment.dto;

import com.adith.os.HMS.billing.payment.PaymentMethod;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * DTO for payment reports and summaries
 */
public record PaymentSummaryDto(
        LocalDate date,
        BigDecimal totalAmount,
        int paymentCount,
        List<PaymentMethodBreakdown> methodBreakdown
) {}