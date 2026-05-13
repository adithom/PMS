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
import com.adith.os.HMS.billing.payment.PaymentRepository;
import com.adith.os.HMS.billing.payment.PaymentStatus;
import com.adith.os.HMS.travelagent.TravelAgent;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;

@Component
public class BillMapper {

    private final PaymentRepository paymentRepository;

    public BillMapper(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber
    ) {
        return toBillDto(bill, folio, charges, guestGstNumber, null, BigDecimal.ZERO);
    }

    public BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber,
            String pdfDownloadUrl
    ) {
        return toBillDto(bill, folio, charges, guestGstNumber, pdfDownloadUrl, BigDecimal.ZERO);
    }

    /**
     * Phase B: caller supplies an `appliedMasterCredit` — the share of reservation-level
     * payments allocated to this bill at generation time (used when the reservation is in
     * SEPARATE billing mode and master payments need to be split equally across non-master
     * bookings).
     */
    public BillDto toBillDto(
            Bill bill,
            Folio folio,
            List<ChargeDto> charges,
            String guestGstNumber,
            String pdfDownloadUrl,
            BigDecimal appliedMasterCredit
    ) {

        // Include voided charges with zeroed amounts and [VOID] label
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

        // --- DYNAMIC PAYMENT & BALANCE CALCULATIONS ---
        // Payments are queried by bookingId (the folio's booking) — not via folio.payments.
        // Map legacy ChargeCategory targeting onto BillType for payment-to-bill matching.
        List<Payment> bookingPayments = booking != null
                ? paymentRepository.findByBookingId(booking.getId())
                : List.of();

        BigDecimal categoryAmountPaid = bookingPayments.stream()
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

        BigDecimal categoryRefunds = bookingPayments.stream()
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

        BigDecimal finalAmountPaid = categoryAmountPaid.subtract(categoryRefunds);

        // Apply the booking's share of reservation-level payments (master credit) on the
        // designated bill (typically ROOM_RENT, the first bill in a multi-bill batch).
        if (appliedMasterCredit != null && appliedMasterCredit.compareTo(BigDecimal.ZERO) > 0) {
            finalAmountPaid = finalAmountPaid.add(appliedMasterCredit);
        }

        BigDecimal grandTotal = totals.total();

        // .max(BigDecimal.ZERO) so overpayments show 0.00 instead of negative.
        BigDecimal balanceDue = grandTotal.subtract(finalAmountPaid).max(BigDecimal.ZERO);

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

                finalAmountPaid,
                balanceDue,

                folio.getNotes(),

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
    public BillBatchRowDto toBatchRowDto(List<Bill> batchBills) {
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
     */
    public BillDto toLedgerRowDto(Bill bill) {
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

                List.of(),

                bill.getSubtotal(),
                bill.getTaxAmount(),
                bill.getDiscountAmount(),
                bill.getTotalAmount(),

                BigDecimal.ZERO,
                BigDecimal.ZERO,

                folio.getNotes(),

                bill.isVoided(),
                bill.getVoidReason(),
                bill.getVoidedAt(),
                bill.getVoidedBy(),

                null,

                agent != null ? agent.getId() : null,
                agent != null ? agent.getName() : null
        );
    }
}
