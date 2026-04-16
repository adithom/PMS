package com.adith.os.HMS.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.adith.os.HMS.booking.dto.ExtendBookingRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
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
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentService;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.property.mealplan.PropertyMealPlan;
import com.adith.os.HMS.property.mealplan.PropertyMealPlanRepository;
import com.adith.os.HMS.travelagent.TravelAgent;
import com.adith.os.HMS.travelagent.TravelAgentService;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;

import jakarta.transaction.Transactional;
import jakarta.validation.Valid;

@Service
public class BookingService {

    private final PropertyRepository propertyRepository;
    private final RoomRepository roomRepository;
    private final GuestRepository guestRepository;
    private final UnitRepository unitRepository;
    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;

    private final FolioService folioService;
    private final RoomAssignmentService roomAssignmentService;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final TravelAgentService travelAgentService;
    private final PropertyMealPlanRepository mealPlanRepository;

    // Active statuses for room assignments
    private static final List<RoomAssignmentStatus> ACTIVE_ASSIGNMENT_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE);

    // Booking statuses that consume unit capacity before a room is assigned
    private static final List<BookingStatus> CAPACITY_HOLD_BOOKING_STATUSES =
            List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);

    public BookingService(PropertyRepository propertyRepository, RoomRepository roomRepository,
                          GuestRepository guestRepository, UnitRepository unitRepository,
                          BookingRepository bookingRepository, BookingMapper bookingMapper,
                          FolioService folioService, RoomAssignmentService roomAssignmentService,
                          RoomAssignmentRepository roomAssignmentRepository,
                          TravelAgentService travelAgentService,
                          PropertyMealPlanRepository mealPlanRepository) {
        this.propertyRepository = propertyRepository;
        this.roomRepository = roomRepository;
        this.guestRepository = guestRepository;
        this.unitRepository = unitRepository;
        this.bookingRepository = bookingRepository;
        this.bookingMapper = bookingMapper;
        this.folioService = folioService;
        this.roomAssignmentService = roomAssignmentService;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.travelAgentService = travelAgentService;
        this.mealPlanRepository = mealPlanRepository;
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
        if (bookingCreationDto.checkIn().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in date cannot be in the past");
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

            // Check if room is available for the dates (using RoomAssignment table)
            boolean hasConflict = roomAssignmentRepository.existsOverlappingAssignment(
                    room.getId(),
                    bookingCreationDto.checkIn(),
                    bookingCreationDto.checkOut(),
                    List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED));
            if (hasConflict) {
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

            long totalOccupied = getConsumedUnitCapacity(
                    unit.getId(), bookingCreationDto.checkIn(), bookingCreationDto.checkOut());

            if (totalOccupied >= totalAvailableRooms) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                totalOccupied, totalAvailableRooms));
            }
        }



        try {
            Booking booking = bookingMapper.toEntity(bookingCreationDto, property, room, guest, unit);

            TravelAgent travelAgent = travelAgentService.resolveOrCreate(
                    bookingCreationDto.travelAgentId(), bookingCreationDto.newTravelAgent());
            if (travelAgent != null) {
                booking.setTravelAgent(travelAgent);
                booking.setCommissionRate(travelAgent.getCommissionRate());
            }

            if (bookingCreationDto.mealPlanType() != null) {
                PropertyMealPlan plan = mealPlanRepository
                        .findByPropertyIdAndMealPlanType(propertyId, bookingCreationDto.mealPlanType())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Meal plan " + bookingCreationDto.mealPlanType() + " is not configured for this property"));
                if (!plan.isActive()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Meal plan " + bookingCreationDto.mealPlanType() + " is not active");
                }
                booking.setMealPlanType(bookingCreationDto.mealPlanType());
            }

            Booking savedBooking = bookingRepository.save(booking);

            // NEW: Automatically create a Master Folio for this new booking
            com.adith.os.HMS.billing.folio.dto.FolioCreationDto folioDto =
                    new com.adith.os.HMS.billing.folio.dto.FolioCreationDto(
                            savedBooking.getId(),
                            savedBooking.getGuest().getId(),
                            com.adith.os.HMS.billing.folio.FolioType.MASTER,
                            savedBooking.getSpecialRequests(),
                            "SYSTEM",// createdBy
                            null     // routedToFolioId - not set for master folio
                    );
            folioService.createFolio(propertyId, folioDto);

            // Create initial room assignment if room is assigned
            roomAssignmentService.createInitialAssignment(savedBooking, bookingCreationDto.totalPrice());

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
        if (dto.isTwinBed() == null) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Twin Bedded Status is required for full update");
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
                if (roomAssignmentRepository.existsOverlappingAssignmentExcludingBooking(
                        room.getId(), dto.checkIn(), dto.checkOut(), bookingId,
                        List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED))) {
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

            long totalOccupied = getConsumedUnitCapacityExcludingBooking(
                    unit.getId(), dto.checkIn(), dto.checkOut(), bookingId);

            if (totalOccupied >= totalRoomsInUnit) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                totalOccupied, totalRoomsInUnit));
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
            booking.setTwinBed(dto.isTwinBed());
            booking.setReferenceNumber(dto.referenceNumber());

            // Travel agent: null travelAgentId on PUT means remove the association
            if (dto.travelAgentId() != null) {
                TravelAgent agent = travelAgentService.resolveOrCreate(dto.travelAgentId(), null);
                booking.setTravelAgent(agent);
                booking.setCommissionRate(agent.getCommissionRate());
            } else {
                booking.setTravelAgent(null);
                booking.setCommissionRate(null);
            }

            // Sync dates before saving
            roomAssignmentService.syncDatesForBookingUpdate(bookingId, dto.checkIn(), dto.checkOut());

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
                    if (roomAssignmentRepository.existsOverlappingAssignmentExcludingBooking(
                            effectiveRoom.getId(), newCheckIn, newCheckOut, bookingId,
                            List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED))) {
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

                    long totalOccupied = getConsumedUnitCapacityExcludingBooking(
                            effectiveUnit.getId(), newCheckIn, newCheckOut, bookingId);

                    if (totalOccupied >= totalRoomsInUnit) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                String.format("Unit capacity exceeded: %d/%d rooms already booked for these dates",
                                        totalOccupied, totalRoomsInUnit));
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

            if (dto.isTwinBed() != null) {
              booking.setTwinBed(dto.isTwinBed());
            }

            if (dto.referenceNumber() != null) {
                booking.setReferenceNumber(dto.referenceNumber());
            }

            // Travel agent partial update
            if (Boolean.TRUE.equals(dto.clearTravelAgent())) {
                booking.setTravelAgent(null);
                booking.setCommissionRate(null);
            } else if (dto.travelAgentId() != null) {
                TravelAgent agent = travelAgentService.resolveOrCreate(dto.travelAgentId(), null);
                booking.setTravelAgent(agent);
                booking.setCommissionRate(agent.getCommissionRate());
            }

            // Meal plan partial update
            if (Boolean.TRUE.equals(dto.clearMealPlan())) {
                booking.setMealPlanType(null);
            } else if (dto.mealPlanType() != null) {
                PropertyMealPlan plan = mealPlanRepository
                        .findByPropertyIdAndMealPlanType(propertyId, dto.mealPlanType())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Meal plan " + dto.mealPlanType() + " is not configured for this property"));
                if (!plan.isActive()) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Meal plan " + dto.mealPlanType() + " is not active");
                }
                booking.setMealPlanType(dto.mealPlanType());
            }

            if (datesChanged) {
                roomAssignmentService.syncDatesForBookingUpdate(bookingId, newCheckIn, newCheckOut);
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

            if (status == BookingStatus.CANCELLED || status == BookingStatus.NO_SHOW) {
                roomAssignmentService.cancelAssignmentsForBooking(bookingId);
            }

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

        // Check if room is available (using RoomAssignment table)
        boolean hasConflict = roomAssignmentRepository.existsOverlappingAssignment(
                room.getId(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED));
        if (hasConflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Room is not available for the booking dates");
        }

        // Assign room
        booking.setRoom(room);
        Booking savedBooking = bookingRepository.save(booking);

        // Create room assignment if none exists
        roomAssignmentService.createInitialAssignment(savedBooking, savedBooking.getTotalPrice());

        return bookingMapper.toDto(savedBooking);
    }

    @Transactional
    public BookingDto extendBooking(UUID propertyId, UUID bookingId, @Valid ExtendBookingRequestDto dto) {
        // 1. Fetch and Validate Booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking does not belong to the specified property");
        }

        LocalDate oldCheckOut = booking.getCheckOut();
        LocalDate newCheckOut = dto.newCheckOutDate();

        // 2. Validate Dates
        if (newCheckOut == null || !newCheckOut.isAfter(oldCheckOut)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New check-out date must be strictly after the current check-out date");
        }

        // 3. Check Availability (using RoomAssignment table)
        if (booking.getRoom() != null) {
            // Room-level availability check via assignments
            boolean conflict = roomAssignmentRepository.existsOverlappingAssignment(
                    booking.getRoom().getId(),
                    oldCheckOut, // Start checking from the old checkout date
                    newCheckOut,
                    List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED)
            );
            if (conflict) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot extend: Room " + booking.getRoom().getNumber() + " is already booked for these dates. A room move is required.");
            }
        } else {
            // Unit-level capacity check via assignments
            List<RoomAssignment> unitAssignments = roomAssignmentRepository.findConflictingAssignmentsForUnit(
                    booking.getUnit().getId(), oldCheckOut, newCheckOut, ACTIVE_ASSIGNMENT_STATUSES);
            long occupiedRooms = unitAssignments.stream()
                    .map(ra -> ra.getRoom().getId()).distinct().count();
            int totalRooms = booking.getUnit().getTotalRooms();

            if (occupiedRooms >= totalRooms) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot extend: Unit category is fully booked for those dates.");
            }
        }

        // 4. Calculate Financials
        long originalNights = booking.getStayDuration();
        long extraNights = ChronoUnit.DAYS.between(oldCheckOut, newCheckOut);

        BigDecimal nightlyRateToApply;

        if (dto.extensionNightlyRate() != null) {
            // Use the explicit rate provided by the front desk
            nightlyRateToApply = dto.extensionNightlyRate();
        } else {
            // Automatically calculate the average nightly rate from the current stay
            Folio masterFolio = booking.getMasterFolio();
            if (masterFolio != null && originalNights > 0) {
                BigDecimal currentRoomTotal = masterFolio.getCharges().stream()
                        .filter(c -> !c.isVoided() && c.getChargeCode().isRoomRent())
                        .map(FolioCharge::getTotalAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                nightlyRateToApply = currentRoomTotal.divide(
                        BigDecimal.valueOf(originalNights),
                        2,
                        java.math.RoundingMode.HALF_UP
                );
            } else {
                // Fallback: divide total price by nights
                long divisor = originalNights > 0 ? originalNights : 1;
                nightlyRateToApply = booking.getTotalPrice().divide(
                        BigDecimal.valueOf(divisor),
                        2,
                        java.math.RoundingMode.HALF_UP
                );
            }
        }

        BigDecimal extraTotalCost = nightlyRateToApply.multiply(BigDecimal.valueOf(extraNights));

        // 5. Update Booking
        booking.setTotalPrice(booking.getTotalPrice().add(extraTotalCost));
        booking.setCheckOut(newCheckOut);

        // 6. Post Charges to Folio
        Folio folio = booking.getMasterFolio();
        if (folio != null) {
            // Prevent modifying closed/posted folios
            if (folio.getStatus() == com.adith.os.HMS.billing.folio.FolioStatus.POSTED ||
                    folio.getStatus() == com.adith.os.HMS.billing.folio.FolioStatus.CLOSED) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot extend booking automatically: Master folio is already closed or posted. Please reopen it first.");
            }

            for (int i = 0; i < extraNights; i++) {
                LocalDate chargeDate = oldCheckOut.plusDays(i);

                com.adith.os.HMS.billing.folio.dto.ChargeCreationDto chargeDto =
                        new com.adith.os.HMS.billing.folio.dto.ChargeCreationDto(
                                chargeDate,
                                com.adith.os.HMS.billing.folio.ChargeCode.ROOM_RENT,
                                "Booking Extension - Room Rent",
                                nightlyRateToApply,
                                BigDecimal.ONE,
                                BigDecimal.ZERO, // Tax rate
                                BigDecimal.ZERO, // Discount rate
                                "BOOKING",
                                bookingId,
                                dto.notes() != null ? dto.notes() : "Extended Stay",
                                "SYSTEM"
                        );
                folioService.addCharge(propertyId, folio.getId(), chargeDto);
            }
        }

        Booking savedBooking = bookingRepository.save(booking);

        // Sync: extend the active/scheduled RoomAssignment's endDate to match
        roomAssignmentService.extendActiveAssignment(bookingId, newCheckOut);

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

        // Force-activate all SCHEDULED assignments — staff is physically checking in the guest
        roomAssignmentService.forceActivateAssignments(savedBooking.getId());

        return bookingMapper.toDto(savedBooking);
    }

    @Transactional
    public BookingDto checkOutBooking(UUID propertyId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking does not belong to the specified property");
        }

        // Optional: Prevent checkout if folio has a balance
        Folio masterFolio = booking.getMasterFolio();
        if (masterFolio != null && !masterFolio.isFullyPaid()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot check out: Folio has an outstanding balance of " + masterFolio.getBalanceDue());
        }

        booking.setStatus(BookingStatus.CHECKED_OUT);
        Booking savedBooking = bookingRepository.save(booking);

        // Close all open folios on this booking
        if (masterFolio != null) {
            folioService.closeOpenFoliosForBooking(bookingId);
        }

        // Complete all room assignments
        roomAssignmentService.completeAssignments(savedBooking.getId());

        return bookingMapper.toDto(savedBooking);
    }

    @Transactional
    public BookingDto checkoutEarly(UUID propertyId, UUID bookingId, LocalDate newCheckOutDate, String policy, BigDecimal customRoomCharge) {
        // 1. Update Booking Inventory
        Booking booking = bookingRepository.findById(bookingId).orElseThrow();
        booking.setCheckOut(newCheckOutDate);
        booking.setStatus(BookingStatus.CHECKED_OUT);

        // 2. Fetch the Master Folio
        Folio folio = booking.getMasterFolio();

        // 3. Handle Financials based on Policy
        switch (policy) {
            case "NO_CHANGE":
                // Do nothing. They pay for the full original stay.
                break;

            case "REFUND_UNUSED_NIGHTS":
                // Find all ROOM_RENT charges that are on or AFTER the new checkout date
                List<FolioCharge> futureRoomCharges = folio.getCharges().stream()
                        .filter(charge -> !charge.isVoided())
                        .filter(charge -> charge.getChargeCode().isRoomRent()) // ONLY touch room rent
                        .filter(charge -> !charge.getChargeDate().isBefore(newCheckOutDate))
                        .collect(Collectors.toList());

                // Void them or post a negative adjustment
                for (FolioCharge charge : futureRoomCharges) {
                    folioService.voidCharge(propertyId, folio.getId(), charge.getId(), "Early Checkout - Unused Night", "SYSTEM");
                }
                break;

            case "CUSTOM":
                // 1. Calculate current total of valid Room Rent charges
                BigDecimal currentRoomRentTotal = folio.getCharges().stream()
                        .filter(charge -> !charge.isVoided())
                        .filter(charge -> charge.getChargeCode().isRoomRent())
                        .map(FolioCharge::getTotalAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                // --- NEW: STRICT VALIDATION ---
                if (customRoomCharge.compareTo(BigDecimal.ZERO) < 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Custom room charge cannot be negative.");
                }

                if (customRoomCharge.compareTo(currentRoomRentTotal) > 0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Custom room charge cannot exceed the original total room rent.");
                }
                // ------------------------------

                // 2. Calculate the difference
                BigDecimal adjustmentNeeded = currentRoomRentTotal.subtract(customRoomCharge);

                if (adjustmentNeeded.compareTo(BigDecimal.ZERO) > 0) {
                    // Create a negative charge to reduce the folio balance
                    ChargeCreationDto adjDto = new ChargeCreationDto(
                            LocalDate.now(),
                            ChargeCode.ROOM_RENT,
                            "Early Checkout Custom Adjustment",
                            adjustmentNeeded.negate(), // Make it negative
                            BigDecimal.ONE,
                            BigDecimal.ZERO, BigDecimal.ZERO, null, null, "Early Checkout", "SYSTEM"
                    );
                    folioService.addCharge(propertyId, folio.getId(), adjDto);
                }
                break;

            default:
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid early checkout policy");
        }

        // Sync: truncate active assignments and mark completed
        roomAssignmentService.truncateAndCompleteAssignments(bookingId, newCheckOutDate);

        bookingRepository.save(booking);

        // Close all open folios at checkout
        folioService.closeOpenFoliosForBooking(bookingId);

        return bookingMapper.toDto(booking);
    }

    //Helper to find available room in unit (uses RoomAssignment table)
    private Room findAvailableRoomInUnit(UUID unitId, LocalDate checkIn, LocalDate checkOut) {
        // Get all active rooms in unit
        List<Room> activeRooms = roomRepository.findByUnitIdAndStatus(unitId, RoomStatus.ACTIVE);

        // Get all conflicting room assignments in the unit
        List<RoomAssignment> conflictingAssignments = roomAssignmentRepository.findConflictingAssignmentsForUnit(
                unitId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);

        // Get IDs of occupied rooms
        Set<UUID> occupiedRoomIds = conflictingAssignments.stream()
                .map(ra -> ra.getRoom().getId())
                .collect(Collectors.toSet());

        // Find first available room
        return activeRooms.stream()
                .filter(room -> !occupiedRoomIds.contains(room.getId()))
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

    /**
     * Calculates the consumed capacity for a unit, combining two sources:
     * 1. Occupied rooms mapped in RoomAssignment
     * 2. Overlapping unassigned bookings holding capacity for this unit
     */
    private long getConsumedUnitCapacity(UUID unitId, LocalDate checkIn, LocalDate checkOut) {
        long occupiedRooms = roomAssignmentRepository.countDistinctOccupiedRoomsForUnit(
                unitId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);
        
        long unassignedBookings = bookingRepository.countUnassignedOverlappingUnitBookings(
                unitId, checkIn, checkOut, CAPACITY_HOLD_BOOKING_STATUSES);

        return occupiedRooms + unassignedBookings;
    }

    /**
     * Calculates the consumed capacity for a unit, combining two sources (excluding a given booking):
     * 1. Occupied rooms mapped in RoomAssignment (excluding given bookingId)
     * 2. Overlapping unassigned bookings holding capacity for this unit (excluding given bookingId)
     */
    private long getConsumedUnitCapacityExcludingBooking(UUID unitId, LocalDate checkIn, LocalDate checkOut, UUID excludedBookingId) {
        long occupiedRooms = roomAssignmentRepository.countDistinctOccupiedRoomsForUnitExcludingBooking(
                unitId, checkIn, checkOut, excludedBookingId, ACTIVE_ASSIGNMENT_STATUSES);

        long unassignedBookings = bookingRepository.countUnassignedOverlappingUnitBookingsExcludingCurrent(
                unitId, checkIn, checkOut, excludedBookingId, CAPACITY_HOLD_BOOKING_STATUSES);

        return occupiedRooms + unassignedBookings;
    }

    /**
     * Get all bookings that overlap with the provided date range.
     * Essential for tape charts and availability grids.
     */
    public List<BookingDto> getBookingsByDateRangeOverlap(UUID propertyId, LocalDate from, LocalDate to) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date range (from/to) is required");
        }
        if (to.isBefore(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be after or equal to start date");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            // Fetch bookings that intersect with the [from, to] window
            List<Booking> bookings = bookingRepository.findOverlappingBookings(propertyId, from, to);
            return bookingMapper.toDtoList(bookings);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch overlapping bookings: " + e.getMessage());
        }
    }
}
