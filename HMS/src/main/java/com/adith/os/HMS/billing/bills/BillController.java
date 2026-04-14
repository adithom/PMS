package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.BillDto;
import com.adith.os.HMS.billing.bills.dto.DoubleBillDto;
import com.adith.os.HMS.security.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/bills")
public class BillController {

    private final BillService billService;

    public BillController(BillService billService) {
        this.billService = billService;
    }

    // Generates Room and Ancillary bills for a given Folio.
    @PostMapping("/generate/{folioId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<DoubleBillDto> generateBills(
            @PathVariable UUID folioId,
            @RequestParam(required = false) String guestGstNumber
    ) {
        DoubleBillDto generatedBills = billService.generateDoubleBill(folioId, guestGstNumber);
        return ResponseEntity.ok(generatedBills);
    }

    @PostMapping("/{billId}/void")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<BillDto> voidBill(
            @PathVariable java.util.UUID billId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        try {
            BillDto voidedBill = billService.voidBill(billId, reason, userPrincipal.getUsername());
            return ResponseEntity.ok(voidedBill);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PostMapping("/folio/{folioId}/void-active")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<BillDto>> voidActiveBillsForFolio(
            @PathVariable java.util.UUID folioId,
            @RequestParam String reason,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        try {
            List<BillDto> voidedBills = billService.voidActiveBillsForFolio(folioId, reason, userPrincipal.getUsername());
            return ResponseEntity.ok(voidedBills);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }
}
