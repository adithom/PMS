package com.adith.os.HMS.guest.dto;

import com.adith.os.HMS.guest.GuestIdType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record GuestCreationDto(
        @NotBlank(message = "First name is required")
        String firstName,

        @NotBlank(message = "Last name is required")
        String lastName,

        @Email(message = "Invalid email format")
        String email,

        String phone,

        String idNumber,

        GuestIdType guestIdType,

        String preferences,
        
        java.time.LocalDate dateOfBirth
) {
}