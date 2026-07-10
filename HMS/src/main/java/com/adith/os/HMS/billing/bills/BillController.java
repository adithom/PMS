package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.BillBatchPageDto;
import com.adith.os.HMS.billing.bills.dto.BillDto;
import com.adith.os.HMS.billing.bills.dto.DownloadZipRequestDto;
import com.adith.os.HMS.billing.bills.dto.MultiBillDto;
import com.adith.os.HMS.security.UserPrincipal;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/bills")
public class BillController {

    private final BillService billService;

    public BillController(BillService billService) {
        this.billService = billService;
    }

    @PostMapping("/generate/{folioId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<MultiBillDto> generateBills(
            @PathVariable UUID folioId,
            @RequestParam(required = false) String guestGstNumber,
            @RequestParam(defaultValue = "false") boolean splitAncillary
    ) {
        return ResponseEntity.ok(billService.generateMultiBill(folioId, guestGstNumber, splitAncillary));
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

    @GetMapping("/folio/{folioId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<BillDto>> getBillsForFolio(@PathVariable UUID folioId) {
        return ResponseEntity.ok(billService.getBillsForFolio(folioId));
    }

    @GetMapping("/reservation/{reservationId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<BillDto>> getBillsForReservation(@PathVariable UUID reservationId) {
        return ResponseEntity.ok(billService.getBillsForReservation(reservationId));
    }

    @GetMapping("/{billId}/download-url")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<String> getBillDownloadUrl(@PathVariable UUID billId) {
        return ResponseEntity.ok(billService.generateDownloadUrl(billId));
    }


    @GetMapping("/ledger")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<BillBatchPageDto> getBillLedger(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "false") boolean includeVoided) {
        return ResponseEntity.ok(billService.getLedger(from, to, includeVoided));
    }

    @PostMapping("/ledger/download-zip")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public void downloadLedgerZip(
            @RequestBody @jakarta.validation.Valid DownloadZipRequestDto request,
            HttpServletResponse response) throws IOException {
        String fileName = "bills-export-" + LocalDate.now(ZoneId.of("Asia/Kolkata")) + ".zip";
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
        billService.downloadBillsAsZip(request.billIds(), request.reservationIds(), response.getOutputStream());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<String> handleConstraintViolation(ConstraintViolationException ex) {
        String msg = ex.getConstraintViolations().stream()
                .map(cv -> cv.getMessage())
                .findFirst()
                .orElse("Validation failed");
        return ResponseEntity.badRequest().body(msg);
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
