package com.adith.os.HMS.unit;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.room.Room;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "unit")
public class Unit {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @NotBlank(message = "Unit name is required")
    @Column(nullable = false)
    private String name;

    @Column(name = "sort_order", nullable = false, columnDefinition = "integer default 0")
    private Integer sortOrder = 0;

    @Column(name = "total_rooms", nullable = false, columnDefinition = "integer default 0")
    private Integer totalRooms = 0;

    @OneToMany(mappedBy = "unit", cascade = CascadeType.ALL)
    private List<Room> rooms;

    @OneToMany(mappedBy = "unit", cascade = CascadeType.ALL)
    private List<Booking> bookings;

    public Unit() {
    }

    public Unit(String name, Property property, Integer sortOrder, Integer totalRooms) {
        this.totalRooms = totalRooms;
        this.name = name;
        this.property = property;
        this.sortOrder = sortOrder;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Integer getTotalRooms() {
        return totalRooms;
    }

    protected void setTotalRooms(Integer totalRooms) {
        this.totalRooms = totalRooms;
    }

    public List<Room> getRooms() {
        return rooms;
    }

    public void setRooms(List<Room> rooms) {
        this.rooms = rooms;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
