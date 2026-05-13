package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.billing.pos.dto.*;
import com.adith.os.HMS.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pos")
public class PosController {

    private final PosService posService;

    public PosController(PosService posService) {
        this.posService = posService;
    }

    // ──────────────── Locations ────────────────

    @GetMapping("/locations")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'POS', 'FRONTDESK')")
    public ResponseEntity<List<PosLocationDto>> getLocations(@RequestParam UUID propertyId) {
        return ResponseEntity.ok(posService.getLocations(propertyId));
    }

    @PostMapping("/locations")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosLocationDto> createLocation(@Valid @RequestBody PosLocationCreationDto dto) {
        return ResponseEntity.ok(posService.createLocation(dto));
    }

    @PutMapping("/locations/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosLocationDto> updateLocation(
            @PathVariable UUID id,
            @RequestBody PosLocationUpdateDto dto) {
        return ResponseEntity.ok(posService.updateLocation(id, dto));
    }

    // ──────────────── Categories ────────────────

    @GetMapping("/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'POS')")
    public ResponseEntity<List<PosItemCategoryDto>> getCategories(@RequestParam UUID locationId) {
        return ResponseEntity.ok(posService.getCategories(locationId));
    }

    @PostMapping("/categories")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosItemCategoryDto> createCategory(@Valid @RequestBody PosItemCategoryCreationDto dto) {
        return ResponseEntity.ok(posService.createCategory(dto));
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosItemCategoryDto> updateCategory(
            @PathVariable UUID id,
            @RequestBody PosItemCategoryUpdateDto dto) {
        return ResponseEntity.ok(posService.updateCategory(id, dto));
    }

    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Void> deleteCategory(@PathVariable UUID id) {
        posService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────── Products ────────────────

    @GetMapping("/products")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'POS')")
    public ResponseEntity<List<PosProductDto>> getProducts(@RequestParam UUID locationId) {
        return ResponseEntity.ok(posService.getProducts(locationId));
    }

    @PostMapping("/products")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosProductDto> createProduct(@Valid @RequestBody PosProductCreationDto dto) {
        return ResponseEntity.ok(posService.createProduct(dto));
    }

    @PutMapping("/products/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PosProductDto> updateProduct(
            @PathVariable UUID id,
            @RequestBody PosProductUpdateDto dto) {
        return ResponseEntity.ok(posService.updateProduct(id, dto));
    }

    @DeleteMapping("/products/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Void> deleteProduct(@PathVariable UUID id) {
        posService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────── Order History (MANAGER only) ────────────────

    @GetMapping("/orders")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<PosOrderDto>> getOrders(
            @RequestParam UUID locationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) PosOrderStatus status) {
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime fromDt = from.atStartOfDay(ist).toOffsetDateTime();
        OffsetDateTime toDt = to.plusDays(1).atStartOfDay(ist).toOffsetDateTime();
        return ResponseEntity.ok(posService.getOrders(locationId, fromDt, toDt, status));
    }

    @GetMapping("/orders/summary")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<OrderSummaryDto> getOrderSummary(
            @RequestParam UUID locationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime fromDt = from.atStartOfDay(ist).toOffsetDateTime();
        OffsetDateTime toDt = to.plusDays(1).atStartOfDay(ist).toOffsetDateTime();
        return ResponseEntity.ok(posService.getOrderSummary(locationId, fromDt, toDt));
    }
}
