package com.adith.os.HMS.billing.folio;

public enum FolioType {
    MASTER,    // Main folio for booking
    GUEST,     // Individual guest folio
    GROUP,     // Group folio
    WALK_IN    // Shared POS walk-in folio, stays open until manually posted
}
