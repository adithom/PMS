package com.adith.os.HMS.booking;

import com.adith.os.HMS.booking.dto.BookingCreationDto;
import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.booking.dto.BookingUpdateDto;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import com.adith.os.HMS.billing.folio.FolioService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BookingService {

    private final PropertyRepository propertyRepository;
    private final RoomRepository roomRepository;
    private final GuestRepository guestRepository;
    private final UnitRepository unitRepository;
    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;

    private final FolioService folioService;

    public BookingService(PropertyRepository propertyRepository, RoomRepository roomRepository,
                          GuestRepository guestRepository, UnitRepository unitRepository,
                          BookingRepository bookingRepository, BookingMapper bookingMapper, FolioService folioService) {
        this.propertyRepository = propertyRepository;
        this.roomRepository = roomRepository;
        this.guestRepository = guestRepository;
        this.unitRepository = unitRepository;
        this.bookingRepository = bookingRepository;
        this.bookingMapper = bookingMapper;
        this.folioService = folioService;
    }

    @Transactional
    public BookingDto createBooking(@Valid BookingCreationDto bookingCreationDto, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        if (bookingCreationDto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking creation data is required");
        }

        // Validate dates
        if (bookingCreationDto.checkIn() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in date is required");
        }
        if (bookingCreationDto.checkOut() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-out date is required");
        }
        if (!bookingCreationDto.checkOut().isAfter(bookingCreationDto.checkIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out date must be after check-in date");
        }

        // Validate guest
        Guest guest = guestRepository.findById(bookingCreationDto.guestId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found"));

        Unit unit = null;
        if (bookingCreationDto.unitId() != null) {
            unit = unitRepository.findById(bookingCreationDto.unitId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));
        } else if (bookingCreationDto.roomId() != null) {
            // Fetch unit from room if roomId is provided
            Room room = roomRepository.findById(bookingCreationDto.roomId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));
            unit = room.getUnit();
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either unitId or roomId must be provided");
        }

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        // Validate room if provided
        Room room = null;
        if (bookingCreationDto.roomId() != null) {
            room = roomRepository.findById(bookingCreationDto.roomId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

            if (!room.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Room does not belong to the specified property");
            }

            // Check if room is available for the dates
            if (bookingRepository.existsOverlappingBooking(
                    room.getId(),
                    bookingCreationDto.checkIn(),
                    bookingCreationDto.checkOut())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Room is not available for the selected dates");
            }

            if (room.getStatus() == RoomStatus.IN_MAINTENANCE) {
                // Calculate days until check-in
                long daysUntilCheckIn = ChronoUnit.DAYS.between(LocalDate.now(), bookingCreationDto.checkIn());

                if (daysUntilCheckIn < 1) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Room is currently in maintenance. Please select another room or book at least 1 day in advance.");
                }
            }

            if (room.getStatus() == RoomStatus.INACTIVE) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Room is inactive and cannot be booked");
            }
        } else {
            // No specific room - check unit capacity
            long totalAvailableRooms = calculateAvailableRoomsForUnit(
                    unit.getId(),
                    bookingCreationDto.checkIn()
            );

            if (totalAvailableRooms == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot create booking: Unit has no rooms");
            }

            long overlappingBookings = bookingRepository.countOverlappingUnitBookings(
                    unit.getId(),
                    bookingCreationDto.checkIn(),
                    bookingCreationDto.checkOut());

            if (overlappingBookings >= totalAvailableRooms) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                overlappingBookings, totalAvailableRooms));
            }
        }



        try {
            Booking booking = bookingMapper.toEntity(bookingCreationDto, property, room, guest, unit);
            Booking savedBooking = bookingRepository.save(booking);

            // NEW: Automatically create a Master Folio for this new booking
            com.adith.os.HMS.billing.folio.dto.FolioCreationDto folioDto =
                    new com.adith.os.HMS.billing.folio.dto.FolioCreationDto(
                            savedBooking.getId(),
                            savedBooking.getGuest().getId(),
                            com.adith.os.HMS.billing.folio.FolioType.MASTER,
                            savedBooking.getSpecialRequests(),
                            "SYSTEM" // createdBy
                    );
            folioService.createFolio(propertyId, folioDto);

            return bookingMapper.toDto(savedBooking);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create booking: " + e.getMessage());
        }
    }

    public BookingDto getBookingById(UUID propertyId, UUID id) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + id));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        return bookingMapper.toDto(booking);
    }

    public List<BookingDto> getBookingsByProperty(UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Booking> bookings = bookingRepository.findByPropertyIdOrderByCheckInDesc(propertyId);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings for property: " + e.getMessage());
        }
    }

    public List<BookingDto> getBookingsByPropertyAndStatus(UUID propertyId, String status) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (status == null || status.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Booking> bookings = bookingRepository.findByPropertyIdAndStatus(propertyId, status.trim());
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings by status: " + e.getMessage());
        }
    }

    public List<BookingDto> getBookingsByPropertyAndCheckInRange(UUID propertyId, LocalDate checkInFrom, LocalDate checkInTo) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (checkInFrom == null || checkInTo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in date range is required");
        }
        if (checkInTo.isBefore(checkInFrom)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in end date must be after start date");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Booking> bookings = bookingRepository.findByPropertyIdAndCheckInBetween(
                    propertyId, checkInFrom, checkInTo);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings by date range: " + e.getMessage());
        }
    }

    public List<BookingDto> getBookingsByGuest(UUID propertyId, UUID guestId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (guestId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        if (!guestRepository.existsById(guestId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + guestId);
        }

        try {
            List<Booking> bookings = bookingRepository.findByPropertyIdAndGuestIdOrderByCheckInDesc(
                    propertyId, guestId);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings for guest: " + e.getMessage());
        }
    }

    public List<BookingDto> getBookingsByRoom(UUID propertyId, UUID roomId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (roomId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room ID is required");
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + roomId));

        if (!room.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the specified property");
        }

        try {
            List<Booking> bookings = bookingRepository.findByRoomIdOrderByCheckInDesc(roomId);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings for room: " + e.getMessage());
        }
    }

    public List<BookingDto> getBookingsByUnit(UUID propertyId, UUID unitId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (unitId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required");
        }

        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + unitId));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        try {
            List<Booking> bookings = bookingRepository.findByUnitIdOrderByCheckInDesc(unitId);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings for unit: " + e.getMessage());
        }
    }

    /**
     * Get all bookings for a property that are active on a specific date
     * @param propertyId The property ID
     * @param date The date to check
     * @param includeAllStatuses If true, include all booking statuses. If false, only include CONFIRMED and CHECKED_IN
     * @return List of bookings active on the specified date
     */
    public List<BookingDto> getBookingsByPropertyAndDate(UUID propertyId, LocalDate date, boolean includeAllStatuses) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (date == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Booking> bookings;

            if (includeAllStatuses) {
                bookings = bookingRepository.findByPropertyIdAndDate(propertyId, date);
            } else {
                // Only get confirmed and checked-in bookings (active bookings)
                bookings = bookingRepository.findByPropertyIdAndDateAndStatuses(
                        propertyId,
                        date,
                        List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)
                );
            }

            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch bookings by date: " + e.getMessage());
        }
    }

    @Transactional
    public BookingDto updateBooking(UUID propertyId, UUID bookingId, @Valid BookingUpdateDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        // Validate required fields for full update
        if (dto.guestId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest ID is required for full update");
        }
        if (dto.unitId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required for full update");
        }
        if (dto.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required for full update");
        }
        if (dto.checkIn() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in date is required for full update");
        }
        if (dto.checkOut() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-out date is required for full update");
        }
        if (!dto.checkOut().isAfter(dto.checkIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out date must be after check-in date");
        }

        // Validate guest
        Guest guest = guestRepository.findById(dto.guestId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found"));

        // Validate unit
        Unit unit = unitRepository.findById(dto.unitId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        // Validate room if provided
        Room room = null;
        if (dto.roomId() != null) {
            room = roomRepository.findById(dto.roomId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

            if (!room.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Room does not belong to the specified property");
            }

            // Check availability only if room changed or dates changed
            if (!dto.roomId().equals(booking.getRoom() != null ? booking.getRoom().getId() : null) ||
                    !dto.checkIn().equals(booking.getCheckIn()) ||
                    !dto.checkOut().equals(booking.getCheckOut())) {
                if (bookingRepository.existsOverlappingBookingExcludingCurrent(
                        room.getId(), dto.checkIn(), dto.checkOut(), bookingId)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Room is not available for the selected dates");
                }
            }
        } else {
            // No specific room - check unit capacity
            long totalRoomsInUnit = bookingRepository.countRoomsInUnit(unit.getId());

            if (totalRoomsInUnit == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot update booking: Unit has no rooms");
            }

            long overlappingBookings = bookingRepository.countOverlappingUnitBookingsExcludingCurrent(
                    unit.getId(),
                    dto.checkIn(),
                    dto.checkOut(),
                    bookingId);

            if (overlappingBookings >= totalRoomsInUnit) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                overlappingBookings, totalRoomsInUnit));
            }
        }

        try {
            // Full update
            booking.setGuest(guest);
            booking.setUnit(unit);
            booking.setRoom(room);
            booking.setStatus(dto.status());
            booking.setCheckIn(dto.checkIn());
            booking.setCheckOut(dto.checkOut());
            booking.setAdults(dto.adults() != null ? dto.adults() : 1);
            booking.setChildren(dto.children() != null ? dto.children() : 0);
            booking.setCurrency(dto.currency() != null ? dto.currency().trim() : "INR");
            booking.setTotalPrice(dto.totalPrice() != null ? dto.totalPrice() : BigDecimal.ZERO);
            booking.setPaidAmount(dto.paidAmount()!= null ? dto.paidAmount() : BigDecimal.ZERO);
            booking.setSpecialRequests(dto.specialRequests());

            Booking savedBooking = bookingRepository.save(booking);
            return bookingMapper.toDto(savedBooking);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update booking: " + e.getMessage());
        }
    }

    @Transactional
    public BookingDto partialUpdateBooking(UUID propertyId, UUID bookingId, BookingUpdateDto dto) {
        // Validate inputs
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        // Verify property exists
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        // Find booking and verify ownership
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        try {
            // Calculate effective dates (using new values if provided, otherwise existing)
            LocalDate newCheckIn = dto.checkIn() != null ? dto.checkIn() : booking.getCheckIn();
            LocalDate newCheckOut = dto.checkOut() != null ? dto.checkOut() : booking.getCheckOut();

            // Validate date range
            if (!newCheckOut.isAfter(newCheckIn)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Check-out date must be after check-in date");
            }

            // Track if dates changed
            boolean datesChanged = !newCheckIn.equals(booking.getCheckIn()) ||
                    !newCheckOut.equals(booking.getCheckOut());

            // Update guest if provided
            if (dto.guestId() != null) {
                Guest guest = guestRepository.findById(dto.guestId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found"));
                booking.setGuest(guest);
            }

            // Update unit if provided
            Unit effectiveUnit = booking.getUnit();
            if (dto.unitId() != null) {
                Unit unit = unitRepository.findById(dto.unitId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

                if (!unit.getProperty().getId().equals(propertyId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Unit does not belong to the specified property");
                }
                booking.setUnit(unit);
                effectiveUnit = unit;
            }

            // Handle room assignment and availability checks
            Room effectiveRoom = booking.getRoom();
            boolean roomChanged = false;

            if (dto.roomId() != null) {
                Room room = roomRepository.findById(dto.roomId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

                if (!room.getProperty().getId().equals(propertyId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Room does not belong to the specified property");
                }

                UUID currentRoomId = booking.getRoom() != null ? booking.getRoom().getId() : null;
                roomChanged = !dto.roomId().equals(currentRoomId);

                booking.setRoom(room);
                effectiveRoom = room;
            }

            // Availability checks - only if dates or room changed
            if (datesChanged || roomChanged) {
                if (effectiveRoom != null) {
                    // Room-specific booking - check room availability
                    if (bookingRepository.existsOverlappingBookingExcludingCurrent(
                            effectiveRoom.getId(), newCheckIn, newCheckOut, bookingId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Room is not available for the selected dates");
                    }
                } else {
                    // Unit-level booking - check unit capacity
                    int totalRoomsInUnit = effectiveUnit.getTotalRooms();

                    if (totalRoomsInUnit == 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot update booking: Unit has no rooms");
                    }

                    long unitLevelBookings = bookingRepository.countOverlappingUnitBookingsExcludingCurrent(
                            effectiveUnit.getId(),
                            newCheckIn,
                            newCheckOut,
                            bookingId);

                    long roomSpecificBookings = bookingRepository.countOverlappingRoomBookingsInUnitExcludingCurrent(
                            effectiveUnit.getId(),
                            newCheckIn,
                            newCheckOut,
                            bookingId);

                    long totalOverlappingBookings = unitLevelBookings + roomSpecificBookings;

                    if (totalOverlappingBookings >= totalRoomsInUnit) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                        totalOverlappingBookings, totalRoomsInUnit));
                    }
                }
            }

            // Update dates
            if (dto.checkIn() != null) {
                booking.setCheckIn(dto.checkIn());
            }

            if (dto.checkOut() != null) {
                booking.setCheckOut(dto.checkOut());
            }

            // Update other fields
            if (dto.status() != null) {
                booking.setStatus(dto.status());
            }

            if (dto.adults() != null) {
                booking.setAdults(dto.adults());
            }

            if (dto.children() != null) {
                booking.setChildren(dto.children());
            }

            if (dto.currency() != null && !dto.currency().isBlank()) {
                booking.setCurrency(dto.currency().trim());
            }

            if (dto.totalPrice() != null) {
                booking.setTotalPrice(dto.totalPrice());
            }

            if (dto.paidAmount() != null) {
                booking.setPaidAmount(dto.paidAmount());
            }

            if (dto.specialRequests() != null) {
                booking.setSpecialRequests(dto.specialRequests());
            }


            Booking savedBooking = bookingRepository.save(booking);
            return bookingMapper.toDto(savedBooking);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to partially update booking: " + e.getMessage());
        }
    }

    @Transactional
    public BookingDto updateBookingStatus(UUID propertyId, UUID bookingId, BookingStatus status) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        try {
            booking.setStatus(status);
            Booking savedBooking = bookingRepository.save(booking);
            return bookingMapper.toDto(savedBooking);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update booking status: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteBooking(UUID propertyId, UUID bookingId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (bookingId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        try {
            bookingRepository.delete(booking);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to delete booking: " + e.getMessage());
        }
    }

    @Transactional
    public BookingDto assignRoomToBooking(UUID propertyId, UUID bookingId, UUID roomId) {
        // Validate
        if (propertyId == null || bookingId == null || roomId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required parameters");
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        // Validate room belongs to same property and unit
        if (!room.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the specified property");
        }

        if (!room.getUnit().getId().equals(booking.getUnit().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the booking's unit");
        }

        // Check room status
        if (room.getStatus() == RoomStatus.INACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot assign inactive room to booking");
        }

        if (room.getStatus() == RoomStatus.IN_MAINTENANCE) {
            // Calculate days until check-in
            long daysUntilCheckIn = ChronoUnit.DAYS.between(LocalDate.now(), booking.getCheckIn());

            if (daysUntilCheckIn < 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot assign room in maintenance. Room must be available at least 1 day before check-in.");
            }
            // If check-in is 1+ days away, allow assignment (grace period)
        }

        if (room.getStatus() == RoomStatus.QUEUED_FOR_MAINTENANCE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot assign room that is queued for maintenance. Please select another room.");
        }

        // Check if room is available (no overlapping bookings)
        if (bookingRepository.existsOverlappingBookingExcludingCurrent(
                room.getId(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                bookingId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Room is not available for the booking dates");
        }

        // Assign room
        booking.setRoom(room);
        Booking savedBooking = bookingRepository.save(booking);

        return bookingMapper.toDto(savedBooking);
    }

    // Auto-assign room at check-in
    @Transactional
    public BookingDto checkInBooking(UUID propertyId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        // Auto-assign room if not already assigned
        if (booking.getRoom() == null) {
            Room availableRoom = findAvailableRoomInUnit(
                    booking.getUnit().getId(),
                    booking.getCheckIn(),
                    booking.getCheckOut()
            );

            if (availableRoom == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No available rooms in unit for check-in. Please assign manually.");
            }

            // Use the assignRoomToBooking method for consistent validation
            try {
                assignRoomToBooking(propertyId, bookingId, availableRoom.getId());
                // Reload booking to get updated room assignment
                booking = bookingRepository.findById(bookingId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            } catch (ResponseStatusException e) {
                // If assignment fails, wrap in more specific message
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Failed to auto-assign room: " + e.getReason());
            }
        }

        // Change status to CHECKED_IN
        booking.setStatus(BookingStatus.CHECKED_IN);

        Booking savedBooking = bookingRepository.save(booking);
        return bookingMapper.toDto(savedBooking);
    }

    //Helper to find available room in unit
    private Room findAvailableRoomInUnit(UUID unitId, LocalDate checkIn, LocalDate checkOut) {
        // Get all active rooms in unit
        List<Room> activeRooms = roomRepository.findByUnitIdAndStatus(unitId, RoomStatus.ACTIVE);

        // Get all conflicting bookings in the unit
        List<Booking> conflictingBookings = bookingRepository.findConflictingBookingsForUnit(
                unitId,
                checkIn,
                checkOut,
                List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)
        );

        // Get IDs of booked rooms
        Set<UUID> bookedRoomIds = conflictingBookings.stream()
                .filter(b -> b.getRoom() != null)
                .map(b -> b.getRoom().getId())
                .collect(Collectors.toSet());

        // Find first available room
        return activeRooms.stream()
                .filter(room -> !bookedRoomIds.contains(room.getId()))
                .findFirst()
                .orElse(null);
    }

    //helper
    private long calculateAvailableRoomsForUnit(UUID unitId, LocalDate checkInDate) {
        List<Room> allRooms = roomRepository.findByUnitId(unitId);
        long daysUntilCheckIn = ChronoUnit.DAYS.between(LocalDate.now(), checkInDate);

        return allRooms.stream()
                .filter(room -> {
                    // Always include ACTIVE rooms
                    if (room.getStatus() == RoomStatus.ACTIVE) {
                        return true;
                    }

                    // Include IN_MAINTENANCE rooms if booking is 1+ day in advance
                    if (room.getStatus() == RoomStatus.IN_MAINTENANCE && daysUntilCheckIn >= 1) {
                        return true;
                    }

                    // Exclude INACTIVE and QUEUED_FOR_MAINTENANCE
                    return false;
                })
                .count();
    }
}
