package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.folio.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/folios")
public class FolioController {

    private final FolioService folioService;

    public FolioController(FolioService folioService) {
        this.folioService = folioService;
    }

    // CREATE
    @PostMapping
    public ResponseEntity<FolioDto> createFolio(
            @PathVariable UUID propertyId,
            @Valid @RequestBody FolioCreationDto folioCreationDto) {
        try {
            FolioDto createdFolio = folioService.createFolio(propertyId, folioCreationDto);
            return new ResponseEntity<>(createdFolio, HttpStatus.CREATED);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    // READ
    @GetMapping("/{id}")
    public ResponseEntity<FolioDto> getFolioById(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        FolioDto folio = folioService.getFolioById(propertyId, id);
        return ResponseEntity.ok(folio);
    }

    @GetMapping("/{id}/details")
    public ResponseEntity<FolioDetailDto> getFolioDetails(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        FolioDetailDto folioDetails = folioService.getFolioDetails(propertyId, id);
        return ResponseEntity.ok(folioDetails);
    }

    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<FolioDto> getFolioByBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId) {
        FolioDto folio = folioService.getFolioByBooking(propertyId, bookingId);
        return ResponseEntity.ok(folio);
    }

    @GetMapping("/booking/{bookingId}/all")
    public ResponseEntity<List<FolioDto>> getAllFoliosByBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId) {
        List<FolioDto> folios = folioService.getAllFoliosByBooking(propertyId, bookingId);
        return ResponseEntity.ok(folios);
    }

    @GetMapping("/open")
    public ResponseEntity<List<FolioDto>> getOpenFolios(@PathVariable UUID propertyId) {
        List<FolioDto> folios = folioService.getOpenFolios(propertyId);
        return ResponseEntity.ok(folios);
    }

    // CHARGES
    @PostMapping("/{id}/charges")
    public ResponseEntity<FolioDto> addCharge(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @Valid @RequestBody ChargeCreationDto chargeCreationDto) {
        FolioDto updatedFolio = folioService.addCharge(propertyId, id, chargeCreationDto);
        return ResponseEntity.ok(updatedFolio);
    }

    @PatchMapping("/{id}/charges/{chargeId}")
    public ResponseEntity<FolioDto> updateCharge(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable UUID chargeId,
            @Valid @RequestBody ChargeUpdateDto dto) {
        FolioDto updatedFolio = folioService.updateCharge(propertyId, id, chargeId, dto);
        return ResponseEntity.ok(updatedFolio);
    }

    @DeleteMapping("/{id}/charges/{chargeId}/void")
    public ResponseEntity<FolioDto> voidCharge(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable UUID chargeId,
            @RequestParam String reason,
            @RequestParam(required = false) String voidedBy) {
        FolioDto updatedFolio = folioService.voidCharge(propertyId, id, chargeId, reason, voidedBy);
        return ResponseEntity.ok(updatedFolio);
    }

    /**
     * Per-charge route-to-master flag. Sets the routeToMaster flag on a single charge;
     * bill generation honors it on the next invoice.
     */
    @PatchMapping("/{id}/charges/{chargeId}/route")
    public ResponseEntity<FolioDto> setChargeRoute(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable UUID chargeId,
            @Valid @RequestBody ChargeRouteUpdateDto dto) {
        FolioDto updatedFolio = folioService.setChargeRoute(propertyId, id, chargeId, dto.routeToMaster());
        return ResponseEntity.ok(updatedFolio);
    }

    // DISCOUNTS
    @PutMapping("/{id}/discounts/{billType}")
    public ResponseEntity<FolioDto> setDiscount(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable String billType,
            @Valid @RequestBody FolioDiscountDto dto) {
        return ResponseEntity.ok(folioService.setDiscount(propertyId, id, billType, dto));
    }

    @DeleteMapping("/{id}/discounts/{billType}")
    public ResponseEntity<FolioDto> deleteDiscount(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable String billType) {
        return ResponseEntity.ok(folioService.deleteDiscount(propertyId, id, billType));
    }

    // STATUS CHANGES
    @PatchMapping("/{id}/close")
    public ResponseEntity<FolioDto> closeFolio(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestParam(required = false) String closedBy) {
        FolioDto closedFolio = folioService.closeFolio(propertyId, id, closedBy);
        return ResponseEntity.ok(closedFolio);
    }

    @PatchMapping("/{id}/post")
    public ResponseEntity<FolioDto> postFolio(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        FolioDto postedFolio = folioService.postFolio(propertyId, id);
        return ResponseEntity.ok(postedFolio);
    }

    @PatchMapping("/{id}/reopen")
    public ResponseEntity<FolioDto> reopenFolio(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestParam(required = false) String reopenedBy) {
        FolioDto reopenedFolio = folioService.reopenFolio(propertyId, id, reopenedBy);
        return ResponseEntity.ok(reopenedFolio);
    }
}