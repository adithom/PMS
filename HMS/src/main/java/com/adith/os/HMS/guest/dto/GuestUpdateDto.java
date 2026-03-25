package com.adith.os.HMS.guest.dto;

import com.adith.os.HMS.guest.GuestIdType;
import jakarta.validation.constraints.Email;

public record GuestUpdateDto(
        String firstName,

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