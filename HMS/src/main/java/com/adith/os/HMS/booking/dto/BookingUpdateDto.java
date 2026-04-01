package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.booking.BookingStatus;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BookingUpdateDto(
        UUID roomId,

        UUID guestId,

        UUID unitId,

        LocalDate checkIn,

        LocalDate checkOut,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        String currency,

        BigDecimal totalPrice,

        BigDecimal paidAmount,

        BookingStatus status,

        String specialRequests,

        Boolean isTwinBed,

        String referenceNumber,

        UUID travelAgentId,         // null = no change (PATCH) or remove agent (PUT)

        Boolean clearTravelAgent    // PATCH only: if true, explicitly removes travel agent
  ) {
}
