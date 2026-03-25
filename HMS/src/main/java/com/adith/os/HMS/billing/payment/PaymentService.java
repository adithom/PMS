package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioRepository;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.billing.payment.dto.PaymentUpdateDto;
import com.adith.os.HMS.billing.payment.dto.RefundDto;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final FolioRepository folioRepository;
    private final PropertyRepository propertyRepository;
    private final PaymentMapper paymentMapper;

    public PaymentService(
            PaymentRepository paymentRepository,
            FolioRepository folioRepository,
            PropertyRepository propertyRepository,
            PaymentMapper paymentMapper) {
        this.paymentRepository = paymentRepository;
        this.folioRepository = folioRepository;
        this.propertyRepository = propertyRepository;
        this.paymentMapper = paymentMapper;
    }

    /**
     * Instantly record a completed payment and update the folio
     */
    @Transactional
    public PaymentDto recordPayment(UUID propertyId, UUID folioId, @Valid PaymentCreationDto dto, String username) {

        Folio folio = folioRepository.findById(folioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folio not found"));

        if (!folio.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Folio does not belong to the specified property");
        }

        // Create the instantly completed payment
        Payment payment = paymentMapper.toEntity(dto, folio);
        payment.setPaymentNumber(generatePaymentNumber(folio.getProperty()));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setProcessedBy(username != null ? username : "SYSTEM");

        // NEW: Set the target category (Room vs Ancillary)
        if (dto.targetCategory() != null) {
            payment.setTargetCategory(dto.targetCategory());
        }

        Payment savedPayment = paymentRepository.save(payment);

        // Instantly recalculate the folio
        folio.getPayments().add(savedPayment);
        folio.recalculateTotals();

        // Auto-close folio if fully settled (skip for routed folios — their balance is handled by the parent)
        if (!folio.isRouted()
                && folio.getStatus() == com.adith.os.HMS.billing.folio.FolioStatus.OPEN
                && folio.getBalanceDue().compareTo(BigDecimal.ZERO) <= 0) {
            folio.close();
        }

        Folio savedFolio = folioRepository.save(folio);

        // Bubble up recalculation to the Parent if this folio is routed
        if (savedFolio.isRouted()) {
            Folio parentFolio = savedFolio.getRoutedToFolio();
            parentFolio.recalculateTotals();
            folioRepository.save(parentFolio);
        }

        return paymentMapper.toDto(savedPayment);
    }

    /**
     * Process a refund
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

        if (!payment.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified folio");
        }

        if (!payment.getFolio().getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified property");
        }

        try {
            payment.refund(dto.amount(), dto.reason());
            Payment savedPayment = paymentRepository.save(payment);

            // Update folio totals
            Folio folio = payment.getFolio();
            folio.recalculateTotals();
            Folio savedFolio = folioRepository.save(folio);

            // Bubble up recalculation to the Parent if this folio is routed
            if (savedFolio.isRouted()) {
                Folio parentFolio = savedFolio.getRoutedToFolio();
                parentFolio.recalculateTotals();
                folioRepository.save(parentFolio);
            }

            return paymentMapper.toDto(savedPayment);
        } catch (IllegalStateException | IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to process refund: " + e.getMessage());
        }
    }

    /**
     * Update payment details
     */
    @Transactional
    public PaymentDto updatePayment(UUID propertyId, UUID folioId, UUID paymentId, @Valid PaymentUpdateDto dto) {
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));

        if (!payment.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified folio");
        }

        if (!payment.getFolio().getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified property");
        }

        try {
            // Update only provided fields
            if (dto.paymentStatus() != null) {
                payment.setPaymentStatus(dto.paymentStatus());
            }

            if (dto.transactionId() != null && !dto.transactionId().isBlank()) {
                payment.setTransactionId(dto.transactionId().trim());
            }

            if (dto.notes() != null) {
                payment.setNotes(dto.notes());
            }

            Payment savedPayment = paymentRepository.save(payment);

            // Update folio totals if status changed to COMPLETED
            if (dto.paymentStatus() == PaymentStatus.COMPLETED) {
                Folio folio = payment.getFolio();
                folio.recalculateTotals();
                Folio savedFolio = folioRepository.save(folio);

                // Bubble up recalculation to the Parent if this folio is routed
                if (savedFolio.isRouted()) {
                    Folio parentFolio = savedFolio.getRoutedToFolio();
                    parentFolio.recalculateTotals();
                    folioRepository.save(parentFolio);
                }
            }

            return paymentMapper.toDto(savedPayment);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update payment: " + e.getMessage());
        }
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

        if (!payment.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified folio");
        }

        if (!payment.getFolio().getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified property");
        }

        return paymentMapper.toDto(payment);
    }

    /**
     * Get all payments for a folio
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

        try {
            List<Payment> payments = paymentRepository.findByFolioId(folioId);
            return paymentMapper.toDtoList(payments);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch payments: " + e.getMessage());
        }
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

        if (!payment.getFolio().getId().equals(folioId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified folio");
        }

        if (!payment.getFolio().getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Payment does not belong to the specified property");
        }

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
