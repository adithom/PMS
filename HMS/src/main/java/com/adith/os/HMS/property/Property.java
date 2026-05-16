package com.adith.os.HMS.property;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.unit.Unit;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.sql.Time;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "property")
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotBlank(message = "Property name is required")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "Property code is required")
    @Column(unique = true, nullable = false)
    private String code;

    private String address;
    private String region;

    @Column(nullable = false, columnDefinition = "text default 'IN'")
    private String country = "IN";

    @Column(name = "postal_code")
    private String postalCode;

    private String phone;

    @Column(name = "total_rooms")
    private Integer totalRooms;

    @Column(name = "gst_number")
    private String gstNumber;

    @Column(name = "cin", length = 21)
    private String cin;

    @Column(name = "udyam_registration_no", length = 30)
    private String udyamRegistrationNo;

    @Column(name = "pan", length = 10)
    private String pan;

    @Column(name = "state_name", length = 50)
    private String stateName;

    @Column(name = "state_code", length = 4)
    private String stateCode;

    @Column(name = "fssai_number", length = 20)
    private String fssaiNumber;

    @Column(name = "walk_in_guest_id")
    private java.util.UUID walkInGuestId;

    @Column(name = "checkin_time", columnDefinition = "time default '10:00:00'")
    private Time checkInTime;

    @Column(name = "checkout_time", columnDefinition = "time default '14:00:00'")
    private Time checkOutTime;

    @Column(name = "extra_bed_rate_per_night", precision = 10, scale = 2)
    private BigDecimal extraBedRatePerNight;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Unit> units;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Room> rooms;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Booking> bookings;


    public Property() {
    }

    public Property(String name, String code, String address, String region, String country, String postalCode, String phone, Integer totalRooms, String gstNumber) {
        this.name = name;
        this.code = code;
        this.address = address;
        this.region = region;
        this.country = country != null ? country : "IN";
        this.postalCode = postalCode;
        this.phone = phone;
        this.totalRooms = totalRooms != null ? totalRooms : 0;
        this.gstNumber = gstNumber;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public Integer getTotalRooms() {
        return totalRooms;
    }

    protected void setTotalRooms(Integer totalRooms) {
        this.totalRooms = totalRooms;
    }

    public String getGstNumber() {
        return gstNumber;
    }

    public void setGstNumber(String gstNumber) {
        this.gstNumber = gstNumber;
    }

    public String getCin() { return cin; }
    public void setCin(String cin) { this.cin = cin; }

    public String getUdyamRegistrationNo() { return udyamRegistrationNo; }
    public void setUdyamRegistrationNo(String udyamRegistrationNo) { this.udyamRegistrationNo = udyamRegistrationNo; }

    public String getPan() { return pan; }
    public void setPan(String pan) { this.pan = pan; }

    public String getStateName() { return stateName; }
    public void setStateName(String stateName) { this.stateName = stateName; }

    public String getStateCode() { return stateCode; }
    public void setStateCode(String stateCode) { this.stateCode = stateCode; }

    public String getFssaiNumber() { return fssaiNumber; }
    public void setFssaiNumber(String fssaiNumber) { this.fssaiNumber = fssaiNumber; }

    public java.util.UUID getWalkInGuestId() {
        return walkInGuestId;
    }

    public void setWalkInGuestId(java.util.UUID walkInGuestId) {
        this.walkInGuestId = walkInGuestId;
    }

    public Time getCheckInTime() {
        return checkInTime;
    }

    public void setCheckInTime(Time checkInTime) {
        this.checkInTime = checkInTime;
    }

    public Time getCheckOutTime() {
        return checkOutTime;
    }

    public void setCheckOutTime(Time checkOutTime) {
        this.checkOutTime = checkOutTime;
    }

    public BigDecimal getExtraBedRatePerNight() {
        return extraBedRatePerNight;
    }

    public void setExtraBedRatePerNight(BigDecimal extraBedRatePerNight) {
        this.extraBedRatePerNight = extraBedRatePerNight;
    }

    public List<Unit> getUnits() {
        return units;
    }

    public void setUnits(List<Unit> units) {
        this.units = units;
    }

    public List<Room> getRooms() {
        return rooms;
    }

    public void setRooms(List<Room> rooms) {
        this.rooms = rooms;
    }

    public List<Booking> getBookings() {
        return bookings;
    }

    public void setBookings(List<Booking> bookings) {
        this.bookings = bookings;
    }
}
