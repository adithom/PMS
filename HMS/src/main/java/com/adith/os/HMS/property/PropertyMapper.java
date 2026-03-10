package com.adith.os.HMS.property;

import com.adith.os.HMS.property.dto.PropertyCreationDto;
import com.adith.os.HMS.property.dto.PropertyDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PropertyMapper {

    public Property toEntity(@Valid PropertyCreationDto dto) {
        if (dto == null) {
            return null;
        }

        Property property = new Property();
        property.setName(dto.name());
        property.setCode(dto.code().toUpperCase());
        property.setAddress(dto.address());
        property.setRegion(dto.region());
        property.setCountry(dto.country() != null ? dto.country() : "IN");
        property.setPostalCode(dto.postalCode());
        property.setCheckInTime(dto.checkInTime());
        property.setCheckOutTime(dto.checkOutTime());
        property.setPhone(dto.phone());

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
                property.getCountry(),
                property.getTotalRooms()
        );
    }

    public List<PropertyDto> toDtoList(List<Property> properties) {
        if (properties == null || properties.isEmpty()) return List.of();
        return properties.stream().map(this::toDto).collect(Collectors.toList());
    }
}
