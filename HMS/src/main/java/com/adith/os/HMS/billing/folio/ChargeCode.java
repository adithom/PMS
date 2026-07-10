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
     *
     * @deprecated use {@link #computeRoomRentBreakdown(BigDecimal)} when the tax rate is also
     * needed — deriving it separately from the returned ex-tax amount (e.g. via
     * {@link #computeRoomRentTaxRate(BigDecimal)}) can pick the wrong GST slab for inclusive
     * rates near the ₹7500 threshold, since dividing by 1.18 can push the ex-tax amount back
     * below 7500 even though the 18% slab was the correct one.
     */
    @Deprecated
    public static BigDecimal computeExTaxFromInclusive(BigDecimal inclusiveRate) {
        return computeRoomRentBreakdown(inclusiveRate).exTaxAmount();
    }

    /**
     * Ex-tax amount and GST rate for a GST-inclusive room rate, decided together from a single
     * slab check so the two numbers can never disagree about which slab applies. Slab: if
     * (inclusive / 1.05) ≤ 7500 → 5% GST; otherwise → 18% GST.
     */
    public static RoomRentBreakdown computeRoomRentBreakdown(BigDecimal inclusiveRate) {
        if (inclusiveRate == null || inclusiveRate.compareTo(BigDecimal.ZERO) <= 0) {
            return new RoomRentBreakdown(BigDecimal.ZERO, new BigDecimal("5.00"));
        }
        BigDecimal at5pct = inclusiveRate.divide(new BigDecimal("1.05"), 10, RoundingMode.HALF_UP);
        boolean eighteenPercentSlab = at5pct.compareTo(new BigDecimal("7500")) > 0;
        BigDecimal taxRate = eighteenPercentSlab ? new BigDecimal("18.00") : new BigDecimal("5.00");
        BigDecimal divisor = eighteenPercentSlab ? new BigDecimal("1.18") : new BigDecimal("1.05");
        BigDecimal exTaxAmount = inclusiveRate.divide(divisor, 2, RoundingMode.HALF_UP);
        return new RoomRentBreakdown(exTaxAmount, taxRate);
    }

    public record RoomRentBreakdown(BigDecimal exTaxAmount, BigDecimal taxRate) {}
}
