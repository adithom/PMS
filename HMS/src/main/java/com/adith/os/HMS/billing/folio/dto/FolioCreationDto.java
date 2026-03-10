package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.FolioType;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FolioCreationDto(
        UUID bookingId,  // Optional - null for walk-ins

        @NotNull(message = "Guest ID is required")
        UUID guestId,

        FolioType folioType,  // Default MASTER if null

        String notes,

        String createdBy
) {
}
