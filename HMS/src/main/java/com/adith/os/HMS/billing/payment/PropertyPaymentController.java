package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Controller for property-level payment queries (reports, analytics)
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/payments")
public class PropertyPaymentController {

    private final PaymentService paymentService;

    public PropertyPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    /**
     * Get payments by date range and status
     * GET /api/properties/{propertyId}/payments?startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z&status=COMPLETED
     */
    @GetMapping
    public ResponseEntity<List<PaymentDto>> getPaymentsByPropertyAndDateRange(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime endDate,
            @RequestParam(required = false, defaultValue = "COMPLETED") PaymentStatus status) {

        List<PaymentDto> payments = paymentService.getPaymentsByPropertyAndDateRange(
                propertyId, startDate, endDate, status);
        return ResponseEntity.ok(payments);
    }
}
