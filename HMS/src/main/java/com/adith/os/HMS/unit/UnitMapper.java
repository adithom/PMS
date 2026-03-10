package com.adith.os.HMS.unit;

import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.unit.dto.UnitCreationDto;
import com.adith.os.HMS.unit.dto.UnitDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class UnitMapper {
    public Unit toEntity(@Valid UnitCreationDto unitCreationDto, Property property) {
        if (unitCreationDto == null) return null;
        if (property == null) throw new IllegalArgumentException("Property is required");

        String name = unitCreationDto.name() != null ? unitCreationDto.name().trim() : null;
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Unit name cannot be blank");
        }

        Unit unit = new Unit();
        unit.setProperty(property);
        unit.setName(name);
        unit.setSortOrder(unitCreationDto.sortOrder() != null ? unitCreationDto.sortOrder() : 0);

        return unit;

    }

    public UnitDto toDto(Unit unit) {
        if (unit == null) return null;

        return new UnitDto(
                unit.getId(),
                unit.getName(),
                unit.getProperty().getCode(),
                unit.getSortOrder(),
                unit.getTotalRooms()
        );
    }

    public List<UnitDto> toDtoList(List<Unit> units) {
        if (units == null || units.isEmpty()) {
            return List.of();
        }

        return units.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}
