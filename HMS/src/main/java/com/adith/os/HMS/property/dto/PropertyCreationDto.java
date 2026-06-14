package com.adith.os.HMS.property.dto;

import jakarta.validation.constraints.NotBlank;

public record PropertyCreationDto(
        @NotBlank String name,
        @NotBlank String code,
        String address,
        String addressLine2,
        String region,
        String country,
        String postalCode,
        String phone,
        String gstNumber,
        String checkInTime,
        String checkOutTime,
        String cin,
        String udyamRegistrationNo,
        String pan,
        String stateName,
        String stateCode,
        String fssaiNumber
) {}
