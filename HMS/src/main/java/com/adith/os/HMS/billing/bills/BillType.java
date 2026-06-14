package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.ChargeCode;

import java.util.Arrays;
import java.util.Set;

/**
 * Bill types used for invoice generation.
 *
 * Default (consolidated) mode produces two bills per folio:
 *   ROOM_RENT  — everything posted by night audit (room rent + meal plan)
 *   ANCILLARY  — all other charges (restaurant, spa, laundry, travel desk, shop, misc)
 *
 * Split mode (opt-in at generation time) produces one bill per granular type
 * using the remaining entries (RESTAURANT, SPA, LAUNDRY, TRAVEL_DESK, SHOP, MISC).
 *
 * Declaration order defines invoice suffix assignment: the first present bill
 * gets the base invoice number, each subsequent present bill gets a/b/c/d/e/f.
 */
public enum BillType {

    ROOM_RENT   ("Main",             Set.of(ChargeCode.ROOM_RENT, ChargeCode.MEAL_PLAN)),
    ANCILLARY   ("Ancillary",        Set.of(ChargeCode.RESTAURANT, ChargeCode.LAUNDRY, ChargeCode.SPA,
                                            ChargeCode.TRAVEL_DESK, ChargeCode.SHOP, ChargeCode.MISC)),
    RESTAURANT  ("Restaurant",       Set.of(ChargeCode.RESTAURANT)),
    SPA         ("Spa",              Set.of(ChargeCode.SPA)),
    LAUNDRY     ("Laundry",          Set.of(ChargeCode.LAUNDRY)),
    TRAVEL_DESK ("Travel Desk",      Set.of(ChargeCode.TRAVEL_DESK)),
    SHOP        ("Gift Shop",        Set.of(ChargeCode.SHOP)),
    MISC        ("Miscellaneous",    Set.of(ChargeCode.MISC));

    private final String displayLabel;
    private final Set<ChargeCode> chargeCodes;

    BillType(String displayLabel, Set<ChargeCode> chargeCodes) {
        this.displayLabel = displayLabel;
        this.chargeCodes  = chargeCodes;
    }

    public String getDisplayLabel() { return displayLabel; }
    public Set<ChargeCode> getChargeCodes() { return chargeCodes; }

    /** Used in split mode — maps a ChargeCode to its granular bill type. */
    public static BillType forChargeCode(ChargeCode code) {
        // Prefer the granular split types (RESTAURANT, SPA, etc.) over the consolidated ANCILLARY umbrella.
        return Arrays.stream(values())
                .filter(bt -> bt != ANCILLARY && bt.chargeCodes.contains(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No BillType for ChargeCode: " + code));
    }

    /** Used in consolidated mode — maps any ChargeCode to either ROOM_RENT or ANCILLARY. */
    public static BillType consolidatedTypeFor(ChargeCode code) {
        if (ROOM_RENT.chargeCodes.contains(code)) return ROOM_RENT;
        return ANCILLARY;
    }
}
