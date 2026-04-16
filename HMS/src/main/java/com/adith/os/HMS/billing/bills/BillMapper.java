package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.BillDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.billing.payment.Payment;
import com.adith.os.HMS.billing.payment.PaymentStatus;
import com.adith.os.HMS.travelagent.TravelAgent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
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
        TravelAgent agent = (booking != null) ? booking.getTravelAgent() : null;

        LocalDate invoiceDate = bill.getBillDate() != null
                ? bill.getBillDate()
                : LocalDate.now(ZoneId.of("Asia/Kolkata"));

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
                property.getId(),
                bill.getCategory().name(),

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

                pdfDownloadUrl,

                agent != null ? agent.getId() : null,
                agent != null ? agent.getName() : null
        );
    }

    /**
     * Lightweight mapper for the bill ledger list view.
     * Uses stored totals from the Bill entity (no charge line items loaded).
     * Requires Bill.folio, folio.property, folio.guest, folio.booking to be JOIN FETCHed.
     */
    public static BillDto toLedgerRowDto(Bill bill) {
        Folio folio = bill.getFolio();
        Guest guest = folio.getGuest();
        Property property = folio.getProperty();
        Booking booking = folio.getBooking();
        TravelAgent agent = (booking != null) ? booking.getTravelAgent() : null;

        LocalDate invoiceDate = bill.getBillDate() != null
                ? bill.getBillDate()
                : LocalDate.now(ZoneId.of("Asia/Kolkata"));

        String roomNumber = (booking != null && booking.getRoom() != null)
                ? booking.getRoom().getNumber() : "N/A";
        LocalDate checkIn  = booking != null ? booking.getCheckIn()  : null;
        LocalDate checkOut = booking != null ? booking.getCheckOut() : null;

        return new BillDto(
                bill.getId(),
                folio.getId(),
                bill.getGenerationBatchId(),
                property.getId(),
                bill.getCategory().name(),

                property.getName(),
                property.getAddress(),
                property.getGstNumber(),

                bill.getInvoiceNumber(),
                invoiceDate,
                folio.getFolioNumber(),

                guest.getFullName(),
                guest.getPhone(),
                guest.getEmail(),
                bill.getGuestGstNumber() != null ? bill.getGuestGstNumber() : "",

                roomNumber,
                checkIn,
                checkOut,

                List.of(),              // no line items for ledger row

                bill.getSubtotal(),
                bill.getTaxAmount(),
                bill.getDiscountAmount(),
                bill.getTotalAmount(),  // grandTotal

                BigDecimal.ZERO,        // amountPaid — not needed for ledger
                BigDecimal.ZERO,        // balanceDue — not needed for ledger

                folio.getNotes(),

                bill.isVoided(),
                bill.getVoidReason(),
                bill.getVoidedAt(),
                bill.getVoidedBy(),

                null,                   // pdfDownloadUrl — not pre-signed for list

                agent != null ? agent.getId() : null,
                agent != null ? agent.getName() : null
        );
    }
}