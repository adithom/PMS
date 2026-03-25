package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Represents one room slot within a group booking request.
 *
 * unitId is required — it tells the system which room type/category to book.
 * roomId is optional — if provided, that specific room is reserved; otherwise
 * the unit category is reserved and room assignment happens at check-in.
 *
 * childGuestId is optional — if omitted, the group organizer is used as the guest.
 */
public record GroupRoomRequestDto(

        @NotNull(message = "Unit ID is required for each room request")
        UUID unitId,

        // Optional: pin to a specific room
        UUID roomId,

        // Optional: who is actually staying in this room
        UUID childGuestId,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        @PositiveOrZero(message = "Total price cannot be negative")
        BigDecimal totalPrice,

        String specialRequests,

        Boolean isTwinBed
) {
    public GroupRoomRequestDto {
        if (adults == null) adults = 1;
        if (children == null) children = 0;
        if (totalPrice == null) totalPrice = BigDecimal.ZERO;
    }
}
