package com.adith.os.HMS.billing.bills.dto;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record BillDto(
        // Database Identifiers
        UUID id,
        UUID folioId,
        UUID generationBatchId,
        UUID propertyId,
        String category,

        // Hotel
        String PropertyName,
        String PropertyAddress,
        String gstNumber,

        // Invoice Info
        String invoiceNumber,
        LocalDate invoiceDate,
        String folioNumber,

        // Guest
        String guestName,
        String guestPhone,
        String guestEmail,
        String guestGstNumber,

        //stay
        String roomNumber,
        LocalDate checkIn,
        LocalDate checkOut,

        // Line Items
        List<ChargeDto> charges,

        // Totals (precomputed)
        BigDecimal subtotal,
        BigDecimal totalTax,
        BigDecimal totalDiscount,
        BigDecimal grandTotal,
        BigDecimal amountPaid,
        BigDecimal balanceDue,

        // Notes
        String notes,

        // Void Info
        boolean isVoided,
        String voidReason,
        LocalDateTime voidedAt,
        String voidedBy,

        // Pre-signed R2 download URL — populated only at bill generation time, null otherwise
        String pdfDownloadUrl
) {
}
