package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.BillDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.billing.payment.Payment;
import com.adith.os.HMS.billing.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class BillMapper {

    public static BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber
    ) {
        return toBillDto(bill, folio, charges, guestGstNumber, null);
    }

    public static BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber,
            String pdfDownloadUrl
    ) {

        // 1. Filter out voided charges
        List<ChargeDto> validCharges = charges.stream()
                .filter(c -> !c.isVoided())
                .toList();

        var totals = BillTotalCalculator.calculate(validCharges);

        // 2. Extract relationships safely
        Guest guest = folio.getGuest();
        Property property = folio.getProperty();
        Booking booking = folio.getBooking();

        LocalDate invoiceDate = folio.getClosedAt() != null
                ? folio.getClosedAt().toLocalDate()
                : folio.getCreatedAt().toLocalDate();

        String roomNumber = (booking != null && booking.getRoom() != null)
                ? booking.getRoom().getNumber()
                : "N/A";
        LocalDate checkIn = booking != null ? booking.getCheckIn() : null;
        LocalDate checkOut = booking != null ? booking.getCheckOut() : null;

        String safeGstNumber = (guestGstNumber != null) ? guestGstNumber : "";

        // --- 3. DYNAMIC PAYMENT & BALANCE CALCULATIONS ---
        // Sum up all payments that are either general folio deposits (null) OR specifically targeted to this bill's category
        BigDecimal categoryAmountPaid = folio.getPayments().stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED || p.getPaymentStatus() == PaymentStatus.REFUNDED)
                .filter(p -> p.getTargetCategory() == null || p.getTargetCategory() == bill.getCategory())
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Subtract any refunds that happened on those specific payments
        BigDecimal categoryRefunds = folio.getPayments().stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED || p.getPaymentStatus() == PaymentStatus.REFUNDED)
                .filter(p -> p.getTargetCategory() == null || p.getTargetCategory() == bill.getCategory())
                .map(p -> p.getRefundedAmount() != null ? p.getRefundedAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Calculate the absolute final paid amount and balance due
        BigDecimal finalAmountPaid = categoryAmountPaid.subtract(categoryRefunds);
        BigDecimal grandTotal = totals.total();

        // Use .max(BigDecimal.ZERO) so if the guest overpaid, the balance due just shows 0.00 instead of a negative number
        BigDecimal balanceDue = grandTotal.subtract(finalAmountPaid).max(BigDecimal.ZERO);

        // 4. Map it all to the DTO
        return new BillDto(
                bill.getId(),
                folio.getId(),
                bill.getGenerationBatchId(),

                property.getName(),
                property.getAddress(),
                property.getGstNumber(),

                bill.getInvoiceNumber(),
                invoiceDate,
                folio.getFolioNumber(),

                guest.getFullName(),
                guest.getPhone(),
                guest.getEmail(),
                safeGstNumber,

                roomNumber,
                checkIn,
                checkOut,

                validCharges,

                totals.subtotal(),
                totals.tax(),
                totals.discount(),
                grandTotal,

                finalAmountPaid, // Amount paid mapped accurately!
                balanceDue,      // Balance due mapped accurately!

                folio.getNotes(),

                // Map Void Data
                bill.isVoided(),
                bill.getVoidReason(),
                bill.getVoidedAt(),
                bill.getVoidedBy(),

                pdfDownloadUrl
        );
    }
}