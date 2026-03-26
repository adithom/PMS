package com.adith.os.HMS.security.dto;

import com.adith.os.HMS.security.Role;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record UpdateUserRequest(
        String email,
        String password,
        @NotNull(message = "Role is required")
        Role role,
        Set<String> propertyIds,
        String posLocationId
) {}
