package com.adith.os.HMS.billing.folio;

import java.math.BigDecimal;
import java.math.RoundingMode;

public enum ChargeCode {

    ROOM_RENT(ChargeCategory.ROOM_RENT, new BigDecimal("5.00")),
    MEAL_PLAN(ChargeCategory.MEAL_PLAN, new BigDecimal("5.00")),
    RESTAURANT(ChargeCategory.ANCILLARY, new BigDecimal("5.00")),
    LAUNDRY(ChargeCategory.ANCILLARY, new BigDecimal("18.00")),
    SPA(ChargeCategory.ANCILLARY, new BigDecimal("18.00")),
    TRAVEL_DESK(ChargeCategory.ANCILLARY, new BigDecimal("18.00")),
    SHOP(ChargeCategory.ANCILLARY, new BigDecimal("18.00")),
    MISC(ChargeCategory.ANCILLARY, new BigDecimal("18.00"));

    private final ChargeCategory category;
    private final BigDecimal defaultTaxRate;

    ChargeCode(ChargeCategory category, BigDecimal defaultTaxRate) {
        this.category = category;
        this.defaultTaxRate = defaultTaxRate;
    }

    public ChargeCategory getCategory() {
        return category;
    }

    public BigDecimal getDefaultTaxRate() {
        return defaultTaxRate;
    }

    public boolean isRoomRent() {
        return this.category == ChargeCategory.ROOM_RENT;
    }

    public boolean isAncillary() {
        return this.category == ChargeCategory.ANCILLARY;
    }

    public boolean isMealPlan() {
        return this.category == ChargeCategory.MEAL_PLAN;
    }

    public static BigDecimal computeRoomRentTaxRate(BigDecimal nightlyRate) {
        if (nightlyRate == null || nightlyRate.compareTo(new BigDecimal("7500")) <= 0) {
            return new BigDecimal("5.00");
        }
        return new BigDecimal("18.00");
    }

    /**
     * Back-calculate ex-tax amount from a GST-inclusive room rate.
     * Slab: if (inclusive / 1.05) ≤ 7500 → 5% GST; otherwise → 18% GST.
     * Mirrors the frontend computeRoomRentExTax() function.
     */
    public static BigDecimal computeExTaxFromInclusive(BigDecimal inclusiveRate) {
        if (inclusiveRate == null || inclusiveRate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal at5pct = inclusiveRate.divide(new BigDecimal("1.05"), 10, RoundingMode.HALF_UP);
        BigDecimal divisor = at5pct.compareTo(new BigDecimal("7500")) <= 0
                ? new BigDecimal("1.05")
                : new BigDecimal("1.18");
        return inclusiveRate.divide(divisor, 2, RoundingMode.HALF_UP);
    }
}
