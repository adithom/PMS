package com.adith.os.HMS.booking;

import com.adith.os.HMS.booking.dto.BookingCreationDto;
import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.booking.dto.GuestSummaryDto;
import com.adith.os.HMS.reservation.ReservationStatus;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.mealplan.PropertyMealPlan;
import com.adith.os.HMS.property.mealplan.PropertyMealPlanRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.unit.Unit;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class BookingMapper {

    private final PropertyMealPlanRepository mealPlanRepository;

    public BookingMapper(PropertyMealPlanRepository mealPlanRepository) {
        this.mealPlanRepository = mealPlanRepository;
    }

    public Booking toEntity(@Valid BookingCreationDto bookingCreationDto, Property property,
                            Room room, Guest guest, Unit unit) {
        if (bookingCreationDto == null) return null;
        if (property == null) throw new IllegalArgumentException("Property is required");
        if (guest == null) throw new IllegalArgumentException("Guest is required");
        // REMOVED: Unit can be null for group booking creation

        // REMOVED: Status validation - now handled by compact constructor with default

        long nights = ChronoUnit.DAYS.between(bookingCreationDto.checkIn(), bookingCreationDto.checkOut());
        BigDecimal computedTotalPrice = (bookingCreationDto.nightlyRate() != null
                && bookingCreationDto.nightlyRate().compareTo(BigDecimal.ZERO) > 0 && nights > 0)
                ? bookingCreationDto.nightlyRate().multiply(BigDecimal.valueOf(nights))
                : BigDecimal.ZERO;

        // Create new booking using constructor
        Booking booking = new Booking(
                property,
                room,
                guest,
                unit,
                bookingCreationDto.checkIn(),
                bookingCreationDto.checkOut(),
                bookingCreationDto.adults(),
                bookingCreationDto.children(),
                bookingCreationDto.currency(),
                computedTotalPrice,
                bookingCreationDto.specialRequests(),
                bookingCreationDto.paidAmount(),
                bookingCreationDto.isTwinBed()
        );
        booking.setReferenceNumber(bookingCreationDto.referenceNumber());
        booking.setBookingSource(bookingCreationDto.bookingSource());
        booking.setMealPlanType(bookingCreationDto.mealPlanType());
        booking.setMealPlanPricePerNight(bookingCreationDto.mealPlanPricePerNight());
        booking.setMealPlanChildrenPricePerNight(bookingCreationDto.mealPlanChildrenPricePerNight());
        if (bookingCreationDto.extraBeds() != null) booking.setExtraBeds(bookingCreationDto.extraBeds());
        booking.setExtraBedRatePerNight(bookingCreationDto.extraBedRatePerNight());
        booking.setExtraBedChargeCode(bookingCreationDto.extraBedChargeCode());
        return booking;
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
                booking.isCancelled(),
                booking.getReservationStatus(),
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
                booking.getReservation() != null ? booking.getReservation().getId() : null,
                booking.getReservation() != null ? booking.getReservation().getReservationNumber() : null,
                booking.isTwinBed(),
                booking.getReferenceNumber(),
                booking.getTravelAgent() != null ? booking.getTravelAgent().getId() : null,
                booking.getTravelAgent() != null ? booking.getTravelAgent().getName() : null,
                booking.getContactPerson() != null ? booking.getContactPerson().getId() : null,
                booking.getContactPerson() != null ? booking.getContactPerson().getName() : null,
                booking.getMealPlanType(),
                booking.getMealPlanType() != null ? booking.getMealPlanType().getDisplayName() : null,
                resolveMealPlanPrice(booking),
                resolveMealPlanChildrenPrice(booking),
                booking.getExtraBeds(),
                booking.getExtraBedRatePerNight(),
                booking.getExtraBedChargeCode(),
                resolveNightlyRate(booking),
                resolveNightlyRateExTax(booking),
                booking.getBookingSource(),
                booking.getCancellationReason(),
                booking.getRescheduleReason(),
                booking.getOriginalCheckIn(),
                booking.getOriginalCheckOut(),
                mapAdditionalGuests(booking)
        );
    }

    private RoomAssignment resolveActiveAssignment(Booking booking) {
        if (booking.getRoomAssignments() == null || booking.getRoomAssignments().isEmpty()) return null;
        return booking.getRoomAssignments().stream()
                .filter(a -> a.getStatus() == RoomAssignmentStatus.SCHEDULED
                        || a.getStatus() == RoomAssignmentStatus.ACTIVE)
                .min(Comparator.comparing(RoomAssignment::getStartDate))
                .orElse(null);
    }

    private BigDecimal resolveNightlyRate(Booking booking) {
        RoomAssignment a = resolveActiveAssignment(booking);
        if (a != null) return a.getNightlyRate();
        return booking.getExpectedNightlyRate();
    }

    private BigDecimal resolveNightlyRateExTax(Booking booking) {
        RoomAssignment a = resolveActiveAssignment(booking);
        return a != null ? a.getNightlyRateExTax() : null;
    }

    private BigDecimal resolveMealPlanPrice(Booking booking) {
        if (booking.getMealPlanType() == null || booking.getProperty() == null) return null;
        if (booking.getMealPlanPricePerNight() != null) return booking.getMealPlanPricePerNight();
        return mealPlanRepository
                .findByPropertyIdAndMealPlanType(booking.getProperty().getId(), booking.getMealPlanType())
                .map(PropertyMealPlan::getPricePerNight)
                .orElse(null);
    }

    private BigDecimal resolveMealPlanChildrenPrice(Booking booking) {
        if (booking.getMealPlanType() == null || booking.getProperty() == null) return null;
        if (booking.getMealPlanChildrenPricePerNight() != null) return booking.getMealPlanChildrenPricePerNight();
        return mealPlanRepository
                .findByPropertyIdAndMealPlanType(booking.getProperty().getId(), booking.getMealPlanType())
                .map(PropertyMealPlan::getChildrenPricePerNight)
                .orElse(null);
    }

    private List<GuestSummaryDto> mapAdditionalGuests(Booking booking) {
        if (booking.getAdditionalGuests() == null || booking.getAdditionalGuests().isEmpty()) {
            return List.of();
        }
        return booking.getAdditionalGuests().stream()
                .map(g -> new GuestSummaryDto(g.getId(), g.getFullName(), g.getEmail(), g.getPhone()))
                .collect(Collectors.toList());
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
