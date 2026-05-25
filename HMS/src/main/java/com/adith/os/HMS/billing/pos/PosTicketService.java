package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.pos.dto.CloseTicketDto;
import com.adith.os.HMS.billing.pos.dto.OrderSummaryDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderItemDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketHistoryDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.storage.R2StorageService;
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
    private final R2StorageService r2StorageService;

    public PosTicketService(PosTicketRepository ticketRepository,
                            PosOrderRepository orderRepository,
                            PosLocationRepository locationRepository,
                            PosProductRepository productRepository,
                            BookingRepository bookingRepository,
                            FolioService folioService,
                            PosService posService,
                            PosReceiptService receiptService,
                            R2StorageService r2StorageService) {
        this.ticketRepository = ticketRepository;
        this.orderRepository  = orderRepository;
        this.locationRepository = locationRepository;
        this.productRepository  = productRepository;
        this.bookingRepository  = bookingRepository;
        this.folioService       = folioService;
        this.posService         = posService;
        this.receiptService     = receiptService;
        this.r2StorageService   = r2StorageService;
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
    public PosTicketDto closeTicket(UUID ticketId, CloseTicketDto paymentDto, String closedBy) {
        PosTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        if (ticket.getStatus() != PosTicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is already closed");
        }

        List<PosOrder> orders = orderRepository.findByTicketIdWithItems(ticketId);

        if (orders.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot close an empty ticket");
        }

        boolean isWalkIn = ticket.getBooking() == null;
        boolean covered = isMealPlanCovered(ticket);

        if (covered) {
            orders.forEach(o -> {
                o.setStatus(PosOrderStatus.MEAL_PLAN_COVERED);
                o.setPaymentStatus("MEAL_PLAN");
                o.setCompletedAt(OffsetDateTime.now());
            });
            orderRepository.saveAll(orders);
            ticket.setMealPlanCovered(true);

        } else if (isWalkIn) {
            // Walk-in: payment required, no folio involved
            if (paymentDto == null || paymentDto.paymentMethod() == null || paymentDto.paymentMethod().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method is required for walk-in tickets");
            }

            String invoiceNumber = receiptService.getNextInvoiceNumber(ticket.getPosLocation());
            ticket.setInvoiceNumber(invoiceNumber);

            BigDecimal ticketTotal = orders.stream()
                    .map(PosOrder::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            ticket.setPaymentMethod(paymentDto.paymentMethod());
            ticket.setPaymentAmount(ticketTotal);
            ticket.setTransactionReference(paymentDto.transactionReference());

            orders.forEach(o -> {
                o.setStatus(PosOrderStatus.CLOSED);
                o.setPaymentStatus("SETTLED");
                o.setCompletedAt(OffsetDateTime.now());
            });
            orderRepository.saveAll(orders);

            ticket.setStatus(PosTicketStatus.CLOSED);
            ticket.setClosedAt(OffsetDateTime.now());
            PosTicket saved = ticketRepository.save(ticket);
            saved.setOrders(orders);

            String receiptPath = receiptService.generateReceipt(saved);
            saved.setReceiptUrl(receiptPath);
            ticketRepository.save(saved);

            return toDto(saved, orders);

        } else {
            // Hotel guest: charge to folio, no payment on ticket
            String invoiceNumber = receiptService.getNextInvoiceNumber(ticket.getPosLocation());
            ticket.setInvoiceNumber(invoiceNumber);

            BigDecimal ticketSubtotal = orders.stream()
                    .map(PosOrder::getSubtotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal locationTaxRate = ticket.getPosLocation().getDefaultTaxRate();

            UUID folioId = resolveFolioId(ticket);
            UUID propertyId = ticket.getProperty().getId();
            ChargeCode chargeCode = ticket.getPosLocation().getLocationType().toChargeCode();

            String locationName = ticket.getPosLocation() != null && ticket.getPosLocation().getName() != null
                    ? ticket.getPosLocation().getName() : "POS";
            ChargeCreationDto chargeDto = new ChargeCreationDto(
                    LocalDate.now(),
                    chargeCode,
                    locationName + " - Receipt #" + invoiceNumber,
                    ticketSubtotal,
                    BigDecimal.ONE,
                    locationTaxRate,
                    BigDecimal.ZERO,
                    "POS_TICKET",
                    ticket.getId(),
                    null,
                    closedBy,
                    null
            );
            folioService.addCharge(propertyId, folioId, chargeDto);

            orders.forEach(o -> {
                o.setStatus(PosOrderStatus.CHARGED);
                o.setPaymentStatus("CHARGED_TO_FOLIO");
                o.setCompletedAt(OffsetDateTime.now());
            });
            orderRepository.saveAll(orders);

            ticket.setStatus(PosTicketStatus.CLOSED);
            ticket.setClosedAt(OffsetDateTime.now());
            PosTicket saved = ticketRepository.save(ticket);
            saved.setOrders(orders);

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

    private UUID resolveFolioId(PosTicket ticket) {
        return folioService.getFolioByBooking(
                ticket.getProperty().getId(),
                ticket.getBooking().getId()).id();
    }

    // ──────────────── Ticket history ────────────────

    public List<PosTicketHistoryDto> getTicketHistory(UUID locationId, OffsetDateTime from, OffsetDateTime to) {
        List<PosTicket> tickets = ticketRepository.findClosedByLocationAndDateRange(locationId, from, to);
        return tickets.stream().map(ticket -> {
            List<PosOrder> orders = orderRepository.findByTicketIdWithItems(ticket.getId());

            BigDecimal subtotal   = orders.stream().map(PosOrder::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal taxAmount  = orders.stream().map(PosOrder::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalAmount = orders.stream().map(PosOrder::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

            List<PosOrderItemDto> items = orders.stream()
                    .flatMap(o -> o.getItems().stream())
                    .map(i -> new PosOrderItemDto(
                            i.getId(), i.getPosProduct().getId(), i.getItemName(),
                            i.getQuantity(), i.getUnitPrice(), i.getSubtotal(),
                            i.getTaxRate(), i.getTaxAmount(), i.getTotalAmount(),
                            null, null))
                    .collect(Collectors.toList());

            String locName = ticket.getPosLocation() != null ? ticket.getPosLocation().getName() : null;
            return new PosTicketHistoryDto(
                    ticket.getId(),
                    ticket.getInvoiceNumber(),
                    locName,
                    ticket.getGuestName(),
                    ticket.getRoomNumber(),
                    ticket.getMealType(),
                    ticket.isMealPlanCovered(),
                    ticket.getClosedAt(),
                    subtotal,
                    taxAmount,
                    totalAmount,
                    ticket.getCreatedBy(),
                    items,
                    ticket.getPaymentMethod(),
                    ticket.getTransactionReference()
            );
        }).collect(Collectors.toList());
    }

    public OrderSummaryDto getTicketSummary(UUID locationId, OffsetDateTime from, OffsetDateTime to) {
        List<Object[]> results = ticketRepository.getTicketSummary(locationId, from, to);
        if (results.isEmpty()) return new OrderSummaryDto(0, BigDecimal.ZERO, BigDecimal.ZERO);
        Object[] row = results.get(0);
        long count         = ((Number) row[0]).longValue();
        BigDecimal revenue = row[1] != null ? new BigDecimal(row[1].toString()) : BigDecimal.ZERO;
        BigDecimal avg     = count > 0
                           ? revenue.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                           : BigDecimal.ZERO;
        return new OrderSummaryDto(count, revenue, avg);
    }

    // ──────────────── Booking-linked ticket queries ────────────────

    public List<PosTicketHistoryDto> getTicketsByBookingId(UUID bookingId) {
        return ticketRepository.findByBookingIdAndStatus(bookingId, PosTicketStatus.CLOSED)
                .stream()
                .map(ticket -> {
                    List<PosOrder> orders = orderRepository.findByTicketIdWithItems(ticket.getId());
                    BigDecimal subtotal    = orders.stream().map(PosOrder::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal taxAmount   = orders.stream().map(PosOrder::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    BigDecimal totalAmount = orders.stream().map(PosOrder::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    List<PosOrderItemDto> items = orders.stream()
                            .flatMap(o -> o.getItems().stream())
                            .map(i -> new PosOrderItemDto(
                                    i.getId(), i.getPosProduct().getId(), i.getItemName(),
                                    i.getQuantity(), i.getUnitPrice(), i.getSubtotal(),
                                    i.getTaxRate(), i.getTaxAmount(), i.getTotalAmount(),
                                    null, null))
                            .collect(Collectors.toList());
                    String locName = ticket.getPosLocation() != null ? ticket.getPosLocation().getName() : null;
                    return new PosTicketHistoryDto(
                            ticket.getId(),
                            ticket.getInvoiceNumber(),
                            locName,
                            ticket.getGuestName(),
                            ticket.getRoomNumber(),
                            ticket.getMealType(),
                            ticket.isMealPlanCovered(),
                            ticket.getClosedAt(),
                            subtotal,
                            taxAmount,
                            totalAmount,
                            ticket.getCreatedBy(),
                            items,
                            ticket.getPaymentMethod(),
                            ticket.getTransactionReference()
                    );
                })
                .collect(Collectors.toList());
    }

    public String getReceiptUrl(UUID ticketId) {
        PosTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (ticket.getReceiptUrl() == null || ticket.getReceiptUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No receipt available for this ticket");
        }
        String fileName = "REC_" + (ticket.getInvoiceNumber() != null ? ticket.getInvoiceNumber() : ticket.getTicketNumber()) + ".pdf";
        return r2StorageService.generatePresignedDownloadUrl(ticket.getReceiptUrl(), fileName);
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
                orderDtos,
                ticket.getPaymentMethod(),
                ticket.getPaymentAmount(),
                ticket.getTransactionReference()
        );
    }
}
