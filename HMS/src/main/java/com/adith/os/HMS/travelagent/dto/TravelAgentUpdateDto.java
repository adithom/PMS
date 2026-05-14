package com.adith.os.HMS.travelagent.dto;

import jakarta.validation.constraints.Email;

public record TravelAgentUpdateDto(
        String name,

        @Email(message = "Invalid email format")
        String email,

        String phone,

        String gstin,

        Boolean active,

        String address
) {
}
