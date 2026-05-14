package com.adith.os.HMS.travelagent.dto;

import java.util.UUID;

public record ContactPersonDto(
        UUID id,
        String name,
        String phone,
        String email,
        String designation
) {
}
