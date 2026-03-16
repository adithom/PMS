package com.adith.os.HMS.roomassignment;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto;
import com.adith.os.HMS.roomassignment.dto.RoomShiftRequestDto;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class RoomAssignmentService {

    private final RoomAssignmentRepository roomAssignmentRepository;
    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final RoomAssignmentMapper roomAssignmentMapper;

    public RoomAssignmentService(RoomAssignmentRepository roomAssignmentRepository,
                                  BookingRepository bookingRepository,
                                  RoomRepository roomRepository,
                                  RoomAssignmentMapper roomAssignmentMapper) {
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.roomAssignmentMapper = roomAssignmentMapper;
    }

    /**
     * Create the initial room assignment when a booking is created with a specific room.
     * Called from BookingService.createBooking() and assignRoomToBooking().
     */
    @Transactional
    public RoomAssignment createInitialAssignment(Booking booking) {
        if (booking.getRoom() == null) {
            return null; // No room assigned yet, skip
        }

        // Check if assignments already exist for this booking
        List<RoomAssignment> existing = roomAssignmentRepository.findByBookingId(booking.getId());
        if (!existing.isEmpty()) {
            return existing.get(0); // Already has assignments
        }

        RoomAssignment assignment = new RoomAssignment(
                booking,
                booking.getRoom(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                RoomAssignmentStatus.SCHEDULED,
                "Initial room assignment"
        );

        return roomAssignmentRepository.save(assignment);
    }

    /**
     * Shift a guest from their current room to a new room.
     * This is the core room-shift operation.
     */
    @Transactional
    public List<RoomAssignmentDto> shiftRoom(UUID propertyId, UUID bookingId, @Valid RoomShiftRequestDto dto) {
        // 1. Fetch and validate booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room shift is only allowed for checked-in bookings");
        }

        // 2. Validate shift date
        LocalDate shiftDate = dto.shiftDate();
        LocalDate today = LocalDate.now();

        if (shiftDate.isBefore(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Shift date cannot be in the past");
        }

        if (!shiftDate.isBefore(booking.getCheckOut())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Shift date must be before the check-out date");
        }

        if (shiftDate.isBefore(booking.getCheckIn()) || shiftDate.isEqual(booking.getCheckIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Shift date must be after the check-in date");
        }

        // 3. Validate new room
        Room newRoom = roomRepository.findById(dto.newRoomId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "New room not found"));

        if (!newRoom.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "New room does not belong to the specified property");
        }

        if (newRoom.getStatus() != RoomStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "New room is not active (status: " + newRoom.getStatus() + ")");
        }

        // Check same room
        if (booking.getRoom() != null && newRoom.getId().equals(booking.getRoom().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "New room is the same as the current room");
        }

        // 4. Check new room availability from shiftDate to checkOut
        boolean hasConflict = roomAssignmentRepository.existsOverlappingAssignment(
                newRoom.getId(),
                shiftDate,
                booking.getCheckOut(),
                List.of(RoomAssignmentStatus.CANCELLED, RoomAssignmentStatus.COMPLETED)
        );

        if (hasConflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "New room " + newRoom.getNumber() + " is not available from " + shiftDate + " to " + booking.getCheckOut());
        }

        // 5. Find the current active assignment and truncate it
        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.SCHEDULED)
        );

        // Find the assignment that covers the shift date
        RoomAssignment currentAssignment = activeAssignments.stream()
                .filter(ra -> !ra.getStartDate().isAfter(shiftDate) && ra.getEndDate().isAfter(shiftDate))
                .findFirst()
                .orElse(null);

        if (currentAssignment == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No active room assignment found for the shift date");
        }

        // Truncate the current assignment's end date to the shift date
        currentAssignment.setEndDate(shiftDate);
        currentAssignment.setStatus(RoomAssignmentStatus.COMPLETED);
        currentAssignment.setNotes(
                (currentAssignment.getNotes() != null ? currentAssignment.getNotes() + " | " : "") +
                "Ended early due to room shift"
        );
        roomAssignmentRepository.save(currentAssignment);

        // Cancel any future scheduled assignments after the shift date
        activeAssignments.stream()
                .filter(ra -> ra.getStartDate().isAfter(shiftDate) || ra.getStartDate().isEqual(shiftDate))
                .filter(ra -> !ra.getId().equals(currentAssignment.getId()))
                .forEach(ra -> {
                    ra.setStatus(RoomAssignmentStatus.CANCELLED);
                    ra.setNotes(
                            (ra.getNotes() != null ? ra.getNotes() + " | " : "") +
                            "Cancelled due to room shift"
                    );
                    roomAssignmentRepository.save(ra);
                });

        // 6. Create new assignment for the new room
        RoomAssignment newAssignment = new RoomAssignment(
                booking,
                newRoom,
                shiftDate,
                booking.getCheckOut(),
                RoomAssignmentStatus.ACTIVE,
                dto.notes() != null ? dto.notes() : "Room shift from " + currentAssignment.getRoom().getNumber() + " to " + newRoom.getNumber()
        );
        roomAssignmentRepository.save(newAssignment);

        // 7. Update booking's current room reference to the new room
        booking.setRoom(newRoom);
        booking.setUnit(newRoom.getUnit());
        bookingRepository.save(booking);

        // 8. Return all assignments for the booking
        List<RoomAssignment> allAssignments = roomAssignmentRepository.findByBookingId(bookingId);
        return roomAssignmentMapper.toDtoList(allAssignments);
    }

    /**
     * Activate assignments when a guest checks in.
     * Marks SCHEDULED assignments that start on or before today as ACTIVE.
     */
    @Transactional
    public void activateAssignments(UUID bookingId) {
        List<RoomAssignment> scheduledAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.SCHEDULED)
        );

        LocalDate today = LocalDate.now();

        for (RoomAssignment assignment : scheduledAssignments) {
            // Activate assignments that should be active now
            if (!assignment.getStartDate().isAfter(today)) {
                assignment.setStatus(RoomAssignmentStatus.ACTIVE);
                roomAssignmentRepository.save(assignment);
            }
        }
    }

    /**
     * Complete all active assignments when a guest checks out.
     */
    @Transactional
    public void completeAssignments(UUID bookingId) {
        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.SCHEDULED)
        );

        for (RoomAssignment assignment : activeAssignments) {
            assignment.setStatus(RoomAssignmentStatus.COMPLETED);
            roomAssignmentRepository.save(assignment);
        }
    }

    /**
     * Get all room assignments for a booking.
     */
    public List<RoomAssignmentDto> getAssignmentsForBooking(UUID propertyId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to the specified property");
        }

        List<RoomAssignment> assignments = roomAssignmentRepository.findByBookingId(bookingId);
        return roomAssignmentMapper.toDtoList(assignments);
    }
}
