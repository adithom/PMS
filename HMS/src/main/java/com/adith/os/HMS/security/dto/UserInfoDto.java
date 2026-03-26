package com.adith.os.HMS.security.dto;

import java.util.List;

public record UserInfoDto(
        String id,
        String username,
        String email,
        String role,
        List<PropertyInfo> properties,
        String posLocationId,
        String posLocationName
) {
    public record PropertyInfo(String id, String name) {}
}