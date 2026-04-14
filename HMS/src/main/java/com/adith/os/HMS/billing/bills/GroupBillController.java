package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.GroupDoubleBillDto;
import com.adith.os.HMS.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Endpoints for group bill generation, retrieval, and voiding.
 *
 * Base path: /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills
 *
 * Kept under the group-bookings hierarchy so the propertyId scoping
 * is consistent with GroupBookingController and GroupBillingController.
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/group-bookings/{parentBookingId}/bills")
public class GroupBillController {

    private final GroupBillGenerationService groupBillGenerationService;

    public GroupBillController(GroupBillGenerationService groupBillGenerationService) {
        this.groupBillGenerationService = groupBillGenerationService;
    }

    /**
     * Generate room rent + ancillary bills for a group booking.
     * Fails with 409 if active bills already exist — void them first.
     *
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills/generate
     */
    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupDoubleBillDto> generateGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @RequestParam(required = false) String guestGstNumber) {

        GroupDoubleBillDto result = groupBillGenerationService
                .generateGroupDoubleBill(propertyId, parentBookingId, guestGstNumber);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /**
     * List all GroupBill records (including voided) for a group booking.
     *
     * GET /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<GroupBill>> getGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId) {

        return ResponseEntity.ok(groupBillGenerationService.getGroupBills(parentBookingId));
    }

    /**
     * Get a fresh pre-signed download URL for an existing group bill PDF.
     *
     * GET /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills/{groupBillId}/download-url
     */
    @GetMapping("/{groupBillId}/download-url")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<String> getGroupBillDownloadUrl(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @PathVariable UUID groupBillId) {
        return ResponseEntity.ok(groupBillGenerationService.generateDownloadUrl(groupBillId));
    }

    /**
     * Void a single GroupBill by its own ID.
     *
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills/{groupBillId}/void
     */
    @PostMapping("/{groupBillId}/void")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<GroupBill> voidGroupBill(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @PathVariable UUID groupBillId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        try {
            GroupBill voided = groupBillGenerationService
                    .voidGroupBill(groupBillId, reason, userPrincipal.getUsername());
            return ResponseEntity.ok(voided);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /**
     * Void ALL active GroupBills for a group booking.
     * Useful before correcting charges and re-generating.
     *
     * POST /api/properties/{propertyId}/group-bookings/{parentBookingId}/bills/void-all
     */
    @PostMapping("/void-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<GroupBill>> voidAllGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID parentBookingId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        try {
            List<GroupBill> voided = groupBillGenerationService
                    .voidAllActiveGroupBills(parentBookingId, reason, userPrincipal.getUsername());
            return ResponseEntity.ok(voided);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}