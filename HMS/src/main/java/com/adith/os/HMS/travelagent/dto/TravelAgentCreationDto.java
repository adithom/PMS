package com.adith.os.HMS.travelagent.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public record TravelAgentCreationDto(
        @NotBlank(message = "Agency name is required")
        String name,

        String contactPerson,

        @Email(message = "Invalid email format")
        String email,

        String phone,

        String iataCode,

        @DecimalMin(value = "0.00", message = "Commission rate cannot be negative")
        @DecimalMax(value = "100.00", message = "Commission rate cannot exceed 100%")
        BigDecimal commissionRate,

        String address
) {
}
