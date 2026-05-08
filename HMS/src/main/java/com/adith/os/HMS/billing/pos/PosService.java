package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.billing.payment.PaymentService;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.pos.dto.*;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final PosItemCategoryRepository posItemCategoryRepository;
    private final PropertyRepository propertyRepository;
    private final FolioService folioService;
    private final FolioRepository folioRepository;
    private final GuestRepository guestRepository;
    private final PaymentService paymentService;

    public PosService(PosLocationRepository posLocationRepository,
            PosProductRepository posProductRepository,
            PosOrderRepository posOrderRepository,
            PosItemCategoryRepository posItemCategoryRepository,
            PropertyRepository propertyRepository,
            FolioService folioService,
            FolioRepository folioRepository,
            GuestRepository guestRepository,
            PaymentService paymentService) {
        this.posLocationRepository = posLocationRepository;
        this.posProductRepository = posProductRepository;
        this.posOrderRepository = posOrderRepository;
        this.posItemCategoryRepository = posItemCategoryRepository;
        this.propertyRepository = propertyRepository;
        this.folioService = folioService;
        this.folioRepository = folioRepository;
        this.guestRepository = guestRepository;
        this.paymentService = paymentService;
    }

    // ──────────────── Location methods ────────────────

    public List<PosLocationDto> getLocations(UUID propertyId) {
        return posLocationRepository.findByPropertyId(propertyId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PosLocationDto createLocation(PosLocationCreationDto dto) {
        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        PosLocation location = new PosLocation();
        location.setProperty(property);
        location.setName(dto.name());
        location.setCode(UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase());
        location.setLocationType(dto.locationType());
        location.setDefaultTaxRate(dto.defaultTaxRate());
        location.setServiceChargeRate(dto.serviceChargeRate() != null ? dto.serviceChargeRate() : BigDecimal.ZERO);
        location.setOpeningTime(dto.openingTime());
        location.setClosingTime(dto.closingTime());
        location.setActive(true);

        return toDto(posLocationRepository.save(location));
    }

    @Transactional
    public PosLocationDto updateLocation(UUID id, PosLocationUpdateDto dto) {
        PosLocation location = posLocationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        if (dto.name() != null) location.setName(dto.name());
        if (dto.locationType() != null) location.setLocationType(dto.locationType());
        if (dto.defaultTaxRate() != null) location.setDefaultTaxRate(dto.defaultTaxRate());
        if (dto.serviceChargeRate() != null) location.setServiceChargeRate(dto.serviceChargeRate());
        if (dto.openingTime() != null) location.setOpeningTime(dto.openingTime());
        if (dto.closingTime() != null) location.setClosingTime(dto.closingTime());
        if (dto.isActive() != null) location.setActive(dto.isActive());

        return toDto(posLocationRepository.save(location));
    }

    // ──────────────── Category methods ��───────────────

    public List<PosItemCategoryDto> getCategories(UUID locationId) {
        return posItemCategoryRepository.findByPosLocationIdOrderByDisplayOrder(locationId).stream()
                .map(this::toCategoryDto)
                .collect(Collectors.toList());
    }

    public List<PosItemCategoryDto> getActiveCategories(UUID locationId) {
        return posItemCategoryRepository.findByPosLocationIdAndIsActiveTrueOrderByDisplayOrder(locationId).stream()
                .map(this::toCategoryDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PosItemCategoryDto createCategory(PosItemCategoryCreationDto dto) {
        PosLocation location = posLocationRepository.findById(dto.locationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        PosItemCategory category = new PosItemCategory();
        category.setPosLocation(location);
        category.setName(dto.name());
        category.setCode(UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase());
        category.setDisplayOrder(dto.displayOrder() != null ? dto.displayOrder() : 0);
        category.setActive(true);

        return toCategoryDto(posItemCategoryRepository.save(category));
    }

    @Transactional
    public PosItemCategoryDto updateCategory(UUID id, PosItemCategoryUpdateDto dto) {
        PosItemCategory category = posItemCategoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        if (dto.name() != null) category.setName(dto.name());
        if (dto.displayOrder() != null) category.setDisplayOrder(dto.displayOrder());
        if (dto.isActive() != null) category.setActive(dto.isActive());

        return toCategoryDto(posItemCategoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(UUID id) {
        PosItemCategory category = posItemCategoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        boolean hasProducts = posProductRepository.existsByCategoryId(id);
        if (hasProducts) {
            category.setActive(false);
            posItemCategoryRepository.save(category);
        } else {
            posItemCategoryRepository.delete(category);
        }
    }

    // ──────────────── Product methods ────────────────

    public List<PosProductDto> getProducts(UUID locationId) {
        return posProductRepository.findByPosLocationId(locationId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public PosProductDto createProduct(PosProductCreationDto dto) {
        PosLocation location = posLocationRepository.findById(dto.locationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        PosItemCategory category = posItemCategoryRepository.findById(dto.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        PosProduct product = new PosProduct();
        product.setPosLocation(location);
        product.setName(dto.name());
        product.setCode(UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        product.setDescription(dto.description());
        product.setCategory(category);
        product.setPrice(dto.price());
        product.setCost(dto.cost());
        product.setDiscountRate(dto.discountRate());

        BigDecimal taxRate = dto.taxRate() != null ? dto.taxRate() : location.getDefaultTaxRate();
        product.setTaxRate(taxRate);

        product.setAvailable(dto.isAvailable());
        product.setPreparationTime(dto.preparationTime());
        product.setImageUrl(dto.imageUrl());

        return toDto(posProductRepository.save(product));
    }

    @Transactional
    public PosProductDto updateProduct(UUID id, PosProductUpdateDto dto) {
        PosProduct product = posProductRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        if (dto.name() != null) product.setName(dto.name());
        if (dto.description() != null) product.setDescription(dto.description());
        if (dto.categoryId() != null) {
            PosItemCategory category = posItemCategoryRepository.findById(dto.categoryId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));
            product.setCategory(category);
        }
        if (dto.price() != null) product.setPrice(dto.price());
        if (dto.cost() != null) product.setCost(dto.cost());
        if (dto.taxRate() != null) product.setTaxRate(dto.taxRate());
        if (dto.discountRate() != null) product.setDiscountRate(dto.discountRate());
        if (dto.isAvailable() != null) product.setAvailable(dto.isAvailable());
        if (dto.preparationTime() != null) product.setPreparationTime(dto.preparationTime());
        if (dto.imageUrl() != null) product.setImageUrl(dto.imageUrl());

        return toDto(posProductRepository.save(product));
    }

    @Transactional
    public void deleteProduct(UUID id) {
        PosProduct product = posProductRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        boolean referenced = posOrderRepository.existsOrderItemByProductId(id);
        if (referenced) {
            product.setAvailable(false);
            posProductRepository.save(product);
        } else {
            posProductRepository.delete(product);
        }
    }

    // ──────────────── Order methods ────────────────

    @Transactional
    public PosOrderDto createOrder(PosOrderCreationDto dto, String username) {
        PosLocation location = posLocationRepository.findById(dto.posLocationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        PosOrder order = new PosOrder();
        order.setPosLocation(location);
        order.setProperty(location.getProperty());
        order.setStatus(PosOrderStatus.OPEN);
        order.setOrderType("DINE_IN");
        order.setPaymentStatus("PENDING");
        order.setCreatedBy(username);

        List<PosOrderItem> items = dto.items().stream()
                .map(itemDto -> {
                    PosProduct product = posProductRepository.findById(itemDto.posProductId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
                    PosOrderItem item = new PosOrderItem();
                    item.setPosOrder(order);
                    item.setPosProduct(product);
                    item.setItemName(product.getName());
                    item.setQuantity(itemDto.quantity());

                    // Apply per-item discount if set
                    BigDecimal unitPrice = product.getPrice();
                    if (product.getDiscountRate() != null && product.getDiscountRate().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal discountMultiplier = BigDecimal.ONE.subtract(
                                product.getDiscountRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                        unitPrice = unitPrice.multiply(discountMultiplier).setScale(2, RoundingMode.HALF_UP);
                    }
                    item.setUnitPrice(unitPrice);

                    BigDecimal taxRate = product.getTaxRate() != null ? product.getTaxRate()
                            : (location.getDefaultTaxRate() != null ? location.getDefaultTaxRate() : BigDecimal.ZERO);
                    item.setTaxRate(taxRate);

                    item.calculateSubtotal();
                    return item;
                })
                .collect(Collectors.toList());

        order.setItems(items);
        order.calculateTotal();

        // Apply order-level discount if provided
        if (dto.discountRate() != null && dto.discountRate().compareTo(BigDecimal.ZERO) > 0) {
            order.setDiscountRate(dto.discountRate());
            BigDecimal discountAmount = order.getSubtotal()
                    .multiply(dto.discountRate())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            order.setDiscountAmount(discountAmount);
            order.calculateTotal();
        }

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

        ChargeCode chargeCode = order.getPosLocation().getLocationType() != null
                ? order.getPosLocation().getLocationType().toChargeCode()
                : ChargeCode.MISC;

        // Pass totalAmount with zero taxRate — tax is already included in the total
        ChargeCreationDto chargeDto = new ChargeCreationDto(
                LocalDate.now(),
                chargeCode,
                "POS Order: " + order.getOrderNumber(),
                order.getTotalAmount(),
                BigDecimal.ONE,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "POS_ORDER",
                order.getId(),
                "Charged from POS",
                "SYSTEM",
                null);

        UUID propertyId = order.getProperty().getId();
        folioService.addCharge(propertyId, folioId, chargeDto);

        // Link folio and booking to the order
        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));
        order.setFolio(folio);
        if (folio.getBooking() != null) {
            order.setBooking(folio.getBooking());
        }

        order.setStatus(PosOrderStatus.CHARGED);
        order.setPaymentStatus("CHARGED_TO_FOLIO");
        order.setCompletedAt(OffsetDateTime.now());

        return toDto(posOrderRepository.save(order));
    }

    @Transactional
    public PosOrderDto settleOrder(UUID orderId, PosSettleDto dto, String username) {
        PosOrder order = posOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));

        if (order.getStatus() != PosOrderStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order is not open");
        }

        UUID folioId;
        if (dto.walkIn()) {
            folioId = getOrCreateWalkInFolio(order.getProperty(), order.getPosLocation(), username);
        } else {
            if (dto.folioId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "folioId is required for hotel guest settlement");
            }
            folioId = dto.folioId();
        }

        // Charge the order to the folio
        chargeOrderToFolio(orderId, folioId);

        // Record immediate payment
        PaymentCreationDto paymentDto = new PaymentCreationDto(
                order.getTotalAmount(),
                PaymentMethod.valueOf(dto.paymentMethod()),
                com.adith.os.HMS.billing.folio.ChargeCategory.ANCILLARY,
                dto.transactionId(),
                dto.cardLastFour(),
                null,   // cardType
                null,   // bankName
                null,   // accountNumber
                null,   // referenceNumber
                dto.upiId(),
                dto.notes(),
                username,
                null    // travelAgentId
        );

        paymentService.recordPayment(order.getProperty().getId(), folioId, paymentDto, username);

        // Re-fetch order (chargeOrderToFolio already updated it)
        PosOrder updated = posOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        updated.setStatus(PosOrderStatus.CLOSED);
        updated.setPaymentStatus("SETTLED");

        return toDto(posOrderRepository.save(updated));
    }

    // ──────────────── Order history ────────────────

    public List<PosOrderDto> getOrders(UUID locationId, OffsetDateTime from, OffsetDateTime to, PosOrderStatus status) {
        List<PosOrder> orders;
        if (status != null) {
            orders = posOrderRepository.findByLocationAndDateRangeAndStatus(locationId, from, to, status);
        } else {
            orders = posOrderRepository.findByLocationAndDateRange(locationId, from, to);
        }
        return orders.stream().map(this::toDto).collect(Collectors.toList());
    }

    public OrderSummaryDto getOrderSummary(UUID locationId, OffsetDateTime from, OffsetDateTime to) {
        List<Object[]> results = posOrderRepository.getOrderSummary(locationId, from, to);
        if (results.isEmpty()) {
            return new OrderSummaryDto(0, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        Object[] row = results.get(0);
        long count = ((Number) row[0]).longValue();
        BigDecimal totalRevenue = (BigDecimal) row[1];
        BigDecimal avgValue = (BigDecimal) row[2];
        return new OrderSummaryDto(count, totalRevenue, avgValue);
    }

    // ──────────────── Walk-in folio ────────────────

    @Transactional
    public FolioDto postWalkInFolio(UUID locationId) {
        PosLocation location = posLocationRepository.findById(locationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        Folio walkInFolio = location.getCurrentWalkInFolio();
        if (walkInFolio == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active walk-in folio for this location");
        }

        UUID propertyId = location.getProperty().getId();
        FolioDto result = folioService.closeFolio(propertyId, walkInFolio.getId(), "SYSTEM");

        location.setCurrentWalkInFolio(null);
        posLocationRepository.save(location);

        return result;
    }

    // ──────────────── Private helpers ────────────────

    private UUID getOrCreateWalkInFolio(Property property, PosLocation location, String username) {
        Folio existing = location.getCurrentWalkInFolio();
        if (existing != null && existing.getStatus() == FolioStatus.OPEN) {
            return existing.getId();
        }

        UUID walkInGuestId = property.getWalkInGuestId();
        if (walkInGuestId == null) {
            Guest walkInGuest = new Guest();
            walkInGuest.setFirstName("Walk-In");
            walkInGuest.setLastName("Guest");
            walkInGuest.setEmail("walkin@" + property.getCode().toLowerCase());
            Guest saved = guestRepository.save(walkInGuest);
            property.setWalkInGuestId(saved.getId());
            propertyRepository.save(property);
            walkInGuestId = saved.getId();
        }

        FolioCreationDto folioDto = new FolioCreationDto(
                null,
                walkInGuestId,
                FolioType.WALK_IN,
                "Walk-in POS folio — " + location.getName(),
                username,
                null
        );

        FolioDto created = folioService.createFolio(property.getId(), folioDto);

        Folio folio = folioRepository.findById(created.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Walk-in folio creation failed"));
        location.setCurrentWalkInFolio(folio);
        posLocationRepository.save(location);

        return created.id();
    }

    // ──────────────── DTO Mappers ────────────────

    private PosLocationDto toDto(PosLocation entity) {
        UUID walkInFolioId = entity.getCurrentWalkInFolio() != null ? entity.getCurrentWalkInFolio().getId() : null;
        return new PosLocationDto(
                entity.getId(),
                entity.getName(),
                entity.getLocationType(),
                entity.getProperty().getId(),
                entity.getDefaultTaxRate(),
                entity.getServiceChargeRate(),
                entity.getOpeningTime(),
                entity.getClosingTime(),
                entity.isActive(),
                walkInFolioId);
    }

    private PosItemCategoryDto toCategoryDto(PosItemCategory entity) {
        return new PosItemCategoryDto(
                entity.getId(),
                entity.getPosLocation().getId(),
                entity.getName(),
                entity.getDisplayOrder(),
                entity.isActive());
    }

    private PosProductDto toDto(PosProduct entity) {
        UUID categoryId = entity.getCategory() != null ? entity.getCategory().getId() : null;
        String categoryName = entity.getCategory() != null ? entity.getCategory().getName() : null;
        return new PosProductDto(
                entity.getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getPrice(),
                entity.getCost(),
                categoryId,
                categoryName,
                entity.getPosLocation().getId(),
                entity.getTaxRate(),
                entity.getDiscountRate(),
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
                entity.getItems() != null ? entity.getItems().stream().map(this::toItemDto).collect(Collectors.toList()) : null,
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
                entity.getDiscountRate(),
                entity.getDiscountAmount(),
                entity.getPaymentStatus(),
                entity.getTableNumber(),
                entity.getGuestName(),
                entity.getSpecialInstructions(),
                entity.getCreatedBy(),
                entity.getServedBy());
    }

    private PosOrderItemDto toItemDto(PosOrderItem entity) {
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
