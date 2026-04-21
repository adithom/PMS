package com.adith.os.HMS.booking.dto;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BookingDto(
        @NotNull
        UUID id,

        @NotNull
        UUID propertyId,

        String roomNumber,  // Nullable if room not assigned

        @NotNull
        UUID guestId,

        @NotBlank
        String guestName,

        UUID unitId,

        String unitName,

        @NotNull
        BookingStatus status,  // CHANGED: Now using BookingStatus enum instead of String

        @JsonFormat(pattern = "yyyy-MM-dd")
        @NotNull
        LocalDate checkIn,

        @JsonFormat(pattern = "yyyy-MM-dd")
        @NotNull
        LocalDate checkOut,

        @NotNull
        Long stayDuration,

        @NotNull
        Integer adults,

        @NotNull
        Integer children,

        @NotBlank
        String currency,

        @NotNull
        BigDecimal totalPrice,

        @NotNull
        BigDecimal paidAmount,

        @NotNull
        BigDecimal balanceDue,

        Boolean isFullyPaid,

        String specialRequests,  // ADDED: Special requests field (can be null)

        @NotNull
        OffsetDateTime createdAt,

        Double paymentProgress,

        UUID parentBookingId, // null if not a child booking

        Boolean isGroupMaster,

        int childBookingCount, // 0 for regular/child bookings
        
        Boolean isTwinBed,

        String referenceNumber,

        UUID travelAgentId,
        String travelAgentName,
        BigDecimal commissionRate,

        MealPlanType mealPlanType,
        String mealPlanDisplayName,
        BigDecimal mealPlanPricePerNight,
        BigDecimal mealPlanChildrenPricePerNight,

        Integer extraBeds,
        BigDecimal extraBedRatePerNight,
        ChargeCode extraBedChargeCode
) {
    // Compact constructor for validation and defaults
    public BookingDto {
        // Ensure balanceDue is never null
        if (balanceDue == null) {
            balanceDue = BigDecimal.ZERO;
        }
        // Calculate isFullyPaid if not provided
        if (isFullyPaid == null) {
            isFullyPaid = balanceDue.compareTo(BigDecimal.ZERO) <= 0;
        }

        
    }
}
