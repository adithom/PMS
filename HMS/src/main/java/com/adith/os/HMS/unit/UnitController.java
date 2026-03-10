package com.adith.os.HMS.unit;

import com.adith.os.HMS.unit.dto.UnitCreationDto;
import com.adith.os.HMS.unit.dto.UnitDto;
import com.adith.os.HMS.unit.dto.UnitUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/units")
public class UnitController {
    private final UnitService unitService;

    public UnitController(UnitService unitService) {
        this.unitService = unitService;
    }

    //create
    @PostMapping()
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitDto> createUnit(@PathVariable UUID propertyId, @Valid @RequestBody UnitCreationDto unitCreationDto) {
        try {
            UnitDto createdUnit = unitService.createUnit(unitCreationDto, propertyId);
            return new ResponseEntity<>(createdUnit, HttpStatus.CREATED);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    //read
    @GetMapping("/{id}")
    public ResponseEntity<UnitDto> getUnitById(@PathVariable UUID id) {
        UnitDto unitDto = unitService.getUnitById(id);
        return ResponseEntity.ok(unitDto);
    }

    @GetMapping("/name/{name}")
    public ResponseEntity<UnitDto> getUnitByName(@PathVariable String name) {
        UnitDto unitDto = unitService.getUnitByName(name);
        return ResponseEntity.ok(unitDto);
    }

    @GetMapping
    public ResponseEntity<List<UnitDto>> getAllUnitsForProperty(@PathVariable UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        List<UnitDto> units = unitService.getUnitsByProperty(propertyId);
        return ResponseEntity.ok(units);
    }


    // UPDATE operations
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitDto> updateUnit(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @Valid @RequestBody UnitUpdateDto unitUpdateDto) {
        UnitDto updatedUnit = unitService.updateUnit(propertyId, id, unitUpdateDto);
        return ResponseEntity.ok(updatedUnit);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitDto> partialUpdateUnit(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestBody UnitUpdateDto unitUpdateDto) {
        UnitDto updatedUnit = unitService.partialUpdateUnit(propertyId, id, unitUpdateDto);
        return ResponseEntity.ok(updatedUnit);
    }

    // DELETE operation
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteUnit(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        unitService.deleteUnit(propertyId, id);
        return ResponseEntity.noContent().build();
    }

}
