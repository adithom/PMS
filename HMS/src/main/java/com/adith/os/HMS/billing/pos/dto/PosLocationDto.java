package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.pos.PosLocationType;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record PosLocationDto(
        UUID id,
        String name,
        String code,
        PosLocationType locationType,
        UUID propertyId,
        ChargeCode defaultChargeCode,
        BigDecimal defaultTaxRate,
        BigDecimal serviceChargeRate,
        LocalTime openingTime,
        LocalTime closingTime,
        boolean isActive,
        UUID currentWalkInFolioId
) {
    // Convenience constructor used by PosService.toDto
    public PosLocationDto(UUID id, String name, String code, PosLocationType locationType, UUID propertyId,
            BigDecimal defaultTaxRate, BigDecimal serviceChargeRate, LocalTime openingTime,
            LocalTime closingTime, boolean isActive, UUID currentWalkInFolioId) {
        this(id, name, code, locationType, propertyId,
                locationType != null ? locationType.toChargeCode() : ChargeCode.MISC,
                defaultTaxRate, serviceChargeRate, openingTime, closingTime, isActive, currentWalkInFolioId);
    }
}
