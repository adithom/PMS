package com.adith.os.HMS.guest.dto;

import com.adith.os.HMS.guest.GuestIdType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.UUID;

public record GuestDto(
        @NotNull UUID id,
        @NotBlank String firstName,
        String lastName,

        @NotBlank String fullName,

        @Email String email,

        String phone,

        String idNumber,

        GuestIdType guestIdType,

        @NotNull OffsetDateTime createdAt,

        String preferences,
        
        java.time.LocalDate dateOfBirth
) {
}
