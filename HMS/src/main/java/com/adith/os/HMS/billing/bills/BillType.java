package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.ChargeCode;

import java.util.Arrays;
import java.util.Set;

/**
 * One bill type per charge code group. Replaces the coarse ROOM_RENT/ANCILLARY
 * ChargeCategory split previously used on Bill and GroupBill entities.
 *
 * Declaration order defines invoice suffix assignment: the first present bill
 * gets the base invoice number, each subsequent present bill gets a/b/c/d/e/f.
 */
public enum BillType {

    ROOM_RENT   ("Room & Meal Plan", Set.of(ChargeCode.ROOM_RENT, ChargeCode.MEAL_PLAN)),
    RESTAURANT  ("Restaurant",       Set.of(ChargeCode.RESTAURANT)),
    SPA         ("Spa",              Set.of(ChargeCode.SPA)),
    LAUNDRY     ("Laundry",          Set.of(ChargeCode.LAUNDRY)),
    TRAVEL_DESK ("Travel Desk",      Set.of(ChargeCode.TRAVEL_DESK)),
    SHOP        ("Gift Shop",        Set.of(ChargeCode.SHOP)),
    MISC        ("Miscellaneous",    Set.of(ChargeCode.MISC)),

    /** Legacy value kept for backward compatibility with pre-multi-bill DB rows. Not used for new bill generation. */
    @Deprecated
    ANCILLARY   ("Ancillary",        Set.of());

    private final String displayLabel;
    private final Set<ChargeCode> chargeCodes;

    BillType(String displayLabel, Set<ChargeCode> chargeCodes) {
        this.displayLabel = displayLabel;
        this.chargeCodes  = chargeCodes;
    }

    public String getDisplayLabel() { return displayLabel; }
    public Set<ChargeCode>  getChargeCodes()  { return chargeCodes; }

    public static BillType forChargeCode(ChargeCode code) {
        return Arrays.stream(values())
                .filter(bt -> bt.chargeCodes.contains(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No BillType for ChargeCode: " + code));
    }
}
