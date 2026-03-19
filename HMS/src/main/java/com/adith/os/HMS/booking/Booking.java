package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioType;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.unit.Unit;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "booking")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id", nullable = false)
    private Guest guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookingStatus status = BookingStatus.PENDING;

    @NotNull(message = "Check-in date is required")
    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    @NotNull(message = "Check-out date is required")
    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;

    @PositiveOrZero(message = "Adults cannot be negative")
    @Column(nullable = false, columnDefinition = "integer default 1")
    private Integer adults = 1;

    @PositiveOrZero(message = "Children cannot be negative")
    @Column(nullable = false, columnDefinition = "integer default 0")
    private Integer children = 0;

    @Column(length = 3, columnDefinition = "char(3)")
    private String currency = "INR";

    @Column(name = "total_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal totalPrice = BigDecimal.ZERO;

    @Column(name = "paid_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "special_requests", length = 1000)
    private String specialRequests;

    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp with time zone default now()")
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL)
    private List<Folio> folios;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_booking_id")
    private Booking parentBooking;

    @OneToMany(mappedBy = "parentBooking", cascade = CascadeType.ALL, orphanRemoval = false)
    private List<Booking> childBookings = new ArrayList<>();

    @Column(name = "is_group_master", nullable = false, columnDefinition = "boolean default false")
    private boolean isGroupMaster = false;

    @Column(name = "group_reference", length = 100)
    private String groupReference;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL)
    private List<RoomAssignment> roomAssignments = new ArrayList<>();

    public Folio getMasterFolio() {
        if (folios == null || folios.isEmpty()) return null;
        return folios.stream()
                .filter(f -> f.getFolioType() == FolioType.MASTER)
                .findFirst()
                .orElse(null);
    }

    public boolean isGroupChild() {
        return parentBooking != null;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = BookingStatus.PENDING;
        }
        if (paidAmount == null) {
            paidAmount = BigDecimal.ZERO;
        }
    }

    // Default constructor
    public Booking() {
    }

    // Full constructor - matches what BookingMapper uses
    public Booking(Property property, Room room, Guest guest, Unit unit,
                   LocalDate checkIn, LocalDate checkOut, Integer adults,
                   Integer children, String currency, BigDecimal totalPrice,
                   String specialRequests, BookingStatus status, BigDecimal paidAmount) {
        this.property = property;
        this.room = room;
        this.guest = guest;
        this.unit = unit;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.adults = adults != null ? adults : 1;
        this.children = children != null ? children : 0;
        this.currency = currency != null ? currency : "INR";
        this.totalPrice = totalPrice != null ? totalPrice : BigDecimal.ZERO;
        this.specialRequests = specialRequests;
        this.status = status != null ? status : BookingStatus.PENDING;
        this.paidAmount = paidAmount != null ? paidAmount : BigDecimal.ZERO;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public Guest getGuest() {
        return guest;
    }

    public void setGuest(Guest guest) {
        this.guest = guest;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }

    public LocalDate getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(LocalDate checkIn) {
        this.checkIn = checkIn;
    }

    public LocalDate getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(LocalDate checkOut) {
        this.checkOut = checkOut;
    }

    public Integer getAdults() {
        return adults;
    }

    public void setAdults(Integer adults) {
        this.adults = adults;
    }

    public Integer getChildren() {
        return children;
    }

    public void setChildren(Integer children) {
        this.children = children;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(BigDecimal totalPrice) {
        this.totalPrice = totalPrice;
    }

    public BigDecimal getPaidAmount() {
        return paidAmount;
    }

    public void setPaidAmount(BigDecimal paidAmount) {
        this.paidAmount = paidAmount;
    }

    public String getSpecialRequests() {
        return specialRequests;
    }

    public void setSpecialRequests(String specialRequests) {
        this.specialRequests = specialRequests;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Booking getParentBooking() { return parentBooking; }
    public void setParentBooking(Booking parentBooking) { this.parentBooking = parentBooking; }

    public List<Booking> getChildBookings() { return childBookings; }
    public void setChildBookings(List<Booking> childBookings) { this.childBookings = childBookings; }

    public boolean isGroupMaster() { return isGroupMaster; }
    public void setGroupMaster(boolean groupMaster) { isGroupMaster = groupMaster; }

    public String getGroupReference() { return groupReference; }
    public void setGroupReference(String groupReference) { this.groupReference = groupReference; }

    public List<RoomAssignment> getRoomAssignments() { return roomAssignments; }
    public void setRoomAssignments(List<RoomAssignment> roomAssignments) { this.roomAssignments = roomAssignments; }

    // Calculated fields - these compute values dynamically

    /**
     * Calculate the number of nights for this booking
     * @return Number of nights between check-in and check-out
     */
    public Long getStayDuration() {
        if (checkIn == null || checkOut == null) {
            return 0L;
        }
        return checkIn.datesUntil(checkOut).count();
    }

    /**
     * Calculate the balance due (amount still owed)
     * This is the "due amount" displayed in the DTO
     * @return Remaining balance to be paid
     */
    public BigDecimal getBalanceDue() {
        if (totalPrice == null || paidAmount == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal balance = totalPrice.subtract(paidAmount);
        return balance.max(BigDecimal.ZERO);
    }

    /**
     * Check if the booking is fully paid
     * @return true if balance due is zero or negative
     */
    public boolean isFullyPaid() {
        return getBalanceDue().compareTo(BigDecimal.ZERO) <= 0;
    }

    /**
     * Get the payment progress as a percentage (0-100)
     * Useful for displaying progress bars in the frontend
     * @return Payment completion percentage
     */
    public double getPaymentProgress() {
        if (totalPrice == null || totalPrice .compareTo(BigDecimal.ZERO) <= 0) {
            return 0.0;
        }
        if (paidAmount == null) {
            return 0.0;
        }
        double progress = paidAmount.doubleValue() / totalPrice.doubleValue() * 100.0;
        return Math.min(progress, 100.0); // Cap at 100%
    }

    /**
     * Get total number of guests (adults + children)
     * @return Total guest count
     */
    public int getTotalGuests() {
        int adultCount = adults != null ? adults : 0;
        int childCount = children != null ? children : 0;
        return adultCount + childCount;
    }

    @Override
    public String toString() {
        return "Booking{" +
                "id=" + id +
                ", property=" + (property != null ? property.getCode() : "null") +
                ", room=" + (room != null ? room.getNumber() : "null") +
                ", guest=" + (guest != null ? guest.getId() : "null") +
                ", unit=" + (unit != null ? unit.getName() : "null") +
                ", status=" + status +
                ", checkIn=" + checkIn +
                ", checkOut=" + checkOut +
                ", adults=" + adults +
                ", children=" + children +
                ", totalPrice=" + totalPrice +
                ", paidAmount=" + paidAmount +
                ", balanceDue=" + getBalanceDue() +
                '}';
    }
}
