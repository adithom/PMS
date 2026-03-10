package com.adith.os.HMS.billing.folio;

public enum ChargeCode {

    ROOM_RENT(ChargeCategory.ROOM_RENT),
    RESTAURANT(ChargeCategory.ANCILLARY),
    LAUNDRY(ChargeCategory.ANCILLARY),
    SPA(ChargeCategory.ANCILLARY),
    TRAVEL_DESK(ChargeCategory.ANCILLARY),
    SHOP(ChargeCategory.ANCILLARY),
    MISC(ChargeCategory.ANCILLARY);

    private final ChargeCategory category;

    ChargeCode(ChargeCategory category) {
        this.category = category;
    }

    public ChargeCategory getCategory() {
        return category;
    }

    public boolean isRoomRent() {
        return this.category == ChargeCategory.ROOM_RENT;
    }

    public boolean isAncillary() {
        return this.category == ChargeCategory.ANCILLARY;
    }
}
