package com.adith.os.HMS.billing.folio;

import java.math.BigDecimal;

public enum ChargeCode {

    ROOM_RENT(ChargeCategory.ROOM_RENT, new BigDecimal("12.00")),
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
}