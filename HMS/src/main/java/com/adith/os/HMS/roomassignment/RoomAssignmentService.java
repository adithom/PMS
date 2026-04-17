package com.adith.os.HMS.roomassignment;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.FolioService;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RoomAssignmentService {

    private static final Logger log = LoggerFactory.getLogger(RoomAssignmentService.class);

    private final RoomAssignmentRepository roomAssignmentRepository;
    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final RoomAssignmentMapper roomAssignmentMapper;
    private final FolioService folioService;

    public RoomAssignmentService(RoomAssignmentRepository roomAssignmentRepository,
                                  BookingRepository bookingRepository,
                                  RoomRepository roomRepository,
                                  RoomAssignmentMapper roomAssignmentMapper,
                                  FolioService folioService) {
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.roomAssignmentMapper = roomAssignmentMapper;
        this.folioService = folioService;
    }

    /**
     * Create the initial room assignment when a booking is created with a specific room.
     * Called from BookingService.createBooking() and assignRoomToBooking().
     */
    @Transactional
    public RoomAssignment createInitialAssignment(Booking booking, BigDecimal nightlyRate) {
        if (booking.getRoom() == null) {
            return null; // No room assigned yet, skip
        }

        // Check if assignments already exist for this booking
        List<RoomAssignment> existing = roomAssignmentRepository.findByBookingId(booking.getId());
        if (!existing.isEmpty()) {
            return existing.get(0); // Already has assignments
        }

        BigDecimal effectiveRate = (nightlyRate != null && nightlyRate.compareTo(BigDecimal.ZERO) > 0)
                ? nightlyRate
                : booking.getRoom().getBaseRate();

        RoomAssignment assignment = new RoomAssignment(
                booking,
                booking.getRoom(),
                booking.getCheckIn(),
                booking.getCheckOut(),
                RoomAssignmentStatus.SCHEDULED,
                "Initial room assignment",
                effectiveRate
        );

        return roomAssignmentRepository.save(assignment);
    }

    /**
     * Shift a guest from their current room to a new room.
     * This is the core room-shift operation.
     *
     * Also handles folio adjustments by voiding already-posted future ROOM_RENT
     * charges; Night Audit will post replacement charges using the new
     * assignment's effective nightly rate.
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

        if (shiftDate.isBefore(booking.getCheckIn())) {
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

        Room oldRoom = currentAssignment.getRoom();
        BigDecimal effectiveNewRate = dto.newRate() != null ? dto.newRate() : newRoom.getBaseRate();

        // Truncate the current assignment's end date to the shift date
        currentAssignment.setEndDate(shiftDate);
        if (shiftDate.isAfter(today)) {
            currentAssignment.setNotes(
                    (currentAssignment.getNotes() != null ? currentAssignment.getNotes() + " | " : "") +
                    "Ending early due to upcoming room shift"
            );
            // Leave status as is (ACTIVE or SCHEDULED) so NightAudit still charges and it blocks availability
        } else {
            currentAssignment.setStatus(RoomAssignmentStatus.COMPLETED);
            currentAssignment.setNotes(
                    (currentAssignment.getNotes() != null ? currentAssignment.getNotes() + " | " : "") +
                    "Ended early due to room shift"
            );
        }
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
        RoomAssignmentStatus newStatus = shiftDate.isAfter(today) ? RoomAssignmentStatus.SCHEDULED : RoomAssignmentStatus.ACTIVE;
        RoomAssignment newAssignment = new RoomAssignment(
                booking,
                newRoom,
                shiftDate,
                booking.getCheckOut(),
                newStatus,
                dto.notes() != null ? dto.notes() : "Room shift from " + oldRoom.getNumber() + " to " + newRoom.getNumber(),
                effectiveNewRate
        );
        roomAssignmentRepository.save(newAssignment);

        // 7. Handle folio rate adjustments for already-posted future charges
        adjustFolioForRoomShift(booking, oldRoom, newRoom, shiftDate, effectiveNewRate);

        // 8. Update booking's current room reference (cache) only for same-day moves.
        // Future-dated moves are activated by the nightly inventory rollover.
        if (!shiftDate.isAfter(today)) {
            booking.setRoom(newRoom);
            booking.setUnit(newRoom.getUnit());
        }
        recalculateBookingRoomTotal(booking);
        bookingRepository.save(booking);

        // 9. Return all assignments for the booking
        List<RoomAssignment> allAssignments = roomAssignmentRepository.findByBookingId(bookingId);
        return roomAssignmentMapper.toDtoList(allAssignments);
    }

    /**
     * Adjust folio charges when shifting to a room with a different rate.
     *
     * Voids future ROOM_RENT charges (from shiftDate onward).
     * Replacement charges will be posted by Night Audit using the destination
     * assignment's effective nightly rate.
     */
    private void adjustFolioForRoomShift(Booking booking,
                                         Room oldRoom,
                                         Room newRoom,
                                         LocalDate shiftDate,
                                         BigDecimal newRate) {
        Folio masterFolio = booking.getMasterFolio();
        if (masterFolio == null) {
            log.warn("No master folio for booking {} — skipping rate adjustment", booking.getId());
            return;
        }

        BigDecimal oldRate = oldRoom.getBaseRate();

        // Void future ROOM_RENT charges (charges dated on or after shiftDate)
        if (masterFolio.getCharges() != null) {
            List<FolioCharge> futureRoomCharges = masterFolio.getCharges().stream()
                    .filter(c -> !c.isVoided())
                    .filter(c -> c.getChargeCode() == ChargeCode.ROOM_RENT)
                    .filter(c -> !c.getChargeDate().isBefore(shiftDate))
                    .collect(Collectors.toList());

            for (FolioCharge charge : futureRoomCharges) {
                folioService.voidCharge(
                        booking.getProperty().getId(),
                        masterFolio.getId(),
                        charge.getId(),
                        "Room shift: replacing old rate (" + oldRate + "/night) with " + newRate + "/night",
                        "SYSTEM"
                );
            }
        }

        log.info("Room shift folio adjustment: booking {}, {} → {}, old rate {}, new rate {}",
                booking.getId(), oldRoom.getNumber(), newRoom.getNumber(), oldRate, newRate);
    }

    private void recalculateBookingRoomTotal(Booking booking) {
        List<RoomAssignment> assignments = roomAssignmentRepository.findByBookingId(booking.getId());

        BigDecimal expectedRoomTotal = assignments.stream()
                .filter(assignment -> assignment.getStatus() != RoomAssignmentStatus.CANCELLED)
                .map(assignment -> {
                    BigDecimal nightlyRate = assignment.getNightlyRate() != null
                            ? assignment.getNightlyRate()
                            : assignment.getRoom().getBaseRate();
                    long nights = ChronoUnit.DAYS.between(assignment.getStartDate(), assignment.getEndDate());
                    return nightlyRate.multiply(BigDecimal.valueOf(Math.max(nights, 0L)));
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        booking.setTotalPrice(expectedRoomTotal);
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
            if (!assignment.getStartDate().isAfter(today)) {
                assignment.setStatus(RoomAssignmentStatus.ACTIVE);
                roomAssignmentRepository.save(assignment);
            }
        }
    }

    /**
     * Force-activate all SCHEDULED assignments for a booking regardless of start date.
     * Used during manual check-in where the staff is physically checking in the guest.
     */
    @Transactional
    public void forceActivateAssignments(UUID bookingId) {
        List<RoomAssignment> scheduledAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.SCHEDULED)
        );

        for (RoomAssignment assignment : scheduledAssignments) {
            assignment.setStatus(RoomAssignmentStatus.ACTIVE);
            roomAssignmentRepository.save(assignment);
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
     * Extend the active/scheduled assignment's endDate when a booking is extended.
     * Finds the last (by startDate) active/scheduled assignment and extends it.
     */
    @Transactional
    public void extendActiveAssignment(UUID bookingId, LocalDate newEndDate) {
        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.SCHEDULED)
        );

        if (activeAssignments.isEmpty()) {
            log.warn("No active/scheduled assignment found for booking {} to extend", bookingId);
            return;
        }

        // Extend the LAST assignment (the one with the latest startDate)
        RoomAssignment lastAssignment = activeAssignments.get(activeAssignments.size() - 1);
        lastAssignment.setEndDate(newEndDate);
        roomAssignmentRepository.save(lastAssignment);

        log.info("Extended assignment {} endDate to {} for booking {}",
                lastAssignment.getId(), newEndDate, bookingId);
    }

    /**
     * Truncate active assignments and mark them completed for early checkout.
     * Sets the endDate of the active assignment to the early checkout date,
     * and cancels any future scheduled assignments.
     */
    @Transactional
    public void truncateAndCompleteAssignments(UUID bookingId, LocalDate earlyCheckoutDate) {
        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findActiveAssignmentsByBookingId(
                bookingId,
                List.of(RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.SCHEDULED)
        );

        for (RoomAssignment assignment : activeAssignments) {
            if (assignment.getStartDate().isBefore(earlyCheckoutDate)) {
                // Assignment started before the checkout — truncate its endDate
                assignment.setEndDate(earlyCheckoutDate);
                assignment.setStatus(RoomAssignmentStatus.COMPLETED);
                assignment.setNotes(
                        (assignment.getNotes() != null ? assignment.getNotes() + " | " : "") +
                        "Truncated due to early checkout"
                );
            } else {
                // Future assignment that never started — cancel it
                assignment.setStatus(RoomAssignmentStatus.CANCELLED);
                assignment.setNotes(
                        (assignment.getNotes() != null ? assignment.getNotes() + " | " : "") +
                        "Cancelled due to early checkout"
                );
            }
            roomAssignmentRepository.save(assignment);
        }

        log.info("Truncated/completed {} assignments for booking {} (early checkout: {})",
                activeAssignments.size(), bookingId, earlyCheckoutDate);
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

    /**
     * Sync assignment dates when booking dates are updated manually (via updateBooking).
     * Blocks the update if there are multiple assignments due to room shifts.
     */
    @Transactional
    public void syncDatesForBookingUpdate(UUID bookingId, LocalDate newCheckIn, LocalDate newCheckOut) {
        List<RoomAssignment> allAssignments = roomAssignmentRepository.findByBookingId(bookingId);

        if (allAssignments.isEmpty()) {
            return;
        }

        if (allAssignments.size() > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot arbitrarily update dates because this booking has multiple room assignments (e.g., from a room shift). Please use the extend or early checkout features instead.");
        }

        RoomAssignment assignment = allAssignments.get(0);
        assignment.setStartDate(newCheckIn);
        assignment.setEndDate(newCheckOut);
        roomAssignmentRepository.save(assignment);
        
        log.info("Synced assignment {} dates to {} - {} for booking {}",
                assignment.getId(), newCheckIn, newCheckOut, bookingId);
    }

    /**
     * Cancel all non-completed assignments when a booking is cancelled.
     */
    @Transactional
    public void cancelAssignmentsForBooking(UUID bookingId) {
        List<RoomAssignment> assignments = roomAssignmentRepository.findByBookingId(bookingId);
        for (RoomAssignment assignment : assignments) {
            if (assignment.getStatus() != RoomAssignmentStatus.COMPLETED) {
                assignment.setStatus(RoomAssignmentStatus.CANCELLED);
                assignment.setNotes(
                        (assignment.getNotes() != null ? assignment.getNotes() + " | " : "") +
                                "Cancelled alongside booking"
                );
                roomAssignmentRepository.save(assignment);
            }
        }
        log.info("Cancelled assignments for booking {} due to booking cancellation", bookingId);
    }
}
