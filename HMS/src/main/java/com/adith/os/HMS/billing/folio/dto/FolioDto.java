package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.FolioStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record FolioDto(
        UUID id,
        String folioNumber,
        UUID bookingId,
        String guestName,
        String propertyCode,
        FolioStatus status,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal balanceDue,
        String currency,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime closedAt,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        String roomNumber,
        UUID travelAgentId,
        String travelAgentName
) {}
