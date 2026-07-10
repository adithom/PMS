package com.adith.os.HMS.tasks;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.booking.BookingMapper;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.guest.dto.GuestDto;
import com.adith.os.HMS.guest.GuestMapper;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.room.dto.RoomDto;
import com.adith.os.HMS.room.RoomMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TaskService {
    private final RoomRepository roomRepository;
    private final RoomMapper roomMapper;
    private final GuestRepository guestRepository;
    private final GuestMapper guestMapper;
    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;

    public TaskService(RoomRepository roomRepository, RoomMapper roomMapper,
                       GuestRepository guestRepository, GuestMapper guestMapper,
                       BookingRepository bookingRepository, BookingMapper bookingMapper) {
        this.roomRepository = roomRepository;
        this.roomMapper = roomMapper;
        this.guestRepository = guestRepository;
        this.guestMapper = guestMapper;
        this.bookingRepository = bookingRepository;
        this.bookingMapper = bookingMapper;
    }

    public List<RoomDto> getRoomsInMaintenance(UUID propertyId) {
        List<Room> rooms = roomRepository.findByPropertyIdOrderByNumber(propertyId).stream()
                .filter(r -> r.getStatus() == RoomStatus.IN_MAINTENANCE || r.getStatus() == RoomStatus.QUEUED_FOR_MAINTENANCE)
                .collect(Collectors.toList());
        return roomMapper.toDtoList(rooms);
    }

    public List<GuestDto> getInHouseGuestBirthdays(UUID propertyId) {
        LocalDate today = LocalDate.now();
        List<Guest> guests = guestRepository.findInHouseGuestsWithBirthday(propertyId, today.getMonthValue(), today.getDayOfMonth());
        return guestMapper.toDtoList(guests);
    }

    public List<BookingDto> getUnassignedUpcomingCheckins(UUID propertyId) {
        LocalDate today = LocalDate.now();
        LocalDate nextWeek = today.plusDays(7);
        List<Booking> bookings = bookingRepository.findUnassignedUpcomingBookings(
                propertyId,
                today,
                nextWeek
        );
        return bookingMapper.toDtoList(bookings);
    }
}
