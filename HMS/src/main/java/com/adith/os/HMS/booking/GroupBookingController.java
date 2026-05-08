package com.adith.os.HMS.booking;

import com.adith.os.HMS.booking.dto.GroupBookingCreationDto;
import com.adith.os.HMS.booking.dto.GroupBookingSummaryDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Endpoints for group reservations and their member bookings.
 *
 * Base path: /api/properties/{propertyId}/reservations
 * (Renamed from /group-bookings in Phase C: a reservation is the group container.)
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/reservations")
public class GroupBookingController {

    private final GroupBookingService groupBookingService;

    public GroupBookingController(GroupBookingService groupBookingService) {
        this.groupBookingService = groupBookingService;
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> createGroupBooking(
            @PathVariable UUID propertyId,
            @Valid @RequestBody GroupBookingCreationDto dto) {
        GroupBookingSummaryDto summary = groupBookingService.createGroupBooking(propertyId, dto);
        return new ResponseEntity<>(summary, HttpStatus.CREATED);
    }

    // -------------------------------------------------------------------------
    // READ
    // -------------------------------------------------------------------------

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<GroupBookingSummaryDto>> getGroupReservations(
            @PathVariable UUID propertyId) {
        return ResponseEntity.ok(groupBookingService.getGroupReservationsByProperty(propertyId));
    }

    @GetMapping("/{reservationId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<GroupBookingSummaryDto> getGroupReservation(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {
        return ResponseEntity.ok(groupBookingService.getGroupReservationSummary(propertyId, reservationId));
    }

    // -------------------------------------------------------------------------
    // BILLING OPERATIONS
    // -------------------------------------------------------------------------

    @PatchMapping("/{reservationId}/consolidate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> consolidateBilling(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {
        return ResponseEntity.ok(groupBookingService.consolidateBilling(propertyId, reservationId));
    }

    @PatchMapping("/{reservationId}/separate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> separateBilling(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {
        return ResponseEntity.ok(groupBookingService.separateBilling(propertyId, reservationId));
    }

    // -------------------------------------------------------------------------
    // CHECK-IN / CHECK-OUT
    // -------------------------------------------------------------------------

    @PostMapping("/{reservationId}/check-in-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkInAll(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {
        return ResponseEntity.ok(groupBookingService.checkInAllBookings(propertyId, reservationId));
    }

    @PostMapping("/{reservationId}/bookings/{bookingId}/check-in")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkInBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(groupBookingService.checkInBooking(propertyId, reservationId, bookingId));
    }

    @PostMapping("/{reservationId}/bookings/{bookingId}/check-out")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkOutBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @PathVariable UUID bookingId) {
        return ResponseEntity.ok(groupBookingService.checkOutBooking(propertyId, reservationId, bookingId));
    }

    // -------------------------------------------------------------------------
    // CANCEL
    // -------------------------------------------------------------------------

    @PostMapping("/{reservationId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> cancelReservation(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {
        return ResponseEntity.ok(groupBookingService.cancelReservation(propertyId, reservationId));
    }
}
