package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.PosLocationType;

import java.math.BigDecimal;
import java.time.LocalTime;

public record PosLocationUpdateDto(
        String name,
        PosLocationType locationType,
        BigDecimal defaultTaxRate,
        BigDecimal serviceChargeRate,
        LocalTime openingTime,
        LocalTime closingTime,
        Boolean isActive
) {}
