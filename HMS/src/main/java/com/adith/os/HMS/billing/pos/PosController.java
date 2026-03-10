package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.pos.dto.PosLocationCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosLocationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderDto;
import com.adith.os.HMS.billing.pos.dto.PosProductCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosProductDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<List<PosLocationDto>> getLocations(@RequestParam UUID propertyId) {
        return ResponseEntity.ok(posService.getLocations(propertyId));
    }

    @GetMapping("/products")
    public ResponseEntity<List<PosProductDto>> getProducts(@RequestParam UUID locationId) {
        return ResponseEntity.ok(posService.getProducts(locationId));
    }

    @PostMapping("/locations")
    public ResponseEntity<PosLocationDto> createLocation(@Valid @RequestBody PosLocationCreationDto dto) {
        return ResponseEntity.ok(posService.createLocation(dto));
    }

    @PostMapping("/products")
    public ResponseEntity<PosProductDto> createProduct(@Valid @RequestBody PosProductCreationDto dto) {
        return ResponseEntity.ok(posService.createProduct(dto));
    }

    @PostMapping("/orders")
    public ResponseEntity<PosOrderDto> createOrder(@Valid @RequestBody PosOrderCreationDto dto) {
        return ResponseEntity.ok(posService.createOrder(dto));
    }

    @PostMapping("/orders/{orderId}/charge")
    public ResponseEntity<PosOrderDto> chargeOrderToFolio(
            @PathVariable UUID orderId,
            @RequestParam UUID folioId) {
        return ResponseEntity.ok(posService.chargeOrderToFolio(orderId, folioId));
    }
}
