package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.billing.payment.dto.PaymentUpdateDto;
import com.adith.os.HMS.billing.payment.dto.RefundDto;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/folios/{folioId}/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    // CREATE - Instantly record a completed payment
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<PaymentDto> recordPayment(
            @PathVariable UUID propertyId,
            @PathVariable UUID folioId,
            @Valid @RequestBody PaymentCreationDto paymentCreationDto,
            @AuthenticationPrincipal com.adith.os.HMS.security.UserPrincipal userPrincipal) {

        PaymentDto payment = paymentService.recordPayment(propertyId, folioId, paymentCreationDto, userPrincipal.getUsername());
        return new ResponseEntity<>(payment, HttpStatus.CREATED);
    }

    // READ - Get all payments for folio
    @GetMapping
    public ResponseEntity<List<PaymentDto>> getPaymentsByFolio(
            @PathVariable UUID propertyId,
            @PathVariable UUID folioId) {
        List<PaymentDto> payments = paymentService.getPaymentsByFolio(propertyId, folioId);
        return ResponseEntity.ok(payments);
    }

    // REFUND
    @PostMapping("/{id}/refund")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')") // Refunds usually require manager approval
    public ResponseEntity<PaymentDto> refundPayment(
            @PathVariable UUID propertyId,
            @PathVariable UUID folioId,
            @PathVariable("id") UUID paymentId,
            @Valid @RequestBody RefundDto refundDto) {
        PaymentDto payment = paymentService.refundPayment(propertyId, folioId, paymentId, refundDto);
        return ResponseEntity.ok(payment);
    }
}
