package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.FolioStatus;
import com.adith.os.HMS.billing.folio.FolioType;

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
        FolioType folioType,
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
        UUID routedToFolioId,
        LocalDate checkInDate,
        LocalDate checkOutDate,
        String roomNumber,
        UUID travelAgentId,
        String travelAgentName
) {}
