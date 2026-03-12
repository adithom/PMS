package com.adith.os.HMS.booking;

import com.adith.os.HMS.booking.dto.BookingCreationDto;
import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.unit.Unit;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class BookingMapper {

    public Booking toEntity(@Valid BookingCreationDto bookingCreationDto, Property property,
                            Room room, Guest guest, Unit unit) {
        if (bookingCreationDto == null) return null;
        if (property == null) throw new IllegalArgumentException("Property is required");
        if (guest == null) throw new IllegalArgumentException("Guest is required");
        // REMOVED: Unit can be null for group booking creation

        // REMOVED: Status validation - now handled by compact constructor with default

        // Create new booking using constructor
        return new Booking(
                property,
                room,
                guest,
                unit,
                bookingCreationDto.checkIn(),
                bookingCreationDto.checkOut(),
                bookingCreationDto.adults(),      // Already defaults to 1 in DTO
                bookingCreationDto.children(),    // Already defaults to 0 in DTO
                bookingCreationDto.currency(),    // Already defaults to "INR" in DTO
                bookingCreationDto.totalPrice(),  // Already defaults to 0.0 in DTO
                bookingCreationDto.specialRequests(),  // ADDED: Special requests mapping
                bookingCreationDto.status(),      // Already defaults to PENDING in DTO
                bookingCreationDto.paidAmount()  // Already defaults to ZERO in DTO
        );
    }

    public BookingDto toDto(Booking booking) {
        if (booking == null) return null;

        return new BookingDto(
                booking.getId(),
                booking.getProperty().getId(),
                booking.getRoom() != null ? booking.getRoom().getNumber() : null,  // FIXED: Was getNumber()
                booking.getGuest().getId(),
                booking.getGuest().getFullName(),
                booking.getUnit() != null ? booking.getUnit().getId() : null,
                booking.getUnit() != null ? booking.getUnit().getName() : null,
                booking.getStatus(),          // CHANGED: Returns BookingStatus enum directly
                booking.getCheckIn(),
                booking.getCheckOut(),
                booking.getStayDuration(),
                booking.getAdults(),
                booking.getChildren(),
                booking.getCurrency(),
                booking.getTotalPrice(),
                booking.getPaidAmount(),
                booking.getBalanceDue(),      // Dynamically calculated due amount
                booking.isFullyPaid(),        // Payment completion status
                booking.getSpecialRequests(), // ADDED: Special requests in DTO
                booking.getCreatedAt(),
                booking.getPaymentProgress(),
                booking.getParentBooking() != null ? booking.getParentBooking().getId() : null,
                booking.isGroupMaster(),
                booking.getChildBookings() != null ? booking.getChildBookings().size() : 0
        );
    }

    public List<BookingDto> toDtoList(List<Booking> bookings) {
        if (bookings == null || bookings.isEmpty()) {
            return List.of();
        }

        return bookings.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}