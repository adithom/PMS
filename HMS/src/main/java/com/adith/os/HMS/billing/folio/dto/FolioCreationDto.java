package com.adith.os.HMS.billing.folio.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FolioCreationDto(
        UUID bookingId,  // Optional - null for walk-ins

        @NotNull(message = "Guest ID is required")
        UUID guestId,

        String notes,

        String createdBy
) {
}
