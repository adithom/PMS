package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
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
public class PosTicketService {

    private final PosTicketRepository ticketRepository;
    private final PosOrderRepository orderRepository;
    private final PosLocationRepository locationRepository;
    private final PosProductRepository productRepository;
    private final BookingRepository bookingRepository;
    private final FolioService folioService;
    private final PosService posService;
    private final PosReceiptService receiptService;

    public PosTicketService(PosTicketRepository ticketRepository,
                            PosOrderRepository orderRepository,
                            PosLocationRepository locationRepository,
                            PosProductRepository productRepository,
                            BookingRepository bookingRepository,
                            FolioService folioService,
                            PosService posService,
                            PosReceiptService receiptService) {
        this.ticketRepository = ticketRepository;
        this.orderRepository  = orderRepository;
        this.locationRepository = locationRepository;
        this.productRepository  = productRepository;
        this.bookingRepository  = bookingRepository;
        this.folioService       = folioService;
        this.posService         = posService;
        this.receiptService     = receiptService;
    }

    // ──────────────── Open ticket ────────────────

    @Transactional
    public PosTicketDto openTicket(PosTicketCreationDto dto, String username) {
        PosLocation location = locationRepository.findById(dto.posLocationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Location not found"));

        if (!location.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Location is not active");
        }

        PosTicket ticket = new PosTicket();
        ticket.setPosLocation(location);
        ticket.setProperty(location.getProperty());
        ticket.setMealType(dto.mealType());
        ticket.setCreatedBy(username);
        ticket.setStatus(PosTicketStatus.OPEN);
        ticket.setTicketNumber("TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        if (dto.bookingId() != null) {
            Booking booking = bookingRepository.findById(dto.bookingId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            ticket.setBooking(booking);
            ticket.setGuestName(booking.getGuest().getFirstName() + " " + booking.getGuest().getLastName());

            String roomNumber = booking.getRoomAssignments().stream()
                    .filter(ra -> ra.getStatus() == RoomAssignmentStatus.ACTIVE)
                    .findFirst()
                    .map(ra -> ra.getRoom().getNumber())
                    .orElse(booking.getRoom() != null ? booking.getRoom().getNumber() : null);
            ticket.setRoomNumber(roomNumber);
        } else {
            if (dto.guestName() == null || dto.guestName().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest name is required for walk-in tickets");
            }
            ticket.setGuestName(dto.guestName());
        }

        return toDto(ticketRepository.save(ticket), List.of());
    }

    // ──────────────── Add order to ticket ────────────────

    @Transactional
    public PosOrderDto addOrderToTicket(UUID ticketId, PosOrderCreationDto dto, String username) {
        PosTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        if (ticket.getStatus() != PosTicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is not open");
        }

        PosLocation location = ticket.getPosLocation();

        PosOrder order = new PosOrder();
        order.setPosLocation(location);
        order.setProperty(location.getProperty());
        order.setStatus(PosOrderStatus.OPEN);
        order.setOrderType("DINE_IN");
        order.setPaymentStatus("PENDING");
        order.setCreatedBy(username);
        order.setTicket(ticket);

        List<PosOrderItem> items = dto.items().stream()
                .map(itemDto -> {
                    PosProduct product = productRepository.findById(itemDto.posProductId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found: " + itemDto.posProductId()));

                    PosOrderItem item = new PosOrderItem();
                    item.setPosOrder(order);
                    item.setPosProduct(product);
                    item.setItemName(product.getName());
                    item.setQuantity(itemDto.quantity());

                    BigDecimal unitPrice = product.getPrice();
                    if (product.getDiscountRate() != null && product.getDiscountRate().compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal multiplier = BigDecimal.ONE.subtract(
                                product.getDiscountRate().divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                        unitPrice = unitPrice.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
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

        if (dto.discountRate() != null && dto.discountRate().compareTo(BigDecimal.ZERO) > 0) {
            order.setDiscountRate(dto.discountRate());
            BigDecimal discountAmount = order.getSubtotal()
                    .multiply(dto.discountRate())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            order.setDiscountAmount(discountAmount);
            order.calculateTotal();
        }

        PosOrder saved = orderRepository.save(order);
        return posService.toOrderDto(saved);
    }

    // ──────────────── Close ticket ────────────────

    @Transactional
    public PosTicketDto closeTicket(UUID ticketId, String closedBy) {
        PosTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        if (ticket.getStatus() != PosTicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is already closed");
        }

        List<PosOrder> orders = orderRepository.findByTicketIdWithItems(ticketId);

        if (orders.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot close an empty ticket");
        }

        boolean covered = isMealPlanCovered(ticket);

        if (covered) {
            orders.forEach(o -> {
                o.setStatus(PosOrderStatus.MEAL_PLAN_COVERED);
                o.setPaymentStatus("MEAL_PLAN");
                o.setCompletedAt(OffsetDateTime.now());
            });
            orderRepository.saveAll(orders);
            ticket.setMealPlanCovered(true);

        } else {
            // Assign invoice number
            String invoiceNumber = receiptService.getNextInvoiceNumber(ticket.getPosLocation());
            ticket.setInvoiceNumber(invoiceNumber);

            // Compute ticket total
            BigDecimal ticketTotal = orders.stream()
                    .map(PosOrder::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // Resolve folio
            UUID folioId = resolveFolioId(ticket, closedBy);

            UUID propertyId = ticket.getProperty().getId();
            ChargeCode chargeCode = ticket.getPosLocation().getLocationType().toChargeCode();

            String locationName = ticket.getPosLocation() != null && ticket.getPosLocation().getName() != null
                    ? ticket.getPosLocation().getName() : "POS";
            ChargeCreationDto chargeDto = new ChargeCreationDto(
                    LocalDate.now(),
                    chargeCode,
                    locationName + " - Receipt #" + invoiceNumber,
                    ticketTotal,
                    BigDecimal.ONE,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    "POS_TICKET",
                    ticket.getId(),
                    null,
                    closedBy,
                    null
            );
            folioService.addCharge(propertyId, folioId, chargeDto);

            // Update orders
            orders.forEach(o -> {
                o.setStatus(PosOrderStatus.CHARGED);
                o.setPaymentStatus("CHARGED_TO_FOLIO");
                o.setCompletedAt(OffsetDateTime.now());
            });
            orderRepository.saveAll(orders);

            // Generate receipt — ticket must be saved first so receipt can reference invoice number
            ticket.setStatus(PosTicketStatus.CLOSED);
            ticket.setClosedAt(OffsetDateTime.now());
            PosTicket saved = ticketRepository.save(ticket);
            saved.setOrders(orders); // attach for PDF rendering

            String receiptPath = receiptService.generateReceipt(saved);
            saved.setReceiptUrl(receiptPath);
            ticketRepository.save(saved);

            return toDto(saved, orders);
        }

        ticket.setStatus(PosTicketStatus.CLOSED);
        ticket.setClosedAt(OffsetDateTime.now());
        PosTicket saved = ticketRepository.save(ticket);
        return toDto(saved, orders);
    }

    // ──────────────── Get open tickets ────────────────

    public List<PosTicketDto> getOpenTickets(UUID locationId) {
        return ticketRepository.findByPosLocationIdAndStatus(locationId, PosTicketStatus.OPEN)
                .stream()
                .map(t -> {
                    List<PosOrder> orders = orderRepository.findByTicketIdWithItems(t.getId());
                    return toDto(t, orders);
                })
                .collect(Collectors.toList());
    }

    // ──────────────── Private helpers ────────────────

    private boolean isMealPlanCovered(PosTicket ticket) {
        if (ticket.getBooking() == null) return false;
        if (ticket.getMealType() == MealType.SNACK) return false;

        MealPlanType plan = ticket.getBooking().getMealPlanType();
        if (plan == null) return false;

        MealType meal = ticket.getMealType();
        return switch (plan) {
            case CP  -> meal == MealType.BREAKFAST;
            case MAP -> meal == MealType.BREAKFAST || meal == MealType.DINNER;
            case AP  -> meal == MealType.BREAKFAST || meal == MealType.LUNCH || meal == MealType.DINNER;
        };
    }

    private UUID resolveFolioId(PosTicket ticket, String username) {
        if (ticket.getBooking() != null) {
            return folioService.getFolioByBooking(
                    ticket.getProperty().getId(),
                    ticket.getBooking().getId()).id();
        }
        return posService.getOrCreateWalkInFolio(
                ticket.getProperty(),
                ticket.getPosLocation(),
                username);
    }

    // ──────────────── DTO mapper ────────────────

    private PosTicketDto toDto(PosTicket ticket, List<PosOrder> orders) {
        UUID bookingId = ticket.getBooking() != null ? ticket.getBooking().getId() : null;
        List<PosOrderDto> orderDtos = orders.stream()
                .map(posService::toOrderDto)
                .collect(Collectors.toList());

        return new PosTicketDto(
                ticket.getId(),
                ticket.getTicketNumber(),
                ticket.getInvoiceNumber(),
                ticket.getPosLocation().getId(),
                bookingId,
                ticket.getGuestName(),
                ticket.getRoomNumber(),
                ticket.getMealType(),
                ticket.getStatus(),
                ticket.isMealPlanCovered(),
                ticket.getReceiptUrl(),
                ticket.getCreatedBy(),
                ticket.getCreatedAt(),
                ticket.getClosedAt(),
                orderDtos
        );
    }
}
