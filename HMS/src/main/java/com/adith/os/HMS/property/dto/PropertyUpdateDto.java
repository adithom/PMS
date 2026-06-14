package com.adith.os.HMS.property.dto;

import java.math.BigDecimal;

public record PropertyUpdateDto(
        String name,
        String code,
        String address,
        String addressLine2,
        String region,
        String country,
        String postalCode,
        String phone,
        String gstNumber,
        String checkInTime,
        String checkOutTime,
        BigDecimal extraBedRatePerNight,
        String cin,
        String udyamRegistrationNo,
        String pan,
        String stateName,
        String stateCode,
        String fssaiNumber
) {}
