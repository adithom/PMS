package com.adith.os.HMS.property.dto;

import java.util.UUID;

public record PropertyDto(
        UUID id,
        String name,
        String code,
        String address,
        String country,
        Integer totalRooms
) {}

