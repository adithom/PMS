package com.adith.os.HMS.unit;

import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.unit.dto.UnitCreationDto;
import com.adith.os.HMS.unit.dto.UnitDto;
import com.adith.os.HMS.unit.dto.UnitUpdateDto;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class UnitService {

    private final PropertyRepository propertyRepository;
    private final UnitRepository unitRepository;
    private final UnitMapper unitMapper;

    public UnitService(PropertyRepository propertyRepository, UnitRepository unitRepository, UnitMapper unitMapper) {
        this.propertyRepository = propertyRepository;
        this.unitRepository = unitRepository;
        this.unitMapper = unitMapper;
    }

    @Transactional
    public UnitDto createUnit(@Valid UnitCreationDto unitCreationDto, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));
        if (unitCreationDto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit creation data is required");
        }

        if (unitRepository.existsByNameAndPropertyId(unitCreationDto.name(), propertyId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Unit with name " + unitCreationDto.name() + " already exists");
        }

        try {
            Unit unit = unitMapper.toEntity(unitCreationDto, property);
            Unit savedUnit = unitRepository.save(unit);
            return unitMapper.toDto(savedUnit);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create unit: " + e.getMessage());
        }
    }

    public UnitDto getUnitById(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit id is required");
        }

        Unit unit = unitRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + id));

        return unitMapper.toDto(unit);
    }

    public UnitDto getUnitByName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit name is required");
        }

        String cleanName = name.trim();
        Unit unit = unitRepository.findByName(cleanName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found for name: " + cleanName));

        return unitMapper.toDto(unit);
    }

    public List<UnitDto> getUnitsByProperty(UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        // Verify property exists
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Unit> units = unitRepository.findByPropertyIdOrderBySortOrder(propertyId);
            return unitMapper.toDtoList(units);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch units for property: " + e.getMessage());
        }
    }

    @Transactional
    public UnitDto updateUnit(UUID propertyId, UUID unitId, @Valid UnitUpdateDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (unitId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + unitId));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        if (dto.name() == null || dto.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit name is required for full update");
        }

        // Check for duplicate name within the same property (excluding current unit)
        String cleanName = dto.name().trim();
        if (!cleanName.equals(unit.getName()) &&
                unitRepository.existsByNameAndPropertyId(cleanName, propertyId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Unit with name '" + cleanName + "' already exists in this property");
        }

        try {
            // Full update (PUT semantics)
            unit.setName(cleanName);
            unit.setSortOrder(dto.sortOrder() != null ? dto.sortOrder() : 0);

            Unit savedUnit = unitRepository.save(unit);
            return unitMapper.toDto(savedUnit);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update unit: " + e.getMessage());
        }
    }

    @Transactional
    public UnitDto partialUpdateUnit(UUID propertyId, UUID unitId, UnitUpdateDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (unitId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        // Verify property exists
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        // Find unit and verify it belongs to the property
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + unitId));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        try {
            // Partial update (PATCH semantics - only update provided fields)
            if (dto.name() != null && !dto.name().isBlank()) {
                String cleanName = dto.name().trim();
                if (!cleanName.equals(unit.getName()) &&
                        unitRepository.existsByNameAndPropertyId(cleanName, propertyId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Unit with name '" + cleanName + "' already exists in this property");
                }
                unit.setName(cleanName);
            }

            if (dto.sortOrder() != null) {
                unit.setSortOrder(dto.sortOrder());
            }

            Unit savedUnit = unitRepository.save(unit);
            return unitMapper.toDto(savedUnit);
        } catch (ResponseStatusException e) {
            throw e; // Re-throw our custom exceptions
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to partially update unit: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteUnit(UUID propertyId, UUID unitId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (unitId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required");
        }

        // Verify property exists
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        // Find unit and verify it belongs to the property
        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + unitId));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        try {
            unitRepository.delete(unit);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to delete unit: " + e.getMessage());
        }
    }
}
