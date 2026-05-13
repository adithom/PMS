package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.GroupMultiBillDto;
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
 * Endpoints for group/reservation-level bill generation, retrieval, and voiding.
 *
 * Base path: /api/properties/{propertyId}/reservations/{reservationId}/bills
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/reservations/{reservationId}/bills")
public class GroupBillController {

    private final GroupBillGenerationService groupBillGenerationService;

    public GroupBillController(GroupBillGenerationService groupBillGenerationService) {
        this.groupBillGenerationService = groupBillGenerationService;
    }

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GroupMultiBillDto> generateGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @RequestParam(required = false) String guestGstNumber) {

        GroupMultiBillDto result = groupBillGenerationService
                .generateGroupMultiBill(propertyId, reservationId, guestGstNumber);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<GroupBill>> getGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {

        return ResponseEntity.ok(groupBillGenerationService.getGroupBills(reservationId));
    }

    @GetMapping("/{groupBillId}/download-url")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<String> getGroupBillDownloadUrl(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @PathVariable UUID groupBillId) {
        return ResponseEntity.ok(groupBillGenerationService.generateDownloadUrl(groupBillId));
    }

    @PostMapping("/{groupBillId}/void")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<GroupBill> voidGroupBill(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
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

    @PostMapping("/void-all")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<GroupBill>> voidAllGroupBills(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        try {
            List<GroupBill> voided = groupBillGenerationService
                    .voidAllActiveGroupBills(reservationId, reason, userPrincipal.getUsername());
            return ResponseEntity.ok(voided);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
