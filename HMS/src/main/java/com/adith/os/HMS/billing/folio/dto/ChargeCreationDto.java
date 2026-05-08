package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ChargeCreationDto(
        @NotNull(message = "Charge date is required")
        LocalDate chargeDate,

        @NotNull(message = "Charge code is required")
        ChargeCode chargeCode,

        String description,

        @NotNull(message = "Unit price is required")
        @Positive(message = "Unit price must be positive")
        BigDecimal unitPrice,

        BigDecimal quantity,  // Default 1

        BigDecimal taxRate,  // Default 0

        BigDecimal discountRate,  // Default 0

        String referenceType,  // "ROOM", "POS_ORDER", etc.

        UUID referenceId,

        String notes,

        String postedBy,

        Boolean routeToMaster
) {}