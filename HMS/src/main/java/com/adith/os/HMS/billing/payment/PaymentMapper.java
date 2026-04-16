package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PaymentMapper {

    public Payment toEntity(@Valid PaymentCreationDto dto, Folio folio) {
        if (dto == null) return null;
        if (folio == null) throw new IllegalArgumentException("Folio is required");

        Payment payment = new Payment();
        payment.setFolio(folio);
        payment.setAmount(dto.amount());
        payment.setCurrency(folio.getCurrency());
        payment.setPaymentMethod(dto.paymentMethod());
        // Updated to default to COMPLETED for the 1-step payment flow
        payment.setPaymentStatus(PaymentStatus.COMPLETED);

        // Map Target Category
        if (dto.targetCategory() != null) {
            payment.setTargetCategory(dto.targetCategory());
        }

        // Card payment details
        if (dto.transactionId() != null && !dto.transactionId().isBlank()) {
            payment.setTransactionId(dto.transactionId().trim());
        }
        if (dto.cardLastFour() != null && !dto.cardLastFour().isBlank()) {
            payment.setCardLastFour(dto.cardLastFour().trim());
        }
        if (dto.cardType() != null && !dto.cardType().isBlank()) {
            payment.setCardType(dto.cardType().trim().toUpperCase());
        }

        // Bank transfer details
        if (dto.bankName() != null && !dto.bankName().isBlank()) {
            payment.setBankName(dto.bankName().trim());
        }
        if (dto.accountNumber() != null && !dto.accountNumber().isBlank()) {
            payment.setAccountNumber(dto.accountNumber().trim());
        }
        if (dto.referenceNumber() != null && !dto.referenceNumber().isBlank()) {
            payment.setReferenceNumber(dto.referenceNumber().trim());
        }

        // UPI details
        if (dto.upiId() != null && !dto.upiId().isBlank()) {
            payment.setUpiId(dto.upiId().trim());
        }

        // General
        payment.setNotes(dto.notes());
        payment.setProcessedBy(dto.processedBy());

        // Travel agent billing
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
                payment.getFolio().getId(),
                payment.getFolio().getFolioNumber(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaymentMethod(),
                payment.getPaymentStatus(),
                payment.getTargetCategory(), // Added missing field
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