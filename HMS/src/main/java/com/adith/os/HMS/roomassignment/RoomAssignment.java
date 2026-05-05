package com.adith.os.HMS.roomassignment;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.room.Room;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "room_assignment")
public class RoomAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomAssignmentStatus status = RoomAssignmentStatus.SCHEDULED;

    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp with time zone default now()")
    private OffsetDateTime createdAt;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "nightly_rate", precision = 10, scale = 2)
    private BigDecimal nightlyRate;

    @Column(name = "nightly_rate_ex_tax", precision = 10, scale = 2)
    private BigDecimal nightlyRateExTax;

    public RoomAssignment() {
    }

    public RoomAssignment(Booking booking, Room room, LocalDate startDate, LocalDate endDate,
                          RoomAssignmentStatus status, String notes, BigDecimal nightlyRate) {
        this.booking = booking;
        this.room = room;
        this.startDate = startDate;
        this.endDate = endDate;
        this.status = status != null ? status : RoomAssignmentStatus.SCHEDULED;
        this.notes = notes;
        this.nightlyRate = nightlyRate;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    // Getters and Setters

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Booking getBooking() {
        return booking;
    }

    public void setBooking(Booking booking) {
        this.booking = booking;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public RoomAssignmentStatus getStatus() {
        return status;
    }

    public void setStatus(RoomAssignmentStatus status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public BigDecimal getNightlyRate() {
        return nightlyRate;
    }

    public void setNightlyRate(BigDecimal nightlyRate) {
        this.nightlyRate = nightlyRate;
    }

    public BigDecimal getNightlyRateExTax() {
        return nightlyRateExTax;
    }

    public void setNightlyRateExTax(BigDecimal nightlyRateExTax) {
        this.nightlyRateExTax = nightlyRateExTax;
    }

    @Override
    public String toString() {
        return "RoomAssignment{" +
                "id=" + id +
                ", booking=" + (booking != null ? booking.getId() : "null") +
                ", room=" + (room != null ? room.getNumber() : "null") +
                ", startDate=" + startDate +
                ", endDate=" + endDate +
                ", status=" + status +
                ", nightlyRate=" + nightlyRate +
                '}';
    }
}
