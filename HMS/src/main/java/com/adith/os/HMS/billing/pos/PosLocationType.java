package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.ChargeCode;

public enum PosLocationType {
    RESTAURANT(ChargeCode.RESTAURANT),
    BAR(ChargeCode.RESTAURANT),
    SPA(ChargeCode.SPA),
    BAKERY(ChargeCode.RESTAURANT),
    LAUNDRY(ChargeCode.LAUNDRY),
    SHOP(ChargeCode.SHOP);

    private final ChargeCode chargeCode;

    PosLocationType(ChargeCode chargeCode) {
        this.chargeCode = chargeCode;
    }

    public ChargeCode toChargeCode() {
        return chargeCode;
    }
}
