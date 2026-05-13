package com.adith.os.HMS.availability;

import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate response for the tape-chart view.
 *
 *  - rooms              : ordered list of rooms in the property (caller may group by unit).
 *  - realAssignments    : actual RoomAssignment rows overlapping the requested window.
 *  - ghostAssignments   : speculative first-fit placements for bookings with room == null.
 *                         These are NOT persisted — recomputed on every fetch.
 *
 * The frontend renders ghosts with a dashed border + 80% opacity to signal that
 * they aren't pinned. Drag/move actions on the chart should never act on ghosts;
 * pinning happens through an explicit "Assign Room…" action that calls
 * BookingService.assignRoomToBooking.
 */
public record TapeChartDto(
        List<TapeChartRoomDto> rooms,
        List<RoomAssignmentDto> realAssignments,
        List<GhostAssignmentDto> ghostAssignments
) {

    public record TapeChartRoomDto(
            UUID id,
            String number,
            UUID unitId,
            String unitName,
            BigDecimal baseRate,
            String status
    ) {}

    public record GhostAssignmentDto(
            UUID bookingId,
            UUID guestId,
            String guestName,
            UUID roomId,
            String roomNumber,
            UUID unitId,
            String unitName,
            UUID reservationId,
            String groupReference,
            BookingStatus bookingStatus,
            LocalDate startDate,
            LocalDate endDate,
            // Mirrors RoomAssignmentDto.status for rendering uniformity (always SCHEDULED for ghosts).
            RoomAssignmentStatus status
    ) {}
}
