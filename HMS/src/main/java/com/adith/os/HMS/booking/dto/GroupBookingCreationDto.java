package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.travelagent.dto.TravelAgentCreationDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * DTO for creating a group booking.
 *
 * One GroupBookingCreationDto creates:
 *   - 1 parent (master) booking with isGroupMaster=true and no unit/room
 *   - N child bookings, one per entry in roomRequests
 *
 * The organizerGuestId is the person making the reservation (the group contact).
 * Each child booking can optionally specify its own guest (e.g. the actual room occupant).
 * If childGuestId is omitted on a room request, the organizer is used.
 */
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

        // Human-readable group identifier, e.g. "WEDDING-SHARMA-DEC25"
        String groupReference,

        String specialRequests,

        String currency,

        /**
         * Billing mode for the group.
         * SEPARATE  - each room pays its own folio independently (default)
         * CONSOLIDATED - all child folios are routed to the organizer's master folio
         */
        GroupBillingMode billingMode,

        UUID travelAgentId,          // Optional — reference an existing travel agent

        @Valid
        TravelAgentCreationDto newTravelAgent  // Optional — create a new travel agent inline
) {
    public GroupBookingCreationDto {
        if (currency == null || currency.isBlank()) currency = "INR";
        if (billingMode == null) billingMode = GroupBillingMode.SEPARATE;
        if (travelAgentId != null && newTravelAgent != null) {
            throw new IllegalArgumentException("Provide either travelAgentId OR newTravelAgent, not both");
        }
    }

    public enum GroupBillingMode {
        SEPARATE,       // Each room settles independently
        CONSOLIDATED    // All charges route to the organizer's folio
    }
}