package com.adith.os.HMS.billing.folio;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.*;

class FolioChargeTest {

    private FolioCharge buildCharge(BigDecimal unitPrice, BigDecimal qty,
                                    BigDecimal taxRate, BigDecimal discountRate) {
        FolioCharge charge = new FolioCharge();
        charge.setChargeCode(ChargeCode.ROOM_RENT);
        charge.setDescription("Test charge");
        charge.setChargeDate(LocalDate.now());
        charge.setUnitPrice(unitPrice);
        charge.setQuantity(qty);
        charge.setTaxRate(taxRate != null ? taxRate : BigDecimal.ZERO);
        charge.setDiscountRate(discountRate != null ? discountRate : BigDecimal.ZERO);
        charge.calculateAmounts();
        return charge;
    }

    // --- calculateAmounts ---

    @Test
    void calculateAmounts_basicWithTax() {
        // 1000 * 1 = subtotal 1000, tax 12% = 120, total = 1120
        FolioCharge charge = buildCharge(new BigDecimal("1000"), BigDecimal.ONE,
                new BigDecimal("12"), null);

        assertThat(charge.getSubtotal()).isEqualByComparingTo("1000.00");
        assertThat(charge.getDiscountAmount()).isEqualByComparingTo("0.00");
        assertThat(charge.getTaxAmount()).isEqualByComparingTo("120.00");
        assertThat(charge.getTotalAmount()).isEqualByComparingTo("1120.00");
    }

    @Test
    void calculateAmounts_withQuantity() {
        // 500 * 3 = subtotal 1500, no tax, no discount
        FolioCharge charge = buildCharge(new BigDecimal("500"), new BigDecimal("3"),
                BigDecimal.ZERO, null);

        assertThat(charge.getSubtotal()).isEqualByComparingTo("1500.00");
        assertThat(charge.getTotalAmount()).isEqualByComparingTo("1500.00");
    }

    @Test
    void calculateAmounts_withDiscountThenTax() {
        // 1000 * 2 = subtotal 2000
        // discount 10% → 200, taxable = 1800
        // tax 18% on 1800 = 324, total = 2124
        FolioCharge charge = buildCharge(new BigDecimal("1000"), new BigDecimal("2"),
                new BigDecimal("18"), new BigDecimal("10"));

        assertThat(charge.getSubtotal()).isEqualByComparingTo("2000.00");
        assertThat(charge.getDiscountAmount()).isEqualByComparingTo("200.00");
        assertThat(charge.getTaxAmount()).isEqualByComparingTo("324.00");
        assertThat(charge.getTotalAmount()).isEqualByComparingTo("2124.00");
    }

    @Test
    void calculateAmounts_zeroTaxAndDiscount() {
        FolioCharge charge = buildCharge(new BigDecimal("500"), BigDecimal.ONE,
                BigDecimal.ZERO, null);

        assertThat(charge.getSubtotal()).isEqualByComparingTo("500.00");
        assertThat(charge.getTaxAmount()).isEqualByComparingTo("0.00");
        assertThat(charge.getDiscountAmount()).isEqualByComparingTo("0.00");
        assertThat(charge.getTotalAmount()).isEqualByComparingTo("500.00");
    }

    @Test
    void calculateAmounts_defaultTaxRateFromChargeCode() {
        // RESTAURANT has 5% default tax
        FolioCharge charge = new FolioCharge();
        charge.setChargeCode(ChargeCode.RESTAURANT);
        charge.setDescription("Dinner");
        charge.setChargeDate(LocalDate.now());
        charge.setUnitPrice(new BigDecimal("200"));
        charge.setQuantity(BigDecimal.ONE);
        charge.setTaxRate(ChargeCode.RESTAURANT.getDefaultTaxRate());
        charge.setDiscountRate(BigDecimal.ZERO);
        charge.calculateAmounts();

        assertThat(charge.getTaxAmount()).isEqualByComparingTo("10.00"); // 5% of 200
        assertThat(charge.getTotalAmount()).isEqualByComparingTo("210.00");
    }

    // --- voidCharge ---

    @Test
    void voidCharge_setsAllVoidFields() {
        FolioCharge charge = buildCharge(new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.ZERO, null);
        assertThat(charge.isVoided()).isFalse();

        charge.voidCharge("manager", "Entered in error");

        assertThat(charge.isVoided()).isTrue();
        assertThat(charge.getVoidedBy()).isEqualTo("manager");
        assertThat(charge.getVoidReason()).isEqualTo("Entered in error");
        assertThat(charge.getVoidedAt()).isNotNull();
    }

    @Test
    void voidCharge_alreadyVoided_throwsIllegalState() {
        FolioCharge charge = buildCharge(new BigDecimal("100"), BigDecimal.ONE,
                BigDecimal.ZERO, null);
        charge.voidCharge("user1", "First void");

        assertThatThrownBy(() -> charge.voidCharge("user2", "Second void"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already voided");
    }
}
