package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.billing.pos.dto.*;
import com.adith.os.HMS.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pos")
public class PosController {

    private final PosService posService;

    public PosController(PosService posService) {
        this.posService = posService;
    }

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

    @PostMapping("/locations/{id}/post-walkin-folio")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<FolioDto> postWalkInFolio(@PathVariable UUID id) {
        return ResponseEntity.ok(posService.postWalkInFolio(id));
    }

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

    @PostMapping("/orders")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosOrderDto> createOrder(
            @Valid @RequestBody PosOrderCreationDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(posService.createOrder(dto, principal.getUsername()));
    }

    @PostMapping("/orders/{orderId}/charge")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosOrderDto> chargeOrderToFolio(
            @PathVariable UUID orderId,
            @RequestParam UUID folioId) {
        return ResponseEntity.ok(posService.chargeOrderToFolio(orderId, folioId));
    }

    @PostMapping("/orders/{orderId}/settle")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosOrderDto> settleOrder(
            @PathVariable UUID orderId,
            @Valid @RequestBody PosSettleDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(posService.settleOrder(orderId, dto, principal.getUsername()));
    }
}
