package com.adith.os.HMS.billing.bills.dto;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GroupMultiBillDto(List<GroupBillSectionDto> bills) {

    public record GroupBillSectionDto(

            String invoiceNumber,
            LocalDate invoiceDate,
            String category,            // BillType.name() — e.g. "ROOM_RENT", "RESTAURANT"

            String propertyName,
            String propertyAddress,
            String propertyAddressLine2,
            String propertyPostalCode,
            String propertyPhone,
            String propertyGstNumber,
            String propertyStateName,
            String propertyStateCode,

            UUID parentBookingId,
            String groupReference,
            String organizerGuestName,
            String organizerGuestPhone,
            String organizerGuestEmail,
            String organizerGuestGstNumber,

            LocalDate checkIn,
            LocalDate checkOut,
            String currency,
            OffsetDateTime generatedAt,

            List<RoomChargeSection> rooms,

            BigDecimal groupSubtotal,
            BigDecimal groupTaxAmount,
            BigDecimal groupDiscountAmount,
            BigDecimal groupGrandTotal,
            BigDecimal groupAmountPaid,
            BigDecimal groupBalanceDue,

            boolean isVoided,
            String voidReason,
            LocalDateTime voidedAt,
            String voidedBy,

            String pdfDownloadUrl

    ) {
        public GroupBillSectionDto withPdfDownloadUrl(String url) {
            return new GroupBillSectionDto(
                    invoiceNumber, invoiceDate, category,
                    propertyName, propertyAddress, propertyAddressLine2, propertyPostalCode, propertyPhone, propertyGstNumber, propertyStateName, propertyStateCode,
                    parentBookingId, groupReference,
                    organizerGuestName, organizerGuestPhone, organizerGuestEmail, organizerGuestGstNumber,
                    checkIn, checkOut, currency, generatedAt,
                    rooms,
                    groupSubtotal, groupTaxAmount, groupDiscountAmount, groupGrandTotal,
                    groupAmountPaid, groupBalanceDue,
                    isVoided, voidReason, voidedAt, voidedBy,
                    url
            );
        }
    }

    public record RoomChargeSection(
            UUID childBookingId,
            UUID folioId,
            String folioNumber,
            String guestName,
            String roomNumber,
            String unitName,
            List<ChargeDto> charges,
            BigDecimal subtotal,
            BigDecimal taxAmount,
            BigDecimal discountAmount,
            BigDecimal totalAmount
    ) {}
}
