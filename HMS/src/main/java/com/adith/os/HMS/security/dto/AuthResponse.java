package com.adith.os.HMS.security.dto;

import com.adith.os.HMS.security.Role;

import java.util.Set;

public record AuthResponse(
        String token,
        String username,
        String email,
        Role role,
        Set<PropertyInfo> properties
) {
    public record PropertyInfo(String id, String name) {}
}
