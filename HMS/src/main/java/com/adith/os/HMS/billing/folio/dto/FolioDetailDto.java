package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.FolioStatus;
import com.adith.os.HMS.billing.folio.FolioType;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FolioDetailDto(
        UUID id,
        String folioNumber,
        UUID bookingId,
        String guestName,
        String propertyCode,
        FolioStatus status,
        FolioType folioType,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal balanceDue,
        UUID routedToFolioId,
        String currency,
        OffsetDateTime createdAt,
        OffsetDateTime closedAt,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        String roomNumber,
        List<ChargeDto> charges,
        List<PaymentDto> payments,
        UUID travelAgentId,
        String travelAgentName
) {}