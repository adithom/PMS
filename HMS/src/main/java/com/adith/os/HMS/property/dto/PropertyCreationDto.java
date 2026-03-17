package com.adith.os.HMS.property.dto;

import jakarta.validation.constraints.NotBlank;

import java.sql.Time;

public record PropertyCreationDto(
        @NotBlank String name,
        @NotBlank String code,
        String address,
        String region,
        String country,
        String postalCode,
        String phone,
        String gstNumber,

        Time checkInTime,
        Time checkOutTime
) {}
