package com.adith.os.HMS.reservation;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.travelagent.TravelAgent;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "reservation", uniqueConstraints = {
        @UniqueConstraint(name = "uq_reservation_property_number",
                columnNames = {"property_id", "reservation_number"})
})
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizer_guest_id", nullable = false)
    private Guest organizerGuest;

    @NotNull
    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    @NotNull
    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;

    @Column(name = "reservation_number", length = 10)
    private String reservationNumber;

    @Column(name = "group_reference", length = 100)
    private String groupReference;

    @Column(length = 3, columnDefinition = "char(3)")
    private String currency = "INR";

    @Column(name = "special_requests", length = 1000)
    private String specialRequests;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationStatus status = ReservationStatus.PENDING;

    @Column(name = "default_route_to_master", nullable = false, columnDefinition = "boolean default false")
    private boolean defaultRouteToMaster = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "travel_agent_id")
    private TravelAgent travelAgent;

    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp with time zone default now()")
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL)
    private List<Booking> bookings = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (status == null) {
            status = ReservationStatus.PENDING;
        }
    }

    public Reservation() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public Guest getOrganizerGuest() { return organizerGuest; }
    public void setOrganizerGuest(Guest organizerGuest) { this.organizerGuest = organizerGuest; }

    public LocalDate getCheckIn() { return checkIn; }
    public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }

    public LocalDate getCheckOut() { return checkOut; }
    public void setCheckOut(LocalDate checkOut) { this.checkOut = checkOut; }

    public String getReservationNumber() { return reservationNumber; }
    public void setReservationNumber(String reservationNumber) { this.reservationNumber = reservationNumber; }

    public String getGroupReference() { return groupReference; }
    public void setGroupReference(String groupReference) { this.groupReference = groupReference; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getSpecialRequests() { return specialRequests; }
    public void setSpecialRequests(String specialRequests) { this.specialRequests = specialRequests; }

    public ReservationStatus getStatus() { return status; }
    public void setStatus(ReservationStatus status) { this.status = status; }

    public boolean isDefaultRouteToMaster() { return defaultRouteToMaster; }
    public void setDefaultRouteToMaster(boolean defaultRouteToMaster) { this.defaultRouteToMaster = defaultRouteToMaster; }

    public TravelAgent getTravelAgent() { return travelAgent; }
    public void setTravelAgent(TravelAgent travelAgent) { this.travelAgent = travelAgent; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public List<Booking> getBookings() { return bookings; }
    public void setBookings(List<Booking> bookings) { this.bookings = bookings; }
}
