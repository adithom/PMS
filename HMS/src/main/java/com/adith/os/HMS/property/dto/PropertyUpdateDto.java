package com.adith.os.HMS.property.dto;

import java.sql.Time;

public record PropertyUpdateDto(
        String name,
        String code,
        String address,
        String region,
        String country,
        String postalCode,
        String phone,
        String gstNumber,
        Time checkInTime,
        Time checkOutTime
) {}
