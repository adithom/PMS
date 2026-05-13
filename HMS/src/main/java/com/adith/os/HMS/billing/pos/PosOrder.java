package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.room.Room;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "pos_order")
public class PosOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "order_number", unique = true, nullable = false, length = 50)
    private String orderNumber;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private PosLocation posLocation;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folio_id")
    private Folio folio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private PosTicket ticket;

    @Column(name = "order_type", nullable = false, length = 50)
    private String orderType = "DINE_IN";

    @Column(name = "order_date")
    private OffsetDateTime orderDate;

    @Column(name = "subtotal", precision = 10, scale = 2, nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "service_charge", precision = 10, scale = 2, nullable = false)
    private BigDecimal serviceCharge = BigDecimal.ZERO;

    @Column(name = "discount_rate", precision = 5, scale = 2)
    private BigDecimal discountRate;

    @Column(name = "discount_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PosOrderStatus status = PosOrderStatus.OPEN;

    @Column(name = "payment_status", nullable = false, length = 20)
    private String paymentStatus = "PENDING";

    @Column(name = "table_number", length = 20)
    private String tableNumber;

    @Column(name = "guest_name", length = 200)
    private String guestName;

    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "served_by", length = 100)
    private String servedBy;

    @OneToMany(mappedBy = "posOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PosOrderItem> items;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    public PosOrder() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (orderDate == null) {
            orderDate = OffsetDateTime.now();
        }
        if (orderNumber == null) {
            orderNumber = "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
    }

    public void calculateTotal() {
        if (items == null || items.isEmpty()) {
            this.subtotal = BigDecimal.ZERO;
            this.taxAmount = BigDecimal.ZERO;
            this.totalAmount = BigDecimal.ZERO;
            return;
        }
        this.subtotal = items.stream()
                .map(PosOrderItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        this.taxAmount = items.stream()
                .map(PosOrderItem::getTaxAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Simple calculation: total = subtotal + tax + service - discount
        this.totalAmount = this.subtotal.add(this.taxAmount).add(this.serviceCharge).subtract(this.discountAmount);
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public PosLocation getPosLocation() {
        return posLocation;
    }

    public void setPosLocation(PosLocation posLocation) {
        this.posLocation = posLocation;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public Booking getBooking() {
        return booking;
    }

    public void setBooking(Booking booking) {
        this.booking = booking;
    }

    public Folio getFolio() {
        return folio;
    }

    public void setFolio(Folio folio) {
        this.folio = folio;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public PosTicket getTicket() {
        return ticket;
    }

    public void setTicket(PosTicket ticket) {
        this.ticket = ticket;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public OffsetDateTime getOrderDate() {
        return orderDate;
    }

    public void setOrderDate(OffsetDateTime orderDate) {
        this.orderDate = orderDate;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getServiceCharge() {
        return serviceCharge;
    }

    public void setServiceCharge(BigDecimal serviceCharge) {
        this.serviceCharge = serviceCharge;
    }

    public BigDecimal getDiscountRate() {
        return discountRate;
    }

    public void setDiscountRate(BigDecimal discountRate) {
        this.discountRate = discountRate;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(BigDecimal discountAmount) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public PosOrderStatus getStatus() {
        return status;
    }

    public void setStatus(PosOrderStatus status) {
        this.status = status;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getTableNumber() {
        return tableNumber;
    }

    public void setTableNumber(String tableNumber) {
        this.tableNumber = tableNumber;
    }

    public String getGuestName() {
        return guestName;
    }

    public void setGuestName(String guestName) {
        this.guestName = guestName;
    }

    public String getSpecialInstructions() {
        return specialInstructions;
    }

    public void setSpecialInstructions(String specialInstructions) {
        this.specialInstructions = specialInstructions;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getServedBy() {
        return servedBy;
    }

    public void setServedBy(String servedBy) {
        this.servedBy = servedBy;
    }

    public List<PosOrderItem> getItems() {
        return items;
    }

    public void setItems(List<PosOrderItem> items) {
        this.items = items;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(OffsetDateTime completedAt) {
        this.completedAt = completedAt;
    }
}
