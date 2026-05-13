package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Endpoints for reservation-level (master) payments. These payments are tagged with
 * `Payment.reservationId` and live independently of any single booking's folio. When a
 * reservation is in SEPARATE billing mode, bill generation distributes them as an applied
 * credit on each booking bill (read-time split — no Payment row movement).
 */
@RestController
@RequestMapping("/api/properties/{propertyId}/reservations/{reservationId}/payments")
public class ReservationPaymentController {

    private final PaymentService paymentService;

    public ReservationPaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<PaymentDto> recordReservationPayment(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId,
            @Valid @RequestBody PaymentCreationDto dto,
            @AuthenticationPrincipal UserPrincipal userPrincipal) {

        PaymentDto payment = paymentService.recordReservationPayment(
                propertyId, reservationId, dto, userPrincipal.getUsername());
        return new ResponseEntity<>(payment, HttpStatus.CREATED);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<PaymentDto>> getReservationPayments(
            @PathVariable UUID propertyId,
            @PathVariable UUID reservationId) {

        return ResponseEntity.ok(paymentService.getPaymentsByReservation(propertyId, reservationId));
    }
}
