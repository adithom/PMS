package com.adith.os.HMS.property;

import com.adith.os.HMS.property.dto.PropertyCreationDto;
import com.adith.os.HMS.property.dto.PropertyDto;
import com.adith.os.HMS.property.dto.PropertyUpdateDto;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties")
public class PropertyController {

    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    //create
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PropertyDto> createProperty(@Valid @RequestBody PropertyCreationDto propertyCreationDto) {
        try {
            PropertyDto createdProperty = propertyService.createProperty(propertyCreationDto);
            return new ResponseEntity<>(createdProperty, HttpStatus.CREATED);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    //read
    @GetMapping("/{id}")
    public ResponseEntity<PropertyDto> getPropertyById(@PathVariable UUID id) {
        PropertyDto property = propertyService.getPropertyById(id);
        return ResponseEntity.ok(property);
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<PropertyDto> getPropertyByCode(@PathVariable String code) {
        PropertyDto property = propertyService.getPropertyByCode(code);
        return ResponseEntity.ok(property);
    }

    @GetMapping
    public ResponseEntity<List<PropertyDto>> getAllProperties(
            @RequestParam(value = "q", required = false) String searchQuery,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "region", required = false) String region,
            @RequestParam(value = "page", required = false) Integer page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sort", defaultValue = "name") String sortBy,
            @RequestParam(value = "direction", defaultValue = "asc") String sortDirection) {

        List<PropertyDto> properties;

        // Handle pagination if requested
        if (page != null) {
            Sort sort = Sort.by(sortDirection.equalsIgnoreCase("desc") ?
                    Sort.Direction.DESC : Sort.Direction.ASC, sortBy);
            Pageable pageable = PageRequest.of(page, size, sort);

            Page<PropertyDto> propertyPage = propertyService.getAllProperties(pageable);

            // Add pagination headers
            return ResponseEntity.ok()
                    .header("X-Total-Count", String.valueOf(propertyPage.getTotalElements()))
                    .header("X-Page-Number", String.valueOf(propertyPage.getNumber()))
                    .header("X-Page-Size", String.valueOf(propertyPage.getSize()))
                    .header("X-Total-Pages", String.valueOf(propertyPage.getTotalPages()))
                    .body(propertyPage.getContent());
        }

        // Handle search and filtering
        if (searchQuery != null && !searchQuery.trim().isEmpty()) {
            properties = propertyService.searchPropertiesByName(searchQuery.trim());
        } else if (country != null && !country.trim().isEmpty()) {
            properties = propertyService.getPropertiesByCountry(country.trim());
        } else if (region != null && !region.trim().isEmpty()) {
            properties = propertyService.getPropertiesByRegion(region.trim());
        } else {
            properties = propertyService.getAllProperties();
        }

        return ResponseEntity.ok(properties);
    }

    @GetMapping("/search")
    public ResponseEntity<List<PropertyDto>> searchProperties(
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "region", required = false) String region,
            @RequestParam(value = "minRooms", required = false) Integer minRooms,
            @RequestParam(value = "maxRooms", required = false) Integer maxRooms) {

        List<PropertyDto> properties = propertyService.searchProperties(name, country, region, minRooms, maxRooms);
        return ResponseEntity.ok(properties);
    }

    //update
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PropertyDto> updateProperty(
            @PathVariable UUID id,
            @Valid @RequestBody PropertyUpdateDto propertyUpdateDto) {
        PropertyDto updatedProperty = propertyService.updateProperty(id, propertyUpdateDto);
        return ResponseEntity.ok(updatedProperty);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PropertyDto> partialUpdateProperty(
            @PathVariable UUID id,
            @RequestBody PropertyUpdateDto propertyUpdateDto) {
        PropertyDto updatedProperty = propertyService.partialUpdateProperty(id, propertyUpdateDto);
        return ResponseEntity.ok(updatedProperty);
    }

    //delete
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteProperty(@PathVariable UUID id) {
        propertyService.deleteProperty(id);
        return ResponseEntity.noContent().build();
    }

}
