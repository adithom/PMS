package com.adith.os.HMS.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EarlyCheckoutRequestDto(
        @NotNull(message = "New check-out date is required")
        LocalDate newCheckOutDate,

        @NotBlank(message = "Early checkout policy is required")
        String policy, // "NO_CHANGE", "REFUND_UNUSED_NIGHTS", or "CUSTOM"

        // This is optional and only used if policy is "CUSTOM"
        BigDecimal customRoomCharge
) {}