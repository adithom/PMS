package com.adith.os.HMS.property;

import com.adith.os.HMS.property.dto.PropertyCreationDto;
import com.adith.os.HMS.property.dto.PropertyDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.sql.Time;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class PropertyMapper {

    /** Accepts "HH:mm" or "HH:mm:ss"; returns null for blank/null input. */
    private Time parseTime(String s) {
        if (s == null || s.isBlank()) return null;
        return Time.valueOf(s.length() == 5 ? s + ":00" : s);
    }

    public Property toEntity(@Valid PropertyCreationDto dto) {
        if (dto == null) {
            return null;
        }

        Property property = new Property();
        property.setName(dto.name());
        property.setCode(dto.code().toUpperCase());
        property.setAddress(dto.address());
        property.setAddressLine2(dto.addressLine2());
        property.setRegion(dto.region());
        property.setCountry(dto.country() != null ? dto.country() : "IN");
        property.setPostalCode(dto.postalCode());
        property.setCheckInTime(parseTime(dto.checkInTime()));
        property.setCheckOutTime(parseTime(dto.checkOutTime()));
        property.setPhone(dto.phone());
        property.setGstNumber(dto.gstNumber());
        property.setCin(dto.cin());
        property.setUdyamRegistrationNo(dto.udyamRegistrationNo());
        property.setPan(dto.pan());
        property.setStateName(dto.stateName());
        property.setStateCode(dto.stateCode());
        property.setFssaiNumber(dto.fssaiNumber());

        return property;
    }

    public PropertyDto toDto(Property property) {
        if (property == null) {
            return null;
        }

        return new PropertyDto(
                property.getId(),
                property.getName(),
                property.getCode(),
                property.getAddress(),
                property.getAddressLine2(),
                property.getRegion(),
                property.getPostalCode(),
                property.getPhone(),
                property.getCountry(),
                property.getTotalRooms(),
                property.getGstNumber(),
                property.getExtraBedRatePerNight(),
                property.getCin(),
                property.getUdyamRegistrationNo(),
                property.getPan(),
                property.getStateName(),
                property.getStateCode(),
                property.getFssaiNumber(),
                property.getCheckInTime() != null ? property.getCheckInTime().toString().substring(0, 5) : null,
                property.getCheckOutTime() != null ? property.getCheckOutTime().toString().substring(0, 5) : null
        );
    }

    public List<PropertyDto> toDtoList(List<Property> properties) {
        if (properties == null || properties.isEmpty()) return List.of();
        return properties.stream().map(this::toDto).collect(Collectors.toList());
    }
}
