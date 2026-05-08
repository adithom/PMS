package com.adith.os.HMS.availability;

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
import com.adith.os.HMS.unit.UnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AvailabilityServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private RoomRepository roomRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private UnitRepository unitRepository;
    @Mock private RoomAssignmentRepository roomAssignmentRepository;

    @InjectMocks
    private AvailabilityService availabilityService;

    private UUID propertyId;
    private Property property;
    private List<Room> activeRooms;
    private static final List<RoomAssignmentStatus> ACTIVE_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE);
    private static final List<BookingStatus> HOLD_STATUSES =
            List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);

    @BeforeEach
    void setUp() {
        propertyId = UUID.randomUUID();
        property = new Property();

        activeRooms = List.of(
                makeRoom("101"), makeRoom("102"), makeRoom("103"), makeRoom("104"), makeRoom("105")
        );
    }

    // --- getDailyAvailability invariants ---

    @Test
    void dailyAvailability_noBookings_allRoomsAvailable() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 1);
        stubDailyCommon(start, end, List.of(), 0L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);

        assertThat(result).hasSize(1);
        DailyAvailabilityDto day = result.get(0);
        assertListSizeMatchesCount(day);
        assertThat(day.availableRooms()).isEqualTo(5);
        assertThat(day.bookedRooms()).isEqualTo(0);
        assertThat(day.unassignedHolds()).isEqualTo(0);
    }

    @Test
    void dailyAvailability_withPhysicalAssignments_listSizeEqualsCount() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 1);

        // 2 rooms physically assigned
        Room r101 = activeRooms.get(0);
        Room r102 = activeRooms.get(1);
        RoomAssignment a1 = makeAssignment(r101, start, start.plusDays(3));
        RoomAssignment a2 = makeAssignment(r102, start, start.plusDays(2));

        stubDailyCommon(start, end, List.of(a1, a2), 0L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);
        DailyAvailabilityDto day = result.get(0);

        assertListSizeMatchesCount(day);
        assertThat(day.bookedRooms()).isEqualTo(2);
        assertThat(day.unassignedHolds()).isEqualTo(0);
        assertThat(day.availableRooms()).isEqualTo(3);
    }

    @Test
    void dailyAvailability_withHolds_listSizeStillEqualsCount() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 1);

        // 1 room physically assigned + 2 unassigned holds
        Room r101 = activeRooms.get(0);
        RoomAssignment a1 = makeAssignment(r101, start, start.plusDays(2));

        stubDailyCommon(start, end, List.of(a1), 2L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);
        DailyAvailabilityDto day = result.get(0);

        // bookedRooms = 1 physical + 2 holds = 3
        assertThat(day.bookedRooms()).isEqualTo(3);
        assertThat(day.unassignedHolds()).isEqualTo(2);
        assertThat(day.availableRooms()).isEqualTo(2);
        // Critical invariant: list size must equal the integer count
        assertListSizeMatchesCount(day);
    }

    @Test
    void dailyAvailability_availableRoomsSortedByNumber() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 1);

        // Assign room "103" (middle), expect "101" and "102" first in sorted list
        Room r103 = activeRooms.get(2);
        RoomAssignment a1 = makeAssignment(r103, start, start.plusDays(1));

        stubDailyCommon(start, end, List.of(a1), 0L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);
        DailyAvailabilityDto day = result.get(0);

        List<String> numbers = day.availableRoomsList().stream()
                .map(AvailableRoomDto::roomNumber)
                .toList();
        assertThat(numbers).containsExactly("101", "102", "104", "105");
    }

    @Test
    void dailyAvailability_holdsNeverExceedActiveRooms() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 1);

        // 6 holds but only 5 active rooms — availableRooms should clamp to 0
        stubDailyCommon(start, end, List.of(), 6L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);
        DailyAvailabilityDto day = result.get(0);

        assertThat(day.availableRooms()).isEqualTo(0);
        assertListSizeMatchesCount(day);
    }

    @Test
    void dailyAvailability_multiDayRange_eachDayHasConsistentCounts() {
        LocalDate start = LocalDate.of(2025, 11, 1);
        LocalDate end = LocalDate.of(2025, 11, 3);

        Room r101 = activeRooms.get(0);
        // Assignment spans all 3 days
        RoomAssignment spanning = makeAssignment(r101, start, end.plusDays(1));

        when(propertyRepository.existsById(propertyId)).thenReturn(true);
        when(roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.ACTIVE)).thenReturn(activeRooms);
        when(roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.IN_MAINTENANCE)).thenReturn(List.of());
        when(roomAssignmentRepository.findConflictingAssignments(
                eq(propertyId), eq(start), eq(end.plusDays(1)), eq(ACTIVE_STATUSES)))
                .thenReturn(List.of(spanning));
        when(bookingRepository.countUnassignedOverlappingPropertyBookings(
                eq(propertyId), any(), any(), eq(HOLD_STATUSES)))
                .thenReturn(0L);

        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, start, end);

        assertThat(result).hasSize(3);
        for (DailyAvailabilityDto day : result) {
            assertListSizeMatchesCount(day);
            assertThat(day.bookedRooms() + day.availableRooms()).isLessThanOrEqualTo(day.totalActiveRooms());
        }
    }

    // --- helpers ---

    private void assertListSizeMatchesCount(DailyAvailabilityDto day) {
        assertThat(day.availableRoomsList().size())
                .as("availableRoomsList.size() must equal availableRooms integer count")
                .isEqualTo(day.availableRooms());
    }

    private void stubDailyCommon(LocalDate start, LocalDate end,
            List<RoomAssignment> assignments, long holds) {
        when(propertyRepository.existsById(propertyId)).thenReturn(true);
        when(roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.ACTIVE)).thenReturn(activeRooms);
        when(roomRepository.findByPropertyIdAndStatus(propertyId, RoomStatus.IN_MAINTENANCE)).thenReturn(List.of());
        when(roomAssignmentRepository.findConflictingAssignments(
                eq(propertyId), eq(start), eq(end.plusDays(1)), eq(ACTIVE_STATUSES)))
                .thenReturn(assignments);
        when(bookingRepository.countUnassignedOverlappingPropertyBookings(
                eq(propertyId), any(), any(), eq(HOLD_STATUSES)))
                .thenReturn(holds);
    }

    private Room makeRoom(String number) {
        Room r = new Room();
        r.setId(UUID.randomUUID());
        r.setNumber(number);
        r.setStatus(RoomStatus.ACTIVE);
        r.setCapacity(2);
        r.setBaseRate(BigDecimal.valueOf(1000));
        return r;
    }

    private RoomAssignment makeAssignment(Room room, LocalDate start, LocalDate end) {
        RoomAssignment ra = new RoomAssignment();
        ra.setId(UUID.randomUUID());
        ra.setRoom(room);
        ra.setStartDate(start);
        ra.setEndDate(end);
        ra.setStatus(RoomAssignmentStatus.SCHEDULED);
        return ra;
    }
}
