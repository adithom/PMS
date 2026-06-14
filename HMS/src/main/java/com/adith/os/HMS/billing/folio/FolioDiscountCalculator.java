package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.bills.BillType;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Stateless utility for computing folio-level discount amounts.
 * Shared by FolioService (balance recomputation) and BillMapper (bill PDF totals).
 */
public class FolioDiscountCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private FolioDiscountCalculator() {}

    /** Total room folio discount applied to non-voided, non-routed ROOM_RENT + MEAL_PLAN charges. */
    public static BigDecimal computeRoomDiscountAmount(Folio folio) {
        if (folio.getRoomDiscountType() == null || folio.getRoomDiscountValue() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal base = folio.getCharges().stream()
                .filter(c -> !c.isVoided() && !c.isRouteToMaster())
                .filter(c -> c.getChargeCode().getCategory() == ChargeCategory.ROOM_RENT
                          || c.getChargeCode().getCategory() == ChargeCategory.MEAL_PLAN)
                .map(FolioCharge::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return applyDiscount(folio.getRoomDiscountType(), folio.getRoomDiscountValue(), base);
    }

    /** Total ancillary folio discount applied to non-voided, non-routed ANCILLARY charges. */
    public static BigDecimal computeAncillaryDiscountAmount(Folio folio) {
        if (folio.getAncillaryDiscountType() == null || folio.getAncillaryDiscountValue() == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal base = folio.getCharges().stream()
                .filter(c -> !c.isVoided() && !c.isRouteToMaster())
                .filter(c -> c.getChargeCode().getCategory() == ChargeCategory.ANCILLARY)
                .map(FolioCharge::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return applyDiscount(folio.getAncillaryDiscountType(), folio.getAncillaryDiscountValue(), base);
    }

    /**
     * Discount amount for a specific bill at PDF generation time.
     * For split ancillary bills, applies a proportional share of the ancillary discount.
     *
     * @param folio           the folio (for discount config)
     * @param billType        type of the bill being generated
     * @param billChargesTotal sum of non-voided charge totalAmounts in this bill
     */
    public static BigDecimal computeDiscountForBill(Folio folio, BillType billType, BigDecimal billChargesTotal) {
        if (billType == BillType.ROOM_RENT) {
            if (folio.getRoomDiscountType() == null || folio.getRoomDiscountValue() == null) return BigDecimal.ZERO;
            return applyDiscount(folio.getRoomDiscountType(), folio.getRoomDiscountValue(), billChargesTotal);
        }
        // ANCILLARY or granular split type (RESTAURANT, SPA, etc.)
        if (folio.getAncillaryDiscountType() == null || folio.getAncillaryDiscountValue() == null) return BigDecimal.ZERO;
        if (billType == BillType.ANCILLARY) {
            return applyDiscount(folio.getAncillaryDiscountType(), folio.getAncillaryDiscountValue(), billChargesTotal);
        }
        // Split ancillary bill: proportional share of total ancillary discount
        BigDecimal allAncillaryTotal = folio.getCharges().stream()
                .filter(c -> !c.isVoided() && !c.isRouteToMaster())
                .filter(c -> c.getChargeCode().getCategory() == ChargeCategory.ANCILLARY)
                .map(FolioCharge::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allAncillaryTotal.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        BigDecimal fullDiscount = applyDiscount(folio.getAncillaryDiscountType(), folio.getAncillaryDiscountValue(), allAncillaryTotal);
        return fullDiscount.multiply(billChargesTotal).divide(allAncillaryTotal, 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal applyDiscount(DiscountType type, BigDecimal value, BigDecimal base) {
        if (type == DiscountType.FLAT) {
            return value.min(base);
        }
        return base.multiply(value).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }
}
