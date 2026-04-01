package com.adith.os.HMS.billing.payment;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

class PaymentTest {

    private Payment buildCompleted(BigDecimal amount) {
        Payment p = new Payment();
        p.setAmount(amount);
        p.setPaymentMethod(PaymentMethod.CASH);
        p.setPaymentStatus(PaymentStatus.COMPLETED);
        p.setRefundedAmount(BigDecimal.ZERO);
        return p;
    }

    // --- refund ---

    @Test
    void refund_fullAmount_marksAsRefunded() {
        Payment p = buildCompleted(new BigDecimal("500"));

        p.refund(new BigDecimal("500"), "changed mind");

        assertThat(p.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(p.getRefundedAmount()).isEqualByComparingTo("500");
        assertThat(p.getRefundReason()).isEqualTo("changed mind");
        assertThat(p.getRefundedAt()).isNotNull();
    }

    @Test
    void refund_partialAmount_staysCompleted() {
        Payment p = buildCompleted(new BigDecimal("500"));

        p.refund(new BigDecimal("200"), "partial");

        assertThat(p.getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(p.getRefundedAmount()).isEqualByComparingTo("200");
    }

    @Test
    void refund_cumulativePartialRefunds_addUp() {
        Payment p = buildCompleted(new BigDecimal("500"));
        p.refund(new BigDecimal("200"), "first");
        p.refund(new BigDecimal("300"), "second");

        assertThat(p.getRefundedAmount()).isEqualByComparingTo("500");
        assertThat(p.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    void refund_exceedsOriginalAmount_throwsIllegalArgument() {
        Payment p = buildCompleted(new BigDecimal("500"));

        assertThatThrownBy(() -> p.refund(new BigDecimal("600"), "overpayment"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds");
    }

    @Test
    void refund_zeroAmount_throwsIllegalArgument() {
        Payment p = buildCompleted(new BigDecimal("500"));

        assertThatThrownBy(() -> p.refund(BigDecimal.ZERO, "zero"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positive");
    }

    @Test
    void refund_notCompleted_throwsIllegalState() {
        Payment p = new Payment();
        p.setAmount(new BigDecimal("100"));
        p.setPaymentStatus(PaymentStatus.PENDING);
        p.setRefundedAmount(BigDecimal.ZERO);

        assertThatThrownBy(() -> p.refund(new BigDecimal("50"), "reason"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("completed");
    }

    // --- isRefundable / getRefundableAmount ---

    @Test
    void isRefundable_completedNotRefunded_returnsTrue() {
        Payment p = buildCompleted(new BigDecimal("500"));
        assertThat(p.isRefundable()).isTrue();
    }

    @Test
    void isRefundable_notCompleted_returnsFalse() {
        Payment p = new Payment();
        p.setPaymentStatus(PaymentStatus.PENDING);
        p.setAmount(new BigDecimal("500"));
        p.setRefundedAmount(BigDecimal.ZERO);

        assertThat(p.isRefundable()).isFalse();
    }

    @Test
    void isRefundable_fullyRefunded_returnsFalse() {
        Payment p = buildCompleted(new BigDecimal("500"));
        p.refund(new BigDecimal("500"), "full");

        assertThat(p.isRefundable()).isFalse();
    }

    @Test
    void getRefundableAmount_afterPartialRefund_returnsRemainder() {
        Payment p = buildCompleted(new BigDecimal("500"));
        p.refund(new BigDecimal("200"), "partial");

        assertThat(p.getRefundableAmount()).isEqualByComparingTo("300");
    }

    @Test
    void getRefundableAmount_notCompleted_returnsZero() {
        Payment p = new Payment();
        p.setPaymentStatus(PaymentStatus.FAILED);
        p.setAmount(new BigDecimal("500"));
        p.setRefundedAmount(BigDecimal.ZERO);

        assertThat(p.getRefundableAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // --- complete / fail ---

    @Test
    void complete_pendingPayment_setsCompleted() {
        Payment p = new Payment();
        p.setPaymentStatus(PaymentStatus.PENDING);
        p.setRefundedAmount(BigDecimal.ZERO);

        p.complete("frontdesk");

        assertThat(p.getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(p.getProcessedBy()).isEqualTo("frontdesk");
    }

    @Test
    void complete_alreadyCompleted_throwsIllegalState() {
        Payment p = buildCompleted(new BigDecimal("100"));

        assertThatThrownBy(() -> p.complete("user"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("pending");
    }

    @Test
    void fail_pendingPayment_setsFailed() {
        Payment p = new Payment();
        p.setPaymentStatus(PaymentStatus.PENDING);
        p.setRefundedAmount(BigDecimal.ZERO);

        p.fail("declined");

        assertThat(p.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
    }
}
