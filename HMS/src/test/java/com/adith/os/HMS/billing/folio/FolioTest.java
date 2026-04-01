package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.payment.Payment;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.billing.payment.PaymentStatus;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class FolioTest {

    // --- Fixture builders ---

    private Property buildProperty() {
        Property p = new Property();
        p.setId(UUID.randomUUID());
        p.setCode("TST");
        p.setName("Test Hotel");
        return p;
    }

    private Guest buildGuest() {
        Guest g = new Guest();
        g.setId(UUID.randomUUID());
        g.setFirstName("John");
        g.setLastName("Doe");
        return g;
    }

    private Folio buildOpenFolio(Property property, Guest guest) {
        Folio folio = new Folio();
        folio.setId(UUID.randomUUID());
        folio.setFolioNumber("FO-TST-20260401-00001");
        folio.setProperty(property);
        folio.setGuest(guest);
        folio.setStatus(FolioStatus.OPEN);
        folio.setFolioType(FolioType.MASTER);
        return folio;
    }

    private FolioCharge buildCharge(Folio folio, BigDecimal unitPrice, BigDecimal taxRate) {
        FolioCharge charge = new FolioCharge();
        charge.setId(UUID.randomUUID());
        charge.setFolio(folio);
        charge.setChargeCode(ChargeCode.ROOM_RENT);
        charge.setDescription("Room charge");
        charge.setUnitPrice(unitPrice);
        charge.setQuantity(BigDecimal.ONE);
        charge.setTaxRate(taxRate != null ? taxRate : BigDecimal.ZERO);
        charge.setDiscountRate(BigDecimal.ZERO);
        charge.calculateAmounts();
        return charge;
    }

    private Payment buildCompletedPayment(Folio folio, BigDecimal amount) {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setFolio(folio);
        payment.setAmount(amount);
        payment.setPaymentMethod(PaymentMethod.CASH);
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);
        return payment;
    }

    // --- recalculateTotals ---

    @Test
    void recalculateTotals_noChargesNoPayments_allZero() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());

        folio.recalculateTotals();

        assertThat(folio.getTotalAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(folio.getPaidAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(folio.getBalanceDue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void recalculateTotals_singleCharge_updatesSubtotalAndBalance() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        // 1000 * 12% tax = 1120 total
        folio.getCharges().add(buildCharge(folio, new BigDecimal("1000"), new BigDecimal("12")));

        folio.recalculateTotals();

        assertThat(folio.getSubtotal()).isEqualByComparingTo("1000.00");
        assertThat(folio.getTaxAmount()).isEqualByComparingTo("120.00");
        assertThat(folio.getTotalAmount()).isEqualByComparingTo("1120.00");
        assertThat(folio.getBalanceDue()).isEqualByComparingTo("1120.00");
    }

    @Test
    void recalculateTotals_voidedChargeExcluded() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());

        FolioCharge active = buildCharge(folio, new BigDecimal("500"), BigDecimal.ZERO);
        FolioCharge voided = buildCharge(folio, new BigDecimal("300"), BigDecimal.ZERO);
        voided.voidCharge("user", "mistake");

        folio.getCharges().add(active);
        folio.getCharges().add(voided);

        folio.recalculateTotals();

        assertThat(folio.getTotalAmount()).isEqualByComparingTo("500.00");
    }

    @Test
    void recalculateTotals_paymentReducesBalanceDue() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("1000"), BigDecimal.ZERO));
        folio.getPayments().add(buildCompletedPayment(folio, new BigDecimal("600")));

        folio.recalculateTotals();

        assertThat(folio.getPaidAmount()).isEqualByComparingTo("600.00");
        assertThat(folio.getBalanceDue()).isEqualByComparingTo("400.00");
    }

    @Test
    void recalculateTotals_fullyPaid_balanceDueIsZeroNotNegative() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("500"), BigDecimal.ZERO));
        folio.getPayments().add(buildCompletedPayment(folio, new BigDecimal("600"))); // overpaid

        folio.recalculateTotals();

        // Balance due should not go negative
        assertThat(folio.getBalanceDue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void recalculateTotals_routedChildChargesAggregatedInParent() {
        Property prop = buildProperty();
        Guest guest = buildGuest();

        Folio parent = buildOpenFolio(prop, guest);
        parent.getCharges().add(buildCharge(parent, new BigDecimal("1000"), BigDecimal.ZERO));

        Folio child = buildOpenFolio(prop, guest);
        child.setRoutedToFolio(parent);
        child.getCharges().add(buildCharge(child, new BigDecimal("400"), BigDecimal.ZERO));
        parent.setRoutedFolios(new ArrayList<>(List.of(child)));

        parent.recalculateTotals();

        assertThat(parent.getTotalAmount()).isEqualByComparingTo("1400.00");
        assertThat(parent.getBalanceDue()).isEqualByComparingTo("1400.00");
    }

    @Test
    void recalculateTotals_routedFolioAlwaysHasZeroBalanceDue() {
        Property prop = buildProperty();
        Guest guest = buildGuest();

        Folio parent = buildOpenFolio(prop, guest);
        Folio child = buildOpenFolio(prop, guest);
        child.setRoutedToFolio(parent);
        child.getCharges().add(buildCharge(child, new BigDecimal("500"), BigDecimal.ZERO));

        child.recalculateTotals();

        // Child's balance is always 0 — it's the parent's responsibility
        assertThat(child.getBalanceDue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(child.getTotalAmount()).isEqualByComparingTo("500.00");
    }

    // --- close ---

    @Test
    void close_openFolio_setsStatusClosedAndTimestamp() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());

        folio.close();

        assertThat(folio.getStatus()).isEqualTo(FolioStatus.CLOSED);
        assertThat(folio.getClosedAt()).isNotNull();
    }

    @Test
    void close_alreadyClosed_throwsIllegalState() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.close();

        assertThatThrownBy(folio::close)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only open folios can be closed");
    }

    // --- post ---

    @Test
    void post_closedAndFullyPaid_setsStatusPosted() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("500"), BigDecimal.ZERO));
        folio.getPayments().add(buildCompletedPayment(folio, new BigDecimal("500")));
        folio.recalculateTotals();
        folio.close();

        folio.post();

        assertThat(folio.getStatus()).isEqualTo(FolioStatus.POSTED);
    }

    @Test
    void post_openFolio_throwsIllegalState() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());

        assertThatThrownBy(folio::post)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only closed folios can be posted");
    }

    @Test
    void post_closedButUnpaid_throwsIllegalState() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("1000"), BigDecimal.ZERO));
        folio.recalculateTotals();
        folio.close();

        assertThatThrownBy(folio::post)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("outstanding balance");
    }

    // --- isRouted / isFullyPaid ---

    @Test
    void isRouted_withParentFolio_returnsTrue() {
        Folio parent = new Folio();
        Folio child = new Folio();
        child.setRoutedToFolio(parent);

        assertThat(child.isRouted()).isTrue();
    }

    @Test
    void isRouted_noParent_returnsFalse() {
        assertThat(new Folio().isRouted()).isFalse();
    }

    @Test
    void isFullyPaid_noBalance_returnsTrue() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("300"), BigDecimal.ZERO));
        folio.getPayments().add(buildCompletedPayment(folio, new BigDecimal("300")));
        folio.recalculateTotals();

        assertThat(folio.isFullyPaid()).isTrue();
    }

    @Test
    void isFullyPaid_withOutstandingBalance_returnsFalse() {
        Folio folio = buildOpenFolio(buildProperty(), buildGuest());
        folio.getCharges().add(buildCharge(folio, new BigDecimal("500"), BigDecimal.ZERO));
        folio.recalculateTotals();

        assertThat(folio.isFullyPaid()).isFalse();
    }
}
