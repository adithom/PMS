package com.adith.os.HMS.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GroupBookingCreationDto(

        @NotNull(message = "Organizer guest ID is required")
        UUID organizerGuestId,

        @NotNull(message = "Check-in date is required")
        @FutureOrPresent(message = "Check-in date cannot be in the past")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @NotNull(message = "At least one room request is required")
        @NotEmpty(message = "At least one room request is required")
        @Valid
        List<GroupRoomRequestDto> roomRequests,

        String groupReference,

        String specialRequests,

        String currency,

        GroupBillingMode billingMode,

        UUID travelAgentId
) {
    public GroupBookingCreationDto {
        if (currency == null || currency.isBlank()) currency = "INR";
        if (billingMode == null) billingMode = GroupBillingMode.SEPARATE;
    }

    public enum GroupBillingMode {
        SEPARATE,       // Each room settles independently
        CONSOLIDATED    // All charges route to the organizer's folio
    }
}