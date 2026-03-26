package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.PosLocationType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record PosLocationCreationDto(
        @NotNull UUID propertyId,
        @NotBlank String name,
        @NotNull PosLocationType locationType,
        @NotNull BigDecimal defaultTaxRate,
        BigDecimal serviceChargeRate,
        LocalTime openingTime,
        LocalTime closingTime) {
}
