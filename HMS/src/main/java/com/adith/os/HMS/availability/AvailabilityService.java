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

                        int availableRoomsNumber = totalActiveRooms - bookedRooms;
                        double occupancyRate = totalActiveRooms > 0
                                        ? (double) bookedRooms / totalActiveRooms * 100
                                        : 0.0;

                        Set<UUID> bookedRoomIds = assignmentsForDay.stream()
                                        .map(ra -> ra.getRoom().getId())
                                        .collect(Collectors.toSet());

                        List<Room> availableRooms = allActiveRooms.stream()
                                        .filter(room -> !bookedRoomIds.contains(room.getId()))
                                        .collect(Collectors.toList());

                        List<AvailableRoomDto> availableRoomDtos = availableRooms.stream()
                                        .map(this::mapToAvailableRoomDto)
                                        .collect(Collectors.toList());

                        dailyAvailability.add(new DailyAvailabilityDto(
                                        currentDate,
                                        currentDate.getDayOfWeek().toString(),
                                        totalActiveRooms,
                                        availableRoomsNumber,
                                        bookedRooms,
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

                // Still need booking info for the booked room DTOs
                List<Booking> bookingsForDay = bookingRepository.findConflictingBookings(
                                propertyId, date, nextDay, List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN));

                List<BookedRoomDto> bookedRoomDtos = bookingsForDay.stream()
                                .map(this::mapToBookedRoomDto)
                                .collect(Collectors.toList());

                int bookedCount = (int) assignmentsForDay.stream()
                                .map(ra -> ra.getRoom().getId())
                                .distinct()
                                .count();

                int availableCount = activeRooms.size() - bookedCount;
                double occupancyRate = activeRooms.size() > 0
                                ? (double) bookedCount / activeRooms.size() * 100
                                : 0.0;

                return new OccupancyReportDto(
                                propertyId,
                                property.getName(),
                                date,
                                allRooms.size(),
                                activeRooms.size(),
                                bookedCount,
                                availableCount,
                                maintenanceRooms.size(),
                                inactiveRooms.size(),
                                Math.round(occupancyRate * 100.0) / 100.0,
                                bookedRoomDtos);
        }

        /**
         * 5. Get occupancy report for a time period
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
        public List<AvailableRoomDto> searchAvailableRoomsByUnit(UUID unitId, LocalDate checkIn, LocalDate checkOut) {
                validateDateRange(checkIn, checkOut);

                Unit unit = unitRepository.findById(unitId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

                List<Room> allActiveRooms = roomRepository.findByUnitIdAndStatus(unitId, RoomStatus.ACTIVE);

                List<RoomAssignment> conflictingAssignments = roomAssignmentRepository.findConflictingAssignmentsForUnit(
                                unitId, checkIn, checkOut, ACTIVE_ASSIGNMENT_STATUSES);

                Set<UUID> occupiedRoomIds = conflictingAssignments.stream()
                                .map(ra -> ra.getRoom().getId())
                                .collect(Collectors.toSet());

                return allActiveRooms.stream()
                                .filter(room -> !occupiedRoomIds.contains(room.getId()))
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

                List<Booking> bookingsForDay = bookingRepository.findConflictingBookingsForUnit(
                                unitId, date, nextDay, List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN));

                List<BookedRoomDto> bookedRoomDtos = bookingsForDay.stream()
                                .map(this::mapToBookedRoomDto)
                                .collect(Collectors.toList());

                int bookedCount = (int) assignmentsForDay.stream()
                                .map(ra -> ra.getRoom().getId())
                                .distinct()
                                .count();

                int availableCount = activeRooms.size() - bookedCount;
                double occupancyRate = activeRooms.size() > 0
                                ? (double) bookedCount / activeRooms.size() * 100
                                : 0.0;

                return new UnitOccupancyReportDto(
                                unitId,
                                unit.getName(),
                                date,
                                allRooms.size(),
                                activeRooms.size(),
                                bookedCount,
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

        private BookedRoomDto mapToBookedRoomDto(Booking booking) {
                Room room = booking.getRoom();
                return new BookedRoomDto(
                                room.getId(),
                                room.getNumber(),
                                booking.getId(),
                                booking.getGuest().getFullName(),
                                booking.getCheckIn(),
                                booking.getCheckOut(),
                                booking.getStatus().toString());
        }

        private List<UnitAvailabilityDto> createUnitBreakdown(List<Room> allRooms, Set<UUID> bookedRoomIds) {
                Map<Unit, List<Room>> roomsByUnit = allRooms.stream()
                                .filter(room -> room.getUnit() != null)
                                .collect(Collectors.groupingBy(Room::getUnit));

                return roomsByUnit.entrySet().stream()
                                .map(entry -> {
                                        Unit unit = entry.getKey();
                                        List<Room> rooms = entry.getValue();

                                        int totalRooms = rooms.size();
                                        int bookedRooms = (int) rooms.stream()
                                                        .filter(room -> bookedRoomIds.contains(room.getId()))
                                                        .count();
                                        int availableRooms = totalRooms - bookedRooms;

                                        double occupancyRate = totalRooms > 0
                                                        ? (double) bookedRooms / totalRooms * 100
                                                        : 0.0;

                                        List<AvailableRoomDto> availableRoomsList = rooms.stream()
                                                        .filter(room -> !bookedRoomIds.contains(room.getId()))
                                                        .map(this::mapToAvailableRoomDto)
                                                        .collect(Collectors.toList());

                                        return new UnitAvailabilityDto(
                                                        unit.getId(),
                                                        unit.getName(),
                                                        totalRooms,
                                                        availableRooms,
                                                        bookedRooms,
                                                        Math.round(occupancyRate * 100.0) / 100.0,
                                                        availableRoomsList);
                                })
                                .collect(Collectors.toList());
        }
}
