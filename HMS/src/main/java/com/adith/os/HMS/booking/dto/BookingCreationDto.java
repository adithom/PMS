package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.booking.BookingStatus;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static com.adith.os.HMS.booking.BookingStatus.PENDING;

public record BookingCreationDto(
        UUID roomId,  // Optional

        @NotNull(message = "Guest ID is required")
        UUID guestId,

        UUID unitId,

        BookingStatus status,

        @NotNull(message = "Check-in date is required")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @Positive(message = "Adults must be at least 1")
        Integer adults,

        @PositiveOrZero(message = "Children cannot be negative")
        Integer children,

        String currency,  // Defaults to "INR"

        @PositiveOrZero(message = "Total price cannot be negative")
        BigDecimal totalPrice,

        @PositiveOrZero(message = "Paid amount cannot be negative")
        BigDecimal paidAmount,

        String specialRequests,

        UUID parentBookingId,       // Set when creating a child booking individually
        String groupReference,       // e.g. "WEDDING-SHARMA-2025", purely informational

        Boolean isTwinBed

) {
    public BookingCreationDto {
        if (adults == null) {
            adults = 1;
        }
        if (children == null) {
            children = 0;
        }
        if (currency == null || currency.isBlank()) {
            currency = "INR";
        }
        if (status == null) {
            status = PENDING;
        }
        if (totalPrice == null) {
            totalPrice = BigDecimal.ZERO;
        }
        if (paidAmount == null) {
            paidAmount = BigDecimal.ZERO;
        }
    }
}
