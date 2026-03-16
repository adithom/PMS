package com.adith.os.HMS.roomassignment;

import com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto;
import com.adith.os.HMS.roomassignment.dto.RoomShiftRequestDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/bookings/{bookingId}")
public class RoomAssignmentController {

    private final RoomAssignmentService roomAssignmentService;

    public RoomAssignmentController(RoomAssignmentService roomAssignmentService) {
        this.roomAssignmentService = roomAssignmentService;
    }

    /**
     * Shift the guest to a different room.
     * POST /api/properties/{propertyId}/bookings/{bookingId}/shift-room
     */
    @PostMapping("/shift-room")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<RoomAssignmentDto>> shiftRoom(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId,
            @Valid @RequestBody RoomShiftRequestDto requestDto) {

        List<RoomAssignmentDto> assignments = roomAssignmentService.shiftRoom(propertyId, bookingId, requestDto);
        return ResponseEntity.ok(assignments);
    }

    /**
     * Get all room assignments for a booking.
     * GET /api/properties/{propertyId}/bookings/{bookingId}/room-assignments
     */
    @GetMapping("/room-assignments")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<RoomAssignmentDto>> getRoomAssignments(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId) {

        List<RoomAssignmentDto> assignments = roomAssignmentService.getAssignmentsForBooking(propertyId, bookingId);
        return ResponseEntity.ok(assignments);
    }
}
