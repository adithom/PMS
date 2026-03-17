package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.pos.dto.*;
import com.adith.os.HMS.property.PropertyRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PosService {

    private final PosLocationRepository posLocationRepository;
    private final PosProductRepository posProductRepository;
    private final PosOrderRepository posOrderRepository;
    private final PropertyRepository propertyRepository;
    private final FolioService folioService;

    public PosService(PosLocationRepository posLocationRepository,
            PosProductRepository posProductRepository,
            PosOrderRepository posOrderRepository,
            PropertyRepository propertyRepository,
            FolioService folioService) {
        this.posLocationRepository = posLocationRepository;
        this.posProductRepository = posProductRepository;
        this.posOrderRepository = posOrderRepository;
        this.propertyRepository = propertyRepository;
        this.folioService = folioService;
    }

    public List<PosLocationDto> getLocations(UUID propertyId) {
        return posLocationRepository.findByPropertyId(propertyId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<PosProductDto> getProducts(UUID locationId) {
        return posProductRepository.findByPosLocationId(locationId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PosOrderDto createOrder(PosOrderCreationDto dto) {
        PosLocation location = posLocationRepository.findById(dto.posLocationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        PosOrder order = new PosOrder();
        order.setPosLocation(location);
        order.setProperty(location.getProperty());
        order.setStatus(PosOrderStatus.OPEN);
        order.setOrderType("DINE_IN"); // Default, could be passed in DTO
        order.setPaymentStatus("PENDING");

        List<PosOrderItem> items = dto.items().stream()
                .map(itemDto -> {
                    PosProduct product = posProductRepository.findById(itemDto.posProductId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
                    PosOrderItem item = new PosOrderItem();
                    item.setPosOrder(order);
                    item.setPosProduct(product);
                    item.setItemName(product.getName());
                    item.setQuantity(itemDto.quantity());
                    item.setUnitPrice(product.getPrice());

                    // Use product tax rate, fallback to location default, fallback to 0
                    BigDecimal taxRate = product.getTaxRate() != null ? product.getTaxRate()
                            : (location.getDefaultTaxRate() != null ? location.getDefaultTaxRate() : BigDecimal.ZERO);
                    item.setTaxRate(taxRate);

                    item.calculateSubtotal();
                    return item;
                })
                .collect(Collectors.toList());

        order.setItems(items);
        order.calculateTotal();

        PosOrder savedOrder = posOrderRepository.save(order);
        return toDto(savedOrder);
    }

    @Transactional
    public PosOrderDto chargeOrderToFolio(UUID orderId, UUID folioId) {
        PosOrder order = posOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getStatus() != PosOrderStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order is not open");
        }

        // Derive charge code from location type
        com.adith.os.HMS.billing.folio.ChargeCode chargeCode = order.getPosLocation().getLocationType() != null
                ? order.getPosLocation().getLocationType().toChargeCode()
                : com.adith.os.HMS.billing.folio.ChargeCode.MISC;

        // Add charge to folio
        ChargeCreationDto chargeDto = new ChargeCreationDto(
                LocalDate.now(),
                chargeCode,
                "POS Order: " + order.getOrderNumber(),
                order.getSubtotal(), // <--- Pass Subtotal instead of TotalAmount
                BigDecimal.ONE,
                null,
                BigDecimal.ZERO,
                "POS_ORDER",
                order.getId(),
                "Charged from POS",
                "SYSTEM");

        UUID propertyId = order.getProperty().getId();

        folioService.addCharge(propertyId, folioId, chargeDto);

        order.setStatus(PosOrderStatus.CHARGED);
        order.setPaymentStatus("CHARGED_TO_FOLIO");
        order.setCompletedAt(OffsetDateTime.now());

        // We can't easily set the folio entity without fetching it, but the link is in
        // FolioCharge

        return toDto(posOrderRepository.save(order));
    }

    @Transactional
    public PosLocationDto createLocation(PosLocationCreationDto dto) {
        com.adith.os.HMS.property.Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        PosLocation location = new PosLocation();
        location.setProperty(property);
        location.setName(dto.name());
        location.setCode(dto.code());
        location.setLocationType(dto.locationType());
        location.setDefaultTaxRate(dto.defaultTaxRate());
        location.setServiceChargeRate(dto.serviceChargeRate() != null ? dto.serviceChargeRate() : BigDecimal.ZERO);
        location.setOpeningTime(dto.openingTime());
        location.setClosingTime(dto.closingTime());
        location.setActive(true);

        PosLocation savedLocation = posLocationRepository.save(location);
        return toDto(savedLocation);
    }

    @Transactional
    public PosProductDto createProduct(PosProductCreationDto dto) {
        PosLocation location = posLocationRepository.findById(dto.locationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        PosProduct product = new PosProduct();
        product.setPosLocation(location);
        product.setName(dto.name());
        product.setCode(dto.code());
        product.setDescription(dto.description());
        product.setCategory(dto.category());
        product.setPrice(dto.price());
        product.setCost(dto.cost());

        // Use provided tax rate or fallback to location default
        BigDecimal taxRate = dto.taxRate() != null ? dto.taxRate() : location.getDefaultTaxRate();
        product.setTaxRate(taxRate);

        product.setAvailable(dto.isAvailable());
        product.setPreparationTime(dto.preparationTime());
        product.setImageUrl(dto.imageUrl());

        PosProduct savedProduct = posProductRepository.save(product);
        return toDto(savedProduct);
    }

    // Helper methods for DTO conversion
    private PosLocationDto toDto(PosLocation entity) {
        return new PosLocationDto(
                entity.getId(),
                entity.getName(),
                entity.getCode(),
                entity.getLocationType(),
                entity.getProperty().getId(),
                entity.getDefaultTaxRate());
    }

    private PosProductDto toDto(PosProduct entity) {
        return new PosProductDto(
                entity.getId(),
                entity.getName(),
                entity.getCode(),
                entity.getDescription(),
                entity.getPrice(),
                entity.getCost(),
                entity.getCategory(),
                entity.getPosLocation().getId(),
                entity.getTaxRate(),
                entity.isAvailable(),
                entity.getPreparationTime(),
                entity.getImageUrl());
    }

    private PosOrderDto toDto(PosOrder entity) {
        return new PosOrderDto(
                entity.getId(),
                entity.getOrderNumber(),
                entity.getPosLocation().getId(),
                entity.getStatus(),
                entity.getTotalAmount(),
                entity.getFolio() != null ? entity.getFolio().getId() : null,
                entity.getItems() != null ? entity.getItems().stream().map(this::toDto).collect(Collectors.toList())
                        : null,
                entity.getCreatedAt(),
                entity.getCompletedAt(),
                entity.getProperty().getId(),
                entity.getBooking() != null ? entity.getBooking().getId() : null,
                entity.getRoom() != null ? entity.getRoom().getId() : null,
                entity.getOrderType(),
                entity.getOrderDate(),
                entity.getSubtotal(),
                entity.getTaxAmount(),
                entity.getServiceCharge(),
                entity.getDiscountAmount(),
                entity.getPaymentStatus(),
                entity.getTableNumber(),
                entity.getGuestName(),
                entity.getSpecialInstructions(),
                entity.getCreatedBy(),
                entity.getServedBy());
    }

    private PosOrderItemDto toDto(PosOrderItem entity) {
        return new PosOrderItemDto(
                entity.getId(),
                entity.getPosProduct().getId(),
                entity.getItemName(),
                entity.getQuantity(),
                entity.getUnitPrice(),
                entity.getSubtotal(),
                entity.getTaxRate(),
                entity.getTaxAmount(),
                entity.getTotalAmount(),
                entity.getSpecialInstructions(),
                entity.getStatus());
    }
}
