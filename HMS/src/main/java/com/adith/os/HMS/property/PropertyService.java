package com.adith.os.HMS.property;

import com.adith.os.HMS.property.dto.PropertyCreationDto;
import com.adith.os.HMS.property.dto.PropertyDto;
import com.adith.os.HMS.property.dto.PropertyUpdateDto;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Time;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

@Service
public class PropertyService {

    private final PropertyMapper propertyMapper;
    private final PropertyRepository propertyRepository;

    public PropertyService(PropertyMapper propertyMapper, PropertyRepository propertyRepository) {
        this.propertyMapper = propertyMapper;
        this.propertyRepository = propertyRepository;
    }

    private Time parseTime(String s) {
        if (s == null || s.isBlank()) return null;
        return Time.valueOf(s.length() == 5 ? s + ":00" : s);
    }

    @Transactional
    public PropertyDto createProperty(@Valid PropertyCreationDto propertyCreationDto) throws Exception {
        if (propertyCreationDto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property creation data is required");
        }

        if (propertyRepository.existsByCode(propertyCreationDto.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Property with code " + propertyCreationDto.code() + " already exists");
        }

        try {
            Property property = propertyMapper.toEntity(propertyCreationDto);
            Property savedProperty = propertyRepository.save(property);
            return propertyMapper.toDto(savedProperty);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create property: " + e.getMessage());
        }
    }

    public PropertyDto getPropertyById(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property id is required");
        }
        return propertyRepository.findById(id)
                .map(propertyMapper::toDto)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + id));
    }

    public List<PropertyDto> getAllProperties() {
        List<Property> properties = propertyRepository.findAll();
        return propertyMapper.toDtoList(properties);
    }

    // Method WITH pagination
    public Page<PropertyDto> getAllProperties(Pageable pageable) {
        Page<Property> propertyPage = propertyRepository.findAll(pageable);
        // Convert Page<Property> to Page<PropertySummaryDto>
        return propertyPage.map(propertyMapper::toDto);
    }

    public List<PropertyDto> searchPropertiesByName(String name) {
        if (name == null || name.isBlank()) {
            return List.of();
        }
        try {
            String searchTerm = name.trim();
            return propertyRepository.findByNameContainingIgnoreCase(searchTerm)
                    .stream()
                    .map(propertyMapper::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to search properties by name: " + e.getMessage());
        }
    }

    public List<PropertyDto> getPropertiesByCountry(String country) {
        if (country == null || country.isBlank()) {
            return List.of();
        }
        try {
            String cleanCountry = country.trim();
            return propertyRepository.findByCountry(cleanCountry)
                    .stream()
                    .map(propertyMapper::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch properties by country: " + e.getMessage());
        }
    }

    public List<PropertyDto> getPropertiesByRegion(String region) {
        if (region == null || region.isBlank()) {
            return List.of();
        }
        try {
            String cleanRegion = region.trim();
            return propertyRepository.findByRegion(cleanRegion)
                    .stream()
                    .map(propertyMapper::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch properties by region: " + e.getMessage());
        }
    }

    public PropertyDto getPropertyByCode(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property code is required");
        }
        String c = code.trim();
        return propertyRepository.findByCode(c)
                .map(propertyMapper::toDto)
                .orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found for code: " + c));
    }

    @Transactional
    public PropertyDto updateProperty(UUID id, @Valid PropertyUpdateDto dto) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property id is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update payload is required");
        }

        Property entity = propertyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + id));

        if (dto.code() == null || dto.code().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property code is required");
        }
        String newCode = dto.code().trim();

        if (!newCode.equals(entity.getCode())) {
            propertyRepository.findByCode(newCode).ifPresent(clash -> {
                if (!clash.getId().equals(id)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Another property already uses code: " + newCode);
                }
            });
        }

        if (dto.name() == null || dto.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property name is required");
        }

        // Replace all updatable fields (PUT semantics)
        entity.setName(dto.name());
        entity.setCode(newCode);
        entity.setRegion(dto.region());
        entity.setAddress(dto.address());
        entity.setAddressLine2(dto.addressLine2());
        entity.setCheckInTime(parseTime(dto.checkInTime()));
        entity.setCheckOutTime(parseTime(dto.checkOutTime()));
        entity.setPhone(dto.phone());
        entity.setPostalCode(dto.postalCode());
        entity.setCountry(dto.country());
        entity.setGstNumber(dto.gstNumber());
        entity.setExtraBedRatePerNight(dto.extraBedRatePerNight());
        entity.setCin(dto.cin());
        entity.setUdyamRegistrationNo(dto.udyamRegistrationNo());
        entity.setPan(dto.pan());
        entity.setStateName(dto.stateName());
        entity.setStateCode(dto.stateCode());
        entity.setFssaiNumber(dto.fssaiNumber());

        Property saved = propertyRepository.save(entity);
        return propertyMapper.toDto(saved);
    }

    @Transactional
    public PropertyDto partialUpdateProperty(UUID id, PropertyUpdateDto dto) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property id is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update payload is required");
        }

        Property entity = propertyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + id));

        if (dto.code() != null && !dto.code().isBlank()) {
            String newCode = dto.code().trim();
            if (!newCode.equals(entity.getCode())) {
                propertyRepository.findByCode(newCode).ifPresent(clash -> {
                    if (!clash.getId().equals(id)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Another property already uses code: " + newCode);
                    }
                });
            }
            entity.setCode(newCode);
        }

        if (dto.name() != null) {
            String name = dto.name().trim();
            if (name.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name cannot be blank");
            }
            entity.setName(name);
        }

        if (dto.region() != null) {
            entity.setRegion(dto.region());
        }
        if (dto.country() != null) {
            entity.setCountry(dto.country());
        }
        if (dto.phone() != null) {
            entity.setPhone(dto.phone());
        }
        if (dto.postalCode() != null) {
            entity.setPostalCode(dto.postalCode());
        }
        if (dto.address() != null) {
            entity.setAddress(dto.address());
        }
        if (dto.addressLine2() != null) {
            entity.setAddressLine2(dto.addressLine2());
        }
        if (dto.checkInTime() != null) {
            entity.setCheckInTime(parseTime(dto.checkInTime()));
        }
        if (dto.checkOutTime() != null) {
            entity.setCheckOutTime(parseTime(dto.checkOutTime()));
        }
        if (dto.gstNumber() != null) {
            entity.setGstNumber(dto.gstNumber());
        }
        if (dto.extraBedRatePerNight() != null) {
            entity.setExtraBedRatePerNight(dto.extraBedRatePerNight());
        }
        if (dto.cin() != null) {
            entity.setCin(dto.cin());
        }
        if (dto.udyamRegistrationNo() != null) {
            entity.setUdyamRegistrationNo(dto.udyamRegistrationNo());
        }
        if (dto.pan() != null) {
            entity.setPan(dto.pan());
        }
        if (dto.stateName() != null) {
            entity.setStateName(dto.stateName());
        }
        if (dto.stateCode() != null) {
            entity.setStateCode(dto.stateCode());
        }
        if (dto.fssaiNumber() != null) {
            entity.setFssaiNumber(dto.fssaiNumber());
        }

        Property saved = propertyRepository.save(entity);
        return propertyMapper.toDto(saved);
    }

    public List<PropertyDto> searchProperties(String name, String country, String region, Integer minRooms, Integer maxRooms) {
        // Validate range
        if (minRooms != null && minRooms < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "minRooms cannot be negative");
        }
        if (maxRooms != null && maxRooms < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "maxRooms cannot be negative");
        }
        if (minRooms != null && maxRooms != null && minRooms > maxRooms) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "minRooms cannot exceed maxRooms");
        }

        Specification<Property> spec = (root, query, cb) -> cb.conjunction();

        if (hasText(name)) {
            String term = name.trim().toLowerCase();
            spec = spec.and((root, q, cb) ->
                    cb.like(cb.lower(root.get("name")), "%" + term + "%"));
        }

        if (hasText(country)) {
            String c = country.trim().toLowerCase();
            spec = spec.and((root, q, cb) ->
                    cb.equal(cb.lower(root.get("country")), c));
        }

        if (hasText(region)) {
            String r = region.trim().toLowerCase();
            spec = spec.and((root, q, cb) ->
                    cb.equal(cb.lower(root.get("region")), r)); // ensure 'region' exists on Property
        }

        if (minRooms != null && minRooms > 0) {
            spec = spec.and((root, q, cb) -> cb.greaterThanOrEqualTo(root.get("totalRooms"), minRooms));
        }
        if (maxRooms != null && maxRooms > 0) {
            spec = spec.and((root, q, cb) -> cb.lessThanOrEqualTo(root.get("totalRooms"), maxRooms));
        }

        try {
            return propertyRepository.findAll(spec).stream()
                    .map(propertyMapper::toDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to search properties: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteProperty(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property id is required");
        }
        try {
            Property entity = propertyRepository.findById(id)
                    .orElseThrow(() ->
                            new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + id));

            propertyRepository.delete(entity); // or propertyRepository.deleteById(id);
        } catch (DataIntegrityViolationException e) {
            // Likely foreign key references (rooms/bookings/folios, etc.)
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete property because it is referenced by other records.",
                    e
            );
        } catch (EmptyResultDataAccessException e) {
            // In case deleteById was used directly and nothing was deleted
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + id, e);
        }
    }
}
