package com.adith.os.HMS.travelagent.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record TravelAgentDto(
        UUID id,
        String name,
        String email,
        String phone,
        String gstin,
        boolean active,
        String address,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<ContactPersonDto> contactPersons
) {
}
