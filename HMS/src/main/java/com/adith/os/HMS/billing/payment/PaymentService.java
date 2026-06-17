package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioRepository;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.billing.payment.dto.PaymentUpdateDto;
import com.adith.os.HMS.billing.payment.dto.RefundDto;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.reservation.Reservation;
import com.adith.os.HMS.reservation.ReservationRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final FolioRepository folioRepository;
    private final FolioService folioService;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentMapper paymentMapper;

    public PaymentService(
            PaymentRepository paymentRepository,
            FolioRepository folioRepository,
            FolioService folioService,
            PropertyRepository propertyRepository,
            ReservationRepository reservationRepository,
            PaymentMapper paymentMapper) {
        this.paymentRepository = paymentRepository;
        this.folioRepository = folioRepository;
        this.folioService = folioService;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.paymentMapper = paymentMapper;
    }

    /**
     * Record a folio (booking-level) payment.
     * Tags the payment with bookingId derived from the folio's booking.
     */
    @Transactional
    public PaymentDto recordPayment(UUID propertyId, UUID folioId, @Valid PaymentCreationDto dto, String username) {

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio does not belong to the specified property");
        }

        Payment payment = paymentMapper.toEntity(dto, folio.getCurrency());
        payment.setPaymentNumber(generatePaymentNumber(folio.getProperty()));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setProcessedBy(username != null ? username : "SYSTEM");

        // Folio payments tag the booking they settle. Reservation-level (master) payments
        // come through recordReservationPayment().
        com.adith.os.HMS.booking.Booking b = folio.getBooking();
        if (b != null) {
            payment.setBookingId(b.getId());
        }

        Payment savedPayment = paymentRepository.save(payment);

        // Recompute folio totals (paidAmount queried from PaymentRepository).
        folioService.recomputeFolioTotals(folio);

        return paymentMapper.toDto(savedPayment);
    }

    /**
     * Record a reservation-level (master) payment.
     * Tags the payment with reservationId. Bookings under the reservation see this
     * money as an applied credit at bill-generation time when the reservation is in
     * SEPARATE billing mode (read-time split — no Payment row movement).
     */
    @Transactional
    public PaymentDto recordReservationPayment(UUID propertyId, UUID reservationId,
                                               @Valid PaymentCreationDto dto, String username) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation does not belong to the specified property");
        }

        Payment payment = paymentMapper.toEntity(dto, reservation.getCurrency());
        payment.setPaymentNumber(generatePaymentNumber(reservation.getProperty()));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setProcessedBy(username != null ? username : "SYSTEM");

        payment.setReservationId(reservationId);

        Payment savedPayment = paymentRepository.save(payment);
        return paymentMapper.toDto(savedPayment);
    }

    /**
     * Process a refund. The legacy URL is folio-keyed, so we resolve the folio for ownership
     * checks via the payment's bookingId. (Refunds will be replaced by Payment edit/delete in
     * a future phase — don't extend this flow.)
     */
    @Transactional
    public PaymentDto refundPayment(UUID propertyId, UUID folioId, UUID paymentId, @Valid RefundDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }
        if (paymentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund data is required");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        Folio folio = resolveAndValidateFolioForPayment(propertyId, folioId, payment);

        try {
            payment.refund(dto.amount(), dto.reason());
            Payment savedPayment = paymentRepository.save(payment);

            folioService.recomputeFolioTotals(folio);

            return paymentMapper.toDto(savedPayment);
        } catch (IllegalStateException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to process refund: " + e.getMessage());
        }
    }

    /**
     * Update amount and/or notes on a folio (booking-level) payment.
     */
    @Transactional
    public PaymentDto updatePayment(UUID propertyId, UUID folioId, UUID paymentId, @Valid PaymentUpdateDto dto) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        Folio folio = resolveAndValidateFolioForPayment(propertyId, folioId, payment);

        if (dto.amount() != null) {
            payment.setAmount(dto.amount());
        }
        if (dto.notes() != null) {
            payment.setNotes(dto.notes());
        }

        Payment saved = paymentRepository.save(payment);
        folioService.recomputeFolioTotals(folio);
        return paymentMapper.toDto(saved);
    }

    /**
     * Delete a folio (booking-level) payment and recompute folio totals.
     */
    @Transactional
    public void deletePayment(UUID propertyId, UUID folioId, UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        Folio folio = resolveAndValidateFolioForPayment(propertyId, folioId, payment);
        paymentRepository.delete(payment);
        folioService.recomputeFolioTotals(folio);
    }

    /**
     * Update amount and/or notes on a reservation-level (master) payment.
     */
    @Transactional
    public PaymentDto updateReservationPayment(UUID propertyId, UUID reservationId, UUID paymentId, @Valid PaymentUpdateDto dto) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reservation does not belong to the specified property");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (!reservationId.equals(payment.getReservationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment does not belong to the specified reservation");
        }

        if (dto.amount() != null) {
            payment.setAmount(dto.amount());
        }
        if (dto.notes() != null) {
            payment.setNotes(dto.notes());
        }

        return paymentMapper.toDto(paymentRepository.save(payment));
    }

    /**
     * Delete a reservation-level (master) payment.
     */
    @Transactional
    public void deleteReservationPayment(UUID propertyId, UUID reservationId, UUID paymentId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reservation does not belong to the specified property");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (!reservationId.equals(payment.getReservationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment does not belong to the specified reservation");
        }

        paymentRepository.delete(payment);
    }

    /**
     * Get ALL payments for a reservation — both reservation-level (master) and
     * booking-level (tagged via bookingId for each member booking).
     */
    public List<PaymentDto> getAllPaymentsForReservation(UUID propertyId, UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));
        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reservation does not belong to the specified property");
        }

        List<Payment> payments = paymentRepository.findAllByReservation(reservationId);
        return paymentMapper.toDtoList(payments);
    }

    /**
     * Get payment by ID
     */
    public PaymentDto getPaymentById(UUID propertyId, UUID folioId, UUID paymentId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }
        if (paymentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment ID is required");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        resolveAndValidateFolioForPayment(propertyId, folioId, payment);

        return paymentMapper.toDto(payment);
    }

    /**
     * Get all booking-level payments for a folio (i.e., payments tagged with the folio's bookingId).
     * Reservation-level (master) payments are NOT included here.
     */
    public List<PaymentDto> getPaymentsByFolio(UUID propertyId, UUID folioId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }

        if (folio.getBooking() == null) {
            return List.of();
        }

        List<Payment> payments = paymentRepository.findByBookingId(folio.getBooking().getId());
        return paymentMapper.toDtoList(payments);
    }

    /**
     * Get all payments for a reservation (master/reservation-level only).
     */
    public List<PaymentDto> getPaymentsByReservation(UUID propertyId, UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reservation not found"));

        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation does not belong to the specified property");
        }

        return paymentMapper.toDtoList(paymentRepository.findByReservationId(reservationId));
    }

    /**
     * Get payments by property and date range
     */
    public List<PaymentDto> getPaymentsByPropertyAndDateRange(
            UUID propertyId,
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            PaymentStatus status) {

        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        try {
            List<Payment> payments = paymentRepository.findByPropertyAndDateRangeAndStatus(
                    propertyId, startDate, endDate, status);
            return paymentMapper.toDtoList(payments);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch payments: " + e.getMessage());
        }
    }

    /**
     * Cancel a pending payment
     */
    @Transactional
    public void cancelPayment(UUID propertyId, UUID folioId, UUID paymentId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (folioId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio ID is required");
        }
        if (paymentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment ID is required");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        resolveAndValidateFolioForPayment(propertyId, folioId, payment);

        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only pending payments can be cancelled");
        }

        try {
            payment.setPaymentStatus(PaymentStatus.CANCELLED);
            paymentRepository.save(payment);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to cancel payment: " + e.getMessage());
        }
    }

    /**
     * Resolve a folio by id and validate the payment belongs to it (via bookingId)
     * and the folio belongs to the property. Replaces the old `payment.getFolio()`
     * ownership check with a `bookingId → Booking → Folio` lookup.
     */
    private Folio resolveAndValidateFolioForPayment(UUID propertyId, UUID folioId, Payment payment) {
        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Folio does not belong to the specified property");
        }
        if (folio.getBooking() == null
                || payment.getBookingId() == null
                || !folio.getBooking().getId().equals(payment.getBookingId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified folio");
        }
        return folio;
    }

    /**
     * Generate unique payment number
     */
    private String generatePaymentNumber(Property property) {
        String propertyCode = property.getCode();
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = paymentRepository.count() + 1;

        String paymentNumber;
        int attempts = 0;
        do {
            paymentNumber = String.format("PAY-%s-%s-%05d", propertyCode, date, count + attempts);
            attempts++;
        } while (paymentRepository.existsByPaymentNumber(paymentNumber) && attempts < 100);

        if (attempts >= 100) {
            throw new RuntimeException("Failed to generate unique payment number after 100 attempts");
        }

        return paymentNumber;
    }
}
