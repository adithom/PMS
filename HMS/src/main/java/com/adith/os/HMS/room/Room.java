package com.adith.os.HMS.room;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.unit.Unit;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "room", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"property_id", "number"})
})
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private Unit unit;

    @NotBlank(message = "Room number is required")
    @Column(nullable = false)
    private String number;

    private String type;

    @NotNull(message = "Room capacity is required")
    @Positive(message = "Capacity must be positive")
    @Column(nullable = false)
    private Integer capacity;

    @NotNull(message = "Base rate is required")
    @Column(name = "base_rate", nullable = false)
    private BigDecimal baseRate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomStatus status = RoomStatus.ACTIVE;

    @Column(name = "last_maintained")
    private OffsetDateTime lastMaintained;

    @OneToMany(mappedBy = "room")
    private List<Booking> bookings;

    @OneToMany(mappedBy = "room")
    private List<RoomAssignment> roomAssignments;

    public Room() {
    }

    public Room(Property property, Unit unit, String number) {
        this.property = property;
        this.unit = unit;
        this.number = number;
        this.status = RoomStatus.ACTIVE;
    }

    public List<Booking> getBookings() {
        return bookings;
    }

    public void setBookings(List<Booking> bookings) {
        this.bookings = bookings;
    }

    public OffsetDateTime getLastMaintained() {
        return lastMaintained;
    }

    public void setLastMaintained(OffsetDateTime lastMaintained) {
        this.lastMaintained = lastMaintained;
    }

    public RoomStatus getStatus() {
        return status;
    }

    public void setStatus(RoomStatus status) {
        this.status = status;
    }

    public BigDecimal getBaseRate() {
        return baseRate;
    }

    public void setBaseRate(BigDecimal baseRate) {
        this.baseRate = baseRate;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getNumber() {
        return number;
    }

    public void setNumber(String number) {
        this.number = number;
    }

    public Unit getUnit() {
        return unit;
    }

    public void setUnit(Unit unit) {
        this.unit = unit;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    /**
     * Check if room is in any maintenance state
     */
    public boolean isInMaintenance() {
        return this.status == RoomStatus.IN_MAINTENANCE ||
                this.status == RoomStatus.QUEUED_FOR_MAINTENANCE;
    }

    /**
     * Check if room is active
     */
    public boolean isActive() {
        return this.status == RoomStatus.ACTIVE;
    }

    public List<RoomAssignment> getRoomAssignments() {
        return roomAssignments;
    }

    public void setRoomAssignments(List<RoomAssignment> roomAssignments) {
        this.roomAssignments = roomAssignments;
    }

}