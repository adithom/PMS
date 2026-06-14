package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ChargeDto(
        UUID id,
        LocalDate chargeDate,
        OffsetDateTime postingDate,
        ChargeCode chargeCode,
        String description,
        String referenceType,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal subtotal,
        BigDecimal taxRate,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        boolean isVoided,
        String voidReason,
        String notes
) {}