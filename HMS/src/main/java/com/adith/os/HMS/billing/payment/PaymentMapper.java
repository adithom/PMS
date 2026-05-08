package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PaymentMapper {

    /**
     * Build a Payment from a creation DTO. The caller is responsible for setting
     * the routing pointer (bookingId or reservationId) and invoking save.
     *
     * @param currency currency code from the owning folio or reservation.
     */
    public Payment toEntity(@Valid PaymentCreationDto dto, String currency) {
        if (dto == null) return null;

        Payment payment = new Payment();
        payment.setAmount(dto.amount());
        payment.setCurrency(currency);
        payment.setPaymentMethod(dto.paymentMethod());
        // Default to COMPLETED for the 1-step payment flow
        payment.setPaymentStatus(PaymentStatus.COMPLETED);

        if (dto.targetCategory() != null) {
            payment.setTargetCategory(dto.targetCategory());
        }

        if (dto.transactionId() != null && !dto.transactionId().isBlank()) {
            payment.setTransactionId(dto.transactionId().trim());
        }
        if (dto.cardLastFour() != null && !dto.cardLastFour().isBlank()) {
            payment.setCardLastFour(dto.cardLastFour().trim());
        }
        if (dto.cardType() != null && !dto.cardType().isBlank()) {
            payment.setCardType(dto.cardType().trim().toUpperCase());
        }

        if (dto.bankName() != null && !dto.bankName().isBlank()) {
            payment.setBankName(dto.bankName().trim());
        }
        if (dto.accountNumber() != null && !dto.accountNumber().isBlank()) {
            payment.setAccountNumber(dto.accountNumber().trim());
        }
        if (dto.referenceNumber() != null && !dto.referenceNumber().isBlank()) {
            payment.setReferenceNumber(dto.referenceNumber().trim());
        }

        if (dto.upiId() != null && !dto.upiId().isBlank()) {
            payment.setUpiId(dto.upiId().trim());
        }

        payment.setNotes(dto.notes());
        payment.setProcessedBy(dto.processedBy());

        if (dto.travelAgentId() != null) {
            payment.setTravelAgentId(dto.travelAgentId());
        }

        return payment;
    }

    public PaymentDto toDto(Payment payment) {
        if (payment == null) return null;

        return new PaymentDto(
                payment.getId(),
                payment.getPaymentNumber(),
                payment.getBookingId(),
                payment.getReservationId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaymentMethod(),
                payment.getPaymentStatus(),
                payment.getTargetCategory(),
                payment.getTransactionId(),
                payment.getCardLastFour(),
                payment.getCardType(),
                payment.getReferenceNumber(),
                payment.getUpiId(),
                payment.getRefundedAmount(),
                payment.isRefundable(),
                payment.getRefundableAmount(),
                payment.getRefundReason(),
                payment.getRefundedAt(),
                payment.getProcessedBy(),
                payment.getPaymentDate(),
                payment.getCreatedAt(),
                payment.getNotes(),
                payment.getTravelAgentId()
        );
    }

    public List<PaymentDto> toDtoList(List<Payment> payments) {
        if (payments == null || payments.isEmpty()) {
            return List.of();
        }

        return payments.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}
