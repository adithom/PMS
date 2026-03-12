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

@RestController
@RequestMapping("/api/properties/{propertyId}/group-bookings")
public class GroupBookingController {

    private final GroupBookingService groupBookingService;

    public GroupBookingController(GroupBookingService groupBookingService) {
        this.groupBookingService = groupBookingService;
    }

    // -------------------------------------------------------------------------
    // CREATE
    // -------------------------------------------------------------------------

    /**
     * POST /api/properties/{propertyId}/group-bookings
     *
     * Creates a group booking with one parent and N child bookings.
     * Body: GroupBookingCreationDto
     */
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

    /**
     * GET /api/properties/{propertyId}/group-bookings
     *
     * Returns all group bookings for the property (parent bookings only, with child summary).
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<GroupBookingSummaryDto>> getGroupBookings(
            @PathVariable UUID propertyId) {
        List<GroupBookingSummaryDto> groups = groupBookingService.getGroupBookingsByProperty(propertyId);
        return ResponseEntity.ok(groups);
    }

    /**
     * GET /api/properties/{propertyId}/group-bookings/{parentBookingId}
     *
     * Returns a single group booking summary with all child details.
     */
    @GetMapping("/{parentBookingId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<GroupBookingSummaryDto> getGroupBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.getGroupBookingSummary(
                propertyId, parentBookingId);
        return ResponseEntity.ok(summary);
    }

    // -------------------------------------------------------------------------
    // BILLING OPERATIONS
    // -------------------------------------------------------------------------

    /**
     * PATCH /api/properties/{propertyId}/group-bookings/{parentBookingId}/consolidate
     *
     * Routes ALL child folios to the organizer's master folio.
     * Use this to switch the group to consolidated billing.
     */
    @PatchMapping("/{parentBookingId}/consolidate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> consolidateBilling(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.consolidateBilling(
                propertyId, parentBookingId);
        return ResponseEntity.ok(summary);
    }

    /**
     * PATCH /api/properties/{propertyId}/group-bookings/{parentBookingId}/separate
     *
     * Un-routes ALL child folios so each room settles independently.
     */
    @PatchMapping("/{parentBookingId}/separate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> separateBilling(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.separateBilling(
                propertyId, parentBookingId);
        return ResponseEntity.ok(summary);
    }

    /**
     * PATCH /api/properties/{propertyId}/group-bookings/{parentBookingId}/children/{childBookingId}/route
     *
     * Routes a single child folio to a target folio.
     * Pass targetFolioId as a query param. Omit it to un-route (separate billing for that room).
     */
    @PatchMapping("/{parentBookingId}/children/{childBookingId}/route")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> routeChildFolio(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @PathVariable UUID childBookingId,
            @RequestParam(required = false) UUID targetFolioId) {
        GroupBookingSummaryDto summary = groupBookingService.routeChildFolio(
                propertyId, parentBookingId, childBookingId, targetFolioId);
        return ResponseEntity.ok(summary);
    }

    // -------------------------------------------------------------------------
    // CHECK-IN / CHECK-OUT
    // -------------------------------------------------------------------------

    /**
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/check-in-all
     *
     * Checks in all CONFIRMED children at once. Auto-assigns rooms where needed.
     */
    @PostMapping("/{parentBookingId}/check-in-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkInAll(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.checkInAllChildren(
                propertyId, parentBookingId);
        return ResponseEntity.ok(summary);
    }

    /**
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/children/{childBookingId}/check-in
     *
     * Checks in a single child booking.
     */
    @PostMapping("/{parentBookingId}/children/{childBookingId}/check-in")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkInChild(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @PathVariable UUID childBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.checkInChild(
                propertyId, parentBookingId, childBookingId);
        return ResponseEntity.ok(summary);
    }

    /**
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/children/{childBookingId}/check-out
     *
     * Checks out a single child booking. Enforces folio settlement unless routed.
     */
    @PostMapping("/{parentBookingId}/children/{childBookingId}/check-out")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> checkOutChild(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @PathVariable UUID childBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.checkOutChild(
                propertyId, parentBookingId, childBookingId);
        return ResponseEntity.ok(summary);
    }

    // -------------------------------------------------------------------------
    // CANCEL
    // -------------------------------------------------------------------------

    /**
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/cancel
     *
     * Cancels the entire group (parent + all children).
     * Fails if any child is already CHECKED_IN.
     */
    @PostMapping("/{parentBookingId}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupBookingSummaryDto> cancelGroup(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {
        GroupBookingSummaryDto summary = groupBookingService.cancelGroupBooking(
                propertyId, parentBookingId);
        return ResponseEntity.ok(summary);
    }
}