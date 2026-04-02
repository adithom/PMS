package com.adith.os.HMS.travelagent.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TravelAgentDto(
        UUID id,
        String name,
        String contactPerson,
        String email,
        String phone,
        String iataCode,
        BigDecimal commissionRate,
        boolean active,
        String address,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
