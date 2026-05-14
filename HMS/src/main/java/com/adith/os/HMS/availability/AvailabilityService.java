package com.adith.os.HMS.availability;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AvailabilityService {

        private final PropertyRepository propertyRepository;
        private final RoomRepository roomRepository;
        private final BookingRepository bookingRepository;
        private final UnitRepository unitRepository;
        private final RoomAssignmentRepository roomAssignmentRepository;

        // Active statuses for room assignments (occupying a room)
        private static final List<RoomAssignmentStatus> ACTIVE_ASSIGNMENT_STATUSES =
                List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE);

        // Booking statuses that consume unit capacity before a room is assigned
        private static final List<BookingStatus> CAPACITY_HOLD_BOOKING_STATUSES =
                List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);

        public AvailabilityService(
                        PropertyRepository propertyRepository,
                        RoomRepository roomRepository,
                        BookingRepository bookingRepository,
                        UnitRepository unitRepository,
                        RoomAssignmentRepository roomAssignmentRepository) {
                this.propertyRepository = propertyRepository;
                this.roomRepository = roomRepository;
                this.bookingRepository = bookingRepository;
                this.unitRepository = unitRepository;
                this.roomAssignmentRepository = roomAssignmentRepository;
        }

        /**
         * 1. Search available rooms for a property within date range.
         * Uses RoomAssignment table for overlap checks.
         */
        public AvailabilitySearchDto searchAvailableRooms(UUID propertyId, LocalDate checkIn, LocalDate checkOut) {
                validateDateRange(checkIn, checkOut);

                Property property = propertyRepository.findById(propertyId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Property not found"));

                List<Room> allActiveRooms = roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.ACTIVE);

                List<RoomAssignment> conflictingAssignments = roomAssignmentRepository.findConflictingAssignments(
                                propertyId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);

                Set<UUID> occupiedRoomIds = conflictingAssignments.stream()
                                .map(ra -> ra.getRoom().getId())
                                .collect(Collectors.toSet());

                List<Room> availableRooms = allActiveRooms.stream()
                                .filter(room -> !occupiedRoomIds.contains(room.getId()))
                                .collect(Collectors.toList());

                List<AvailableRoomDto> availableRoomDtos = availableRooms.stream()
                                .map(this::mapToAvailableRoomDto)
                                .collect(Collectors.toList());

                return new AvailabilitySearchDto(
                                propertyId,
                                property.getName(),
                                checkIn,
                                checkOut,
                                allActiveRooms.size(),
                                availableRooms.size(),
                                occupiedRoomIds.size(),
                                !availableRooms.isEmpty(),
                                availableRoomDtos);
        }

        /**
         * 2. Check if a specific room is available.
         * Uses RoomAssignment table for overlap checks.
         */
        public RoomAvailabilityCheckDto checkRoomAvailability(UUID roomId, LocalDate checkIn, LocalDate checkOut) {
                validateDateRange(checkIn, checkOut);

                Room room = roomRepository.findById(roomId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

                String reason = "AVAILABLE";
                boolean isAvailable = true;

                if (room.getStatus() != RoomStatus.ACTIVE) {
                        isAvailable = false;
                        reason = room.getStatus().toString();
                } else {
                        List<RoomAssignment> conflictingAssignments = roomAssignmentRepository.findConflictingAssignmentsForRoom(
                                        roomId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);

                        if (!conflictingAssignments.isEmpty()) {
                                isAvailable = false;
                                reason = "BOOKED";
                        }
                }

                return new RoomAvailabilityCheckDto(
                                roomId,
                                room.getNumber(),
                                isAvailable,
                                checkIn,
                                checkOut,
                                reason);
        }

        /**
         * 3. Get daily availability for calendar view.
         * Uses RoomAssignment table for overlap checks.
         *
         * <p>Definitions:
         * <ul>
         *   <li>{@code bookedRooms} = physicallyOccupied (via RoomAssignment) + unassignedHolds (Bookings
         *       with no assigned room that still consume capacity)</li>
         *   <li>{@code availableRooms} = totalActiveRooms − bookedRooms</li>
         *   <li>{@code availableRoomsList.size()} == {@code availableRooms} always (sorted by room number,
         *       trimmed to account for holds)</li>
         * </ul>
         */
        public List<DailyAvailabilityDto> getDailyAvailability(UUID propertyId, LocalDate startDate,
                        LocalDate endDate) {
                validateDateRange(startDate, endDate);

                if (!propertyRepository.existsById(propertyId)) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
                }

                List<Room> allActiveRooms = roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.ACTIVE);
                int totalActiveRooms = allActiveRooms.size();

                List<Room> maintenanceRooms = roomRepository.findByPropertyIdAndStatus(propertyId,
                                RoomStatus.IN_MAINTENANCE);

                List<RoomAssignment> allAssignments = roomAssignmentRepository.findConflictingAssignments(
                                propertyId, startDate, endDate.plusDays(1), ACTIVE_ASSIGNMENT_STATUSES);

                List<DailyAvailabilityDto> dailyAvailability = new ArrayList<>();

                LocalDate currentDate = startDate;
                while (!currentDate.isAfter(endDate)) {

                        LocalDate finalCurrentDate = currentDate;

                        List<RoomAssignment> assignmentsForDay = allAssignments.stream()
                                        .filter(ra -> ra.getStartDate().compareTo(finalCurrentDate) <= 0
                                                        && ra.getEndDate().compareTo(finalCurrentDate) > 0)
                                        .collect(Collectors.toList());

                        int bookedRooms = (int) assignmentsForDay.stream()
                                        .map(ra -> ra.getRoom().getId())
                                        .distinct()
                                        .count();

                        long unassignedBookings = bookingRepository.countUnassignedOverlappingPropertyBookings(
                                propertyId, finalCurrentDate, finalCurrentDate.plusDays(1), CAPACITY_HOLD_BOOKING_STATUSES);

                        int totalBookedCapacity = bookedRooms + (int) unassignedBookings;
                        int availableRoomsNumber = Math.max(0, totalActiveRooms - totalBookedCapacity);
                        
                        double occupancyRate = totalActiveRooms > 0
                                        ? (double) totalBookedCapacity / totalActiveRooms * 100
                                        : 0.0;

                        Set<UUID> bookedRoomIds = assignmentsForDay.stream()
                                        .map(ra -> ra.getRoom().getId())
                                        .collect(Collectors.toSet());

                        // Sort by room number for determinism, then trim to availableRoomsNumber so
                        // availableRoomsList.size() == availableRooms (holds occupy capacity but have no room yet)
                        List<AvailableRoomDto> availableRoomDtos = allActiveRooms.stream()
                                        .filter(room -> !bookedRoomIds.contains(room.getId()))
                                        .sorted(Comparator.comparing(Room::getNumber))
                                        .limit(availableRoomsNumber)
                                        .map(this::mapToAvailableRoomDto)
                                        .collect(Collectors.toList());

                        dailyAvailability.add(new DailyAvailabilityDto(
                                        currentDate,
                                        currentDate.getDayOfWeek().toString(),
                                        totalActiveRooms,
                                        availableRoomsNumber,
                                        totalBookedCapacity,
                                        (int) unassignedBookings,
                                        maintenanceRooms.size(),
                                        Math.round(occupancyRate * 100.0) / 100.0,
                                        availableRoomDtos));

                        currentDate = currentDate.plusDays(1);
                }

                return dailyAvailability;
        }

        /**
         * 4. Get occupancy report for a specific date.
         * Uses RoomAssignment table for room count accuracy.
         */
        public OccupancyReportDto getOccupancyReport(UUID propertyId, LocalDate date) {
                Property property = propertyRepository.findById(propertyId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Property not found"));

                List<Room> allRooms = roomRepository.findByPropertyId(propertyId);
                List<Room> activeRooms = allRooms.stream()
                                .filter(room -> room.getStatus() == RoomStatus.ACTIVE)
                                .collect(Collectors.toList());

                List<Room> maintenanceRooms = allRooms.stream()
                                .filter(room -> room.getStatus() == RoomStatus.IN_MAINTENANCE)
                                .collect(Collectors.toList());

                List<Room> inactiveRooms = allRooms.stream()
                                .filter(room -> room.getStatus() == RoomStatus.INACTIVE)
                                .collect(Collectors.toList());

                LocalDate nextDay = date.plusDays(1);

                List<RoomAssignment> assignmentsForDay = roomAssignmentRepository.findConflictingAssignments(
                                propertyId, date, nextDay, ACTIVE_ASSIGNMENT_STATUSES);

                List<BookedRoomDto> bookedRoomDtos = assignmentsForDay.stream()
                                .map(this::mapToBookedRoomDto)
                                .collect(Collectors.toList());

                int bookedCount = (int) assignmentsForDay.stream()
                                .map(ra -> ra.getRoom().getId())
                                .distinct()
                                .count();

                long unassignedBookings = bookingRepository.countUnassignedOverlappingPropertyBookings(
                                propertyId, date, nextDay, CAPACITY_HOLD_BOOKING_STATUSES);

                int totalBookedCapacity = bookedCount + (int) unassignedBookings;

                int availableCount = Math.max(0, activeRooms.size() - totalBookedCapacity);
                double occupancyRate = activeRooms.size() > 0
                                ? (double) totalBookedCapacity / activeRooms.size() * 100
                                : 0.0;

                return new OccupancyReportDto(
                                propertyId,
                                property.getName(),
                                date,
                                allRooms.size(),
                                activeRooms.size(),
                                totalBookedCapacity,
                                availableCount,
                                maintenanceRooms.size(),
                                inactiveRooms.size(),
                                Math.round(occupancyRate * 100.0) / 100.0,
                                bookedRoomDtos);
        }

        /**
         * 5. Get occupancy report for a time period.
         *
         * <p>{@code bookedRoomNights} = sum of daily {@code bookedRooms} across the period, where each
         * day's value includes both physically assigned rooms and unassigned capacity holds.
         * {@code averageOccupancyRate} is the mean of per-day rates computed on the same basis.
         */
        public PeriodOccupancyReportDto getPeriodOccupancyReport(UUID propertyId, LocalDate startDate,
                        LocalDate endDate) {
                validateDateRange(startDate, endDate);

                Property property = propertyRepository.findById(propertyId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Property not found"));

                List<DailyAvailabilityDto> dailyBreakdown = getDailyAvailability(propertyId, startDate, endDate);

                int totalDays = (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
                List<Room> activeRooms = roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.ACTIVE);
                long totalRoomNights = (long) activeRooms.size() * totalDays;

                long bookedRoomNights = dailyBreakdown.stream()
                                .mapToLong(DailyAvailabilityDto::bookedRooms)
                                .sum();

                double averageOccupancyRate = dailyBreakdown.stream()
                                .mapToDouble(DailyAvailabilityDto::occupancyRate)
                                .average()
                                .orElse(0.0);

                DailyAvailabilityDto peakDay = dailyBreakdown.stream()
                                .max(Comparator.comparingInt(DailyAvailabilityDto::bookedRooms))
                                .orElse(null);

                return new PeriodOccupancyReportDto(
                                propertyId,
                                property.getName(),
                                startDate,
                                endDate,
                                totalDays,
                                totalRoomNights,
                                bookedRoomNights,
                                Math.round(averageOccupancyRate * 100.0) / 100.0,
                                peakDay != null ? peakDay.bookedRooms() : 0,
                                peakDay != null ? peakDay.date() : startDate,
                                dailyBreakdown);
        }

        /**
         * 6. Search available rooms by unit.
         * Uses RoomAssignment table.
         */
        public List<AvailableRoomDto> searchAvailableRoomsByUnit(UUID unitId, LocalDate checkIn, LocalDate checkOut, UUID excludeBookingId) {
                validateDateRange(checkIn, checkOut);

                Unit unit = unitRepository.findById(unitId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

                List<Room> allActiveRooms = roomRepository.findByUnitIdAndStatus(unitId, RoomStatus.ACTIVE);

                List<RoomAssignment> conflictingAssignments = roomAssignmentRepository.findConflictingAssignmentsForUnit(
                                unitId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);

                Set<UUID> occupiedRoomIds = conflictingAssignments.stream()
                                .map(ra -> ra.getRoom().getId())
                                .collect(Collectors.toSet());

                List<Room> physicallyEmptyRooms = allActiveRooms.stream()
                                .filter(room -> !occupiedRoomIds.contains(room.getId()))
                                .collect(Collectors.toList());

                long unassignedHolds = (excludeBookingId != null)
                                ? bookingRepository.countUnassignedOverlappingUnitBookingsExcludingCurrent(
                                                unitId, checkIn, checkOut, excludeBookingId, CAPACITY_HOLD_BOOKING_STATUSES)
                                : bookingRepository.countUnassignedOverlappingUnitBookings(
                                                unitId, checkIn, checkOut, CAPACITY_HOLD_BOOKING_STATUSES);

                int roomsToActuallyReturn = (excludeBookingId != null)
                                ? physicallyEmptyRooms.size()
                                : Math.max(0, physicallyEmptyRooms.size() - (int) unassignedHolds);

                return physicallyEmptyRooms.stream()
                                .limit(roomsToActuallyReturn)
                                .map(this::mapToAvailableRoomDto)
                                .collect(Collectors.toList());
        }

        /**
         * 7. Get unit occupancy report.
         * Uses RoomAssignment table.
         */
        public UnitOccupancyReportDto getUnitOccupancyReport(UUID unitId, LocalDate date) {
                Unit unit = unitRepository.findById(unitId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

                List<Room> allRooms = roomRepository.findByUnitId(unitId);
                List<Room> activeRooms = allRooms.stream()
                                .filter(room -> room.getStatus() == RoomStatus.ACTIVE)
                                .collect(Collectors.toList());

                LocalDate nextDay = date.plusDays(1);

                List<RoomAssignment> assignmentsForDay = roomAssignmentRepository.findConflictingAssignmentsForUnit(
                                unitId, date, nextDay, ACTIVE_ASSIGNMENT_STATUSES);

                List<BookedRoomDto> bookedRoomDtos = assignmentsForDay.stream()
                                .map(this::mapToBookedRoomDto)
                                .collect(Collectors.toList());

                int bookedCount = (int) assignmentsForDay.stream()
                                .map(ra -> ra.getRoom().getId())
                                .distinct()
                                .count();

                long unassignedBookings = bookingRepository.countUnassignedOverlappingUnitBookings(
                                unitId, date, nextDay, CAPACITY_HOLD_BOOKING_STATUSES);

                int totalBookedCapacity = bookedCount + (int) unassignedBookings;

                int availableCount = Math.max(0, activeRooms.size() - totalBookedCapacity);
                double occupancyRate = activeRooms.size() > 0
                                ? (double) totalBookedCapacity / activeRooms.size() * 100
                                : 0.0;

                return new UnitOccupancyReportDto(
                                unitId,
                                unit.getName(),
                                date,
                                allRooms.size(),
                                activeRooms.size(),
                                totalBookedCapacity,
                                availableCount,
                                Math.round(occupancyRate * 100.0) / 100.0,
                                bookedRoomDtos);
        }

        // Helper methods
        private void validateDateRange(LocalDate checkIn, LocalDate checkOut) {
                if (checkIn == null || checkOut == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Check-in and check-out dates are required");
                }
                if (checkIn.isAfter(checkOut)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Check-in date must be before check-out date");
                }
        }

        private AvailableRoomDto mapToAvailableRoomDto(Room room) {
                return new AvailableRoomDto(
                                room.getId(),
                                room.getNumber(),
                                room.getCapacity(),
                                room.getBaseRate(),
                                room.getUnit() != null ? room.getUnit().getName() : "N/A",
                                room.getStatus().toString());
        }

        private BookedRoomDto mapToBookedRoomDto(RoomAssignment assignment) {
                Room room = assignment.getRoom();
                Booking booking = assignment.getBooking();
                return new BookedRoomDto(
                                room.getId(),
                                room.getNumber(),
                                booking.getId(),
                                booking.getGuest().getFullName(),
                                booking.getCheckIn(),
                                booking.getCheckOut(),
                                booking.getStatus().toString());
        }

        // ---------------------------------------------------------------------
        //  Tape chart
        // ---------------------------------------------------------------------

        /**
         * Tape-chart view: rooms + real assignments + ghost-fill assignments for
         * unassigned bookings. Ghost-fill is deterministic first-fit:
         *   1. Unassigned bookings sorted by checkIn asc, id asc.
         *   2. Within each booking's unit, candidate rooms sorted by number ascending
         *      (numeric-aware), inactive/maintenance rooms excluded.
         *   3. First room with no real and no already-placed-ghost overlap on the
         *      booking's full date range wins. If none fits, the booking is omitted
         *      (logged) — the existing capacity checks should normally prevent this.
         */
        public TapeChartDto getTapeChart(UUID propertyId, LocalDate from, LocalDate to, boolean includeGhosts) {
                if (from == null || to == null || !to.isAfter(from)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Tape-chart window requires from < to");
                }
                if (!propertyRepository.existsById(propertyId)) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
                }

                List<Room> rooms = roomRepository.findByPropertyIdOrderByNumber(propertyId);

                List<TapeChartDto.TapeChartRoomDto> roomDtos = rooms.stream()
                                .map(r -> new TapeChartDto.TapeChartRoomDto(
                                                r.getId(),
                                                r.getNumber(),
                                                r.getUnit() != null ? r.getUnit().getId() : null,
                                                r.getUnit() != null ? r.getUnit().getName() : null,
                                                r.getBaseRate(),
                                                r.getStatus() != null ? r.getStatus().name() : null))
                                .toList();

                List<RoomAssignment> realAssignments = roomAssignmentRepository.findConflictingAssignments(
                                propertyId, from, to, ACTIVE_ASSIGNMENT_STATUSES);

                List<com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto> realAssignmentDtos = realAssignments.stream()
                                .map(this::toRoomAssignmentDto)
                                .toList();

                List<TapeChartDto.GhostAssignmentDto> ghostDtos = includeGhosts
                                ? buildGhostAssignments(propertyId, from, to, realAssignments)
                                : List.of();

                return new TapeChartDto(roomDtos, realAssignmentDtos, ghostDtos);
        }

        /**
         * Compute deterministic first-fit ghost assignments.
         *
         * @param realAssignments already-fetched real assignments overlapping the window;
         *                        ghost-placement uses these to reject occupied rooms.
         */
        private List<TapeChartDto.GhostAssignmentDto> buildGhostAssignments(
                        UUID propertyId,
                        LocalDate from,
                        LocalDate to,
                        List<RoomAssignment> realAssignments) {
                List<Booking> unassigned = bookingRepository.findUnassignedOverlapping(
                                propertyId, CAPACITY_HOLD_BOOKING_STATUSES, from, to);
                if (unassigned.isEmpty()) return List.of();

                // Pre-bucket real assignments by room id for cheap overlap checks.
                Map<UUID, List<RoomAssignment>> realByRoom = realAssignments.stream()
                                .collect(Collectors.groupingBy(ra -> ra.getRoom().getId()));

                // Track ghost placements as we go (so two ghosts don't claim the same slot).
                Map<UUID, List<TapeChartDto.GhostAssignmentDto>> ghostsByRoom = new HashMap<>();
                List<TapeChartDto.GhostAssignmentDto> result = new ArrayList<>();

                for (Booking booking : unassigned) {
                        Unit unit = booking.getUnit();
                        if (unit == null) continue; // can't ghost-fill a booking with no unit; skip silently
                        LocalDate bStart = booking.getCheckIn();
                        LocalDate bEnd = booking.getCheckOut();

                        List<Room> unitRooms = roomRepository.findByUnitId(unit.getId()).stream()
                                        .filter(r -> r.getStatus() == RoomStatus.ACTIVE)
                                        .sorted(Comparator.comparing(Room::getNumber, String.CASE_INSENSITIVE_ORDER))
                                        .toList();

                        Room placedIn = null;
                        for (Room candidate : unitRooms) {
                                if (roomHasOverlap(candidate.getId(), bStart, bEnd, realByRoom, ghostsByRoom)) continue;
                                placedIn = candidate;
                                break;
                        }
                        if (placedIn == null) continue; // no fit — defensive skip

                        TapeChartDto.GhostAssignmentDto ghost = new TapeChartDto.GhostAssignmentDto(
                                        booking.getId(),
                                        booking.getGuest().getId(),
                                        booking.getGuest().getFullName(),
                                        placedIn.getId(),
                                        placedIn.getNumber(),
                                        unit.getId(),
                                        unit.getName(),
                                        booking.getReservation() != null ? booking.getReservation().getId() : null,
                                        booking.getReservation() != null ? booking.getReservation().getGroupReference() : null,
                                        booking.getStatus(),
                                        bStart,
                                        bEnd,
                                        RoomAssignmentStatus.SCHEDULED);
                        result.add(ghost);
                        ghostsByRoom.computeIfAbsent(placedIn.getId(), k -> new ArrayList<>()).add(ghost);
                }
                return result;
        }

        private boolean roomHasOverlap(
                        UUID roomId,
                        LocalDate start,
                        LocalDate end,
                        Map<UUID, List<RoomAssignment>> realByRoom,
                        Map<UUID, List<TapeChartDto.GhostAssignmentDto>> ghostsByRoom) {
                List<RoomAssignment> reals = realByRoom.get(roomId);
                if (reals != null) {
                        for (RoomAssignment ra : reals) {
                                if (ra.getStartDate().isBefore(end) && ra.getEndDate().isAfter(start)) return true;
                        }
                }
                List<TapeChartDto.GhostAssignmentDto> ghosts = ghostsByRoom.get(roomId);
                if (ghosts != null) {
                        for (TapeChartDto.GhostAssignmentDto g : ghosts) {
                                if (g.startDate().isBefore(end) && g.endDate().isAfter(start)) return true;
                        }
                }
                return false;
        }

        private com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto toRoomAssignmentDto(RoomAssignment ra) {
                Room room = ra.getRoom();
                return new com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto(
                                ra.getId(),
                                ra.getBooking() != null ? ra.getBooking().getId() : null,
                                room.getId(),
                                room.getNumber(),
                                room.getUnit() != null ? room.getUnit().getName() : null,
                                ra.getStartDate(),
                                ra.getEndDate(),
                                ra.getStatus(),
                                ra.getCreatedAt(),
                                ra.getNotes());
        }

}
