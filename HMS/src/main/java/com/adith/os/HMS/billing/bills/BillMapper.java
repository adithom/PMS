package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.ChargeCategory;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.BillBatchRowDto;
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
import java.util.Comparator;
import java.util.List;

public class BillMapper {

    public static BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber
    ) {
        return toBillDto(bill, folio, charges, guestGstNumber, null, BigDecimal.ZERO);
    }

    public static BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber,
            String pdfDownloadUrl
    ) {
        return toBillDto(bill, folio, charges, guestGstNumber, pdfDownloadUrl, BigDecimal.ZERO);
    }

    /**
     * Phase B overload: caller supplies an `appliedMasterCredit` — the share of reservation-level
     * payments allocated to this bill at generation time (used when the reservation is in SEPARATE
     * billing mode and master payments need to be split equally across non-master bookings).
     */
    public static BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber,
            String pdfDownloadUrl,
            BigDecimal appliedMasterCredit
    ) {

        // 1. Include voided charges with zeroed amounts and [VOID] label
        List<ChargeDto> validCharges = charges.stream()
                .map(c -> c.isVoided()
                        ? new ChargeDto(c.id(), c.chargeDate(), c.postingDate(), c.chargeCode(),
                                c.description() + " [VOID]", c.quantity(), c.unitPrice(),
                                BigDecimal.ZERO, c.taxRate(), BigDecimal.ZERO,
                                BigDecimal.ZERO, BigDecimal.ZERO,
                                true, c.voidReason(), c.notes())
                        : c)
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
        // Map legacy ChargeCategory routing onto the new BillType:
        //   null target      → applies to every bill
        //   ROOM_RENT/MEAL_PLAN → applies only to the ROOM_RENT bill
        //   ANCILLARY        → applies to all non-room-rent bills
        BigDecimal categoryAmountPaid = folio.getPayments().stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED || p.getPaymentStatus() == PaymentStatus.REFUNDED)
                .filter(p -> {
                    ChargeCategory t = p.getTargetCategory();
                    if (t == null) return true;
                    if (bill.getBillType() == BillType.ROOM_RENT)
                        return t == ChargeCategory.ROOM_RENT || t == ChargeCategory.MEAL_PLAN;
                    return t == ChargeCategory.ANCILLARY;
                })
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal categoryRefunds = folio.getPayments().stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED || p.getPaymentStatus() == PaymentStatus.REFUNDED)
                .filter(p -> {
                    ChargeCategory t = p.getTargetCategory();
                    if (t == null) return true;
                    if (bill.getBillType() == BillType.ROOM_RENT)
                        return t == ChargeCategory.ROOM_RENT || t == ChargeCategory.MEAL_PLAN;
                    return t == ChargeCategory.ANCILLARY;
                })
                .map(p -> p.getRefundedAmount() != null ? p.getRefundedAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Calculate the absolute final paid amount and balance due
        BigDecimal finalAmountPaid = categoryAmountPaid.subtract(categoryRefunds);

        // Phase B: apply the booking's share of reservation-level payments (master credit) — only on the bill
        // designated by the caller (typically ROOM_RENT, the first generated bill in a multi-bill batch).
        if (appliedMasterCredit != null && appliedMasterCredit.compareTo(BigDecimal.ZERO) > 0) {
            finalAmountPaid = finalAmountPaid.add(appliedMasterCredit);
        }

        BigDecimal grandTotal = totals.total();

        // Use .max(BigDecimal.ZERO) so if the guest overpaid, the balance due just shows 0.00 instead of a negative number
        BigDecimal balanceDue = grandTotal.subtract(finalAmountPaid).max(BigDecimal.ZERO);

        // 4. Map it all to the DTO
        return new BillDto(
                bill.getId(),
                folio.getId(),
                bill.getGenerationBatchId(),
                property.getId(),
                bill.getBillType().name(),

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
     * Groups a batch of bills (same generationBatchId) into a single ledger row.
     * The "main" invoice is the one whose number sorts first (base number, no suffix letter).
     */
    public static BillBatchRowDto toBatchRowDto(List<Bill> batchBills) {
        Bill main = batchBills.stream()
                .min(Comparator.comparing(Bill::getInvoiceNumber))
                .orElseThrow();

        Folio folio = main.getFolio();
        Guest guest = folio.getGuest();
        Property property = folio.getProperty();

        LocalDate billDate = main.getBillDate() != null
                ? main.getBillDate()
                : LocalDate.now(ZoneId.of("Asia/Kolkata"));

        BigDecimal grandTotal = batchBills.stream()
                .filter(b -> !b.isVoided())
                .map(Bill::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean allVoided = batchBills.stream().allMatch(Bill::isVoided);

        List<java.util.UUID> billIds = batchBills.stream().map(Bill::getId).toList();

        return new BillBatchRowDto(
                main.getGenerationBatchId() != null ? main.getGenerationBatchId() : main.getId(),
                main.getInvoiceNumber(),
                billDate,
                property.getName(),
                guest.getFullName(),
                grandTotal,
                allVoided,
                billIds
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
                bill.getBillType().name(),

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