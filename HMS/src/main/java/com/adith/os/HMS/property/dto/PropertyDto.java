package com.adith.os.HMS.property.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record PropertyDto(
        UUID id,
        String name,
        String code,
        String address,
        String addressLine2,
        String region,
        String postalCode,
        String phone,
        String country,
        Integer totalRooms,
        String gstNumber,
        BigDecimal extraBedRatePerNight,
        String cin,
        String udyamRegistrationNo,
        String pan,
        String stateName,
        String stateCode,
        String fssaiNumber,
        String checkInTime,
        String checkOutTime
) {}

