package com.adith.os.HMS.travelagent.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record TravelAgentCreationDto(
        @NotBlank(message = "Agency name is required")
        String name,

        @Email(message = "Invalid email format")
        String email,

        String phone,

        String gstin,

        String address
) {
}
