package com.adith.os.HMS.travelagent.dto;

import jakarta.validation.constraints.NotBlank;

public record ContactPersonCreationDto(
        @NotBlank(message = "Contact name is required")
        String name,

        String phone,
        String email,
        String designation
) {
}
