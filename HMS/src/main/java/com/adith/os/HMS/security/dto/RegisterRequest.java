package com.adith.os.HMS.security.dto;

import com.adith.os.HMS.security.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Set;
import java.util.UUID;

public record RegisterRequest(
        @NotBlank(message = "Username is required")
        String username,

        @NotBlank(message = "Password is required")
        String password,

        String email,

        @NotNull(message = "Role is required")
        Role role,

        Set<String> propertyIds,

        UUID posLocationId
) {}