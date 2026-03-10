package com.adith.os.HMS.billing.folio;

public enum FolioStatus {
    OPEN,      // Currently accepting charges
    CLOSED,    // No more charges, ready for payment
    POSTED     // Finalized and archived
}
