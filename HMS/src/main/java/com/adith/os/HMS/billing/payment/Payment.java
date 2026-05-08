package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.folio.ChargeCategory;
import com.adith.os.HMS.billing.folio.Folio;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payment")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folio_id")
    private Folio folio;

    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "payment_number", unique = true, nullable = false)
    private String paymentNumber;

    @NotNull
    @Column(name = "payment_date", nullable = false)
    private OffsetDateTime paymentDate;

    @NotNull
    @Positive(message = "Payment amount must be positive")
    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(length = 3, nullable = false)
    private String currency = "INR";

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false)
    private PaymentMethod paymentMethod;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.COMPLETED;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_category")
    private com.adith.os.HMS.billing.folio.ChargeCategory targetCategory;

    // Card/Digital payment details
    @Column(name = "transaction_id", length = 100)
    private String transactionId;

    @Column(name = "card_last_four", length = 4)
    private String cardLastFour;

    @Column(name = "card_type", length = 20)
    private String cardType;  // VISA, MASTERCARD, AMEX, etc.

    // Bank transfer details
    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    // UPI details
    @Column(name = "upi_id", length = 100)
    private String upiId;

    // Travel agent billing
    @Column(name = "travel_agent_id")
    private UUID travelAgentId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "processed_by")
    private String processedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    // For refunds
    @Column(name = "refunded_amount", precision = 10, scale = 2)
    private BigDecimal refundedAmount = BigDecimal.ZERO;

    @Column(name = "refunded_at")
    private OffsetDateTime refundedAt;

    @Column(name = "refund_reason", columnDefinition = "TEXT")
    private String refundReason;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (paymentDate == null) {
            paymentDate = OffsetDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = OffsetDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // Default constructor
    public Payment() {
    }

    // Constructor for creating a new payment
    public Payment(Folio folio, BigDecimal amount, PaymentMethod paymentMethod) {
        this.folio = folio;
        this.amount = amount;
        this.paymentMethod = paymentMethod;
        this.paymentStatus = PaymentStatus.PENDING;
        this.currency = folio.getCurrency();
    }

    // Business logic methods

    /**
     * Mark payment as completed
     */
    public void complete(String processedBy) {
        if (this.paymentStatus != PaymentStatus.PENDING) {
            throw new IllegalStateException("Only pending payments can be completed");
        }
        this.paymentStatus = PaymentStatus.COMPLETED;
        this.processedBy = processedBy;
        this.updatedAt = OffsetDateTime.now();
    }

    /**
     * Mark payment as failed
     */
    public void fail(String reason) {
        if (this.paymentStatus == PaymentStatus.COMPLETED) {
            throw new IllegalStateException("Cannot fail a completed payment");
        }
        this.paymentStatus = PaymentStatus.FAILED;
        this.notes = (this.notes != null ? this.notes + "\n" : "") + "Failed: " + reason;
        this.updatedAt = OffsetDateTime.now();
    }

    /**
     * Process a refund
     */
    public void refund(BigDecimal refundAmount, String reason) {
        if (this.paymentStatus != PaymentStatus.COMPLETED) {
            throw new IllegalStateException("Can only refund completed payments");
        }

        if (refundAmount == null || refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Refund amount must be positive");
        }

        BigDecimal totalRefunded = (this.refundedAmount != null ? this.refundedAmount : BigDecimal.ZERO)
                .add(refundAmount);

        if (totalRefunded.compareTo(this.amount) > 0) {
            throw new IllegalArgumentException("Refund amount exceeds payment amount");
        }

        this.refundedAmount = totalRefunded;
        this.refundReason = reason;
        this.refundedAt = OffsetDateTime.now();

        // If fully refunded, mark as refunded
        if (totalRefunded.compareTo(this.amount) == 0) {
            this.paymentStatus = PaymentStatus.REFUNDED;
        }

        this.updatedAt = OffsetDateTime.now();
    }

    /**
     * Check if payment is completed
     */
    public boolean isCompleted() {
        return this.paymentStatus == PaymentStatus.COMPLETED;
    }

    /**
     * Check if payment is refundable
     */
    public boolean isRefundable() {
        if (this.paymentStatus != PaymentStatus.COMPLETED) {
            return false;
        }
        BigDecimal totalRefunded = this.refundedAmount != null ? this.refundedAmount : BigDecimal.ZERO;
        return totalRefunded.compareTo(this.amount) < 0;
    }

    /**
     * Get remaining refundable amount
     */
    public BigDecimal getRefundableAmount() {
        if (!isCompleted()) {
            return BigDecimal.ZERO;
        }
        BigDecimal totalRefunded = this.refundedAmount != null ? this.refundedAmount : BigDecimal.ZERO;
        return this.amount.subtract(totalRefunded).max(BigDecimal.ZERO);
    }

    /**
     * Check if payment has been partially refunded
     */
    public boolean isPartiallyRefunded() {
        if (this.refundedAmount == null || this.refundedAmount.compareTo(BigDecimal.ZERO) == 0) {
            return false;
        }
        return this.refundedAmount.compareTo(this.amount) < 0;
    }

    /**
     * Check if payment is fully refunded
     */
    public boolean isFullyRefunded() {
        return this.paymentStatus == PaymentStatus.REFUNDED ||
                (this.refundedAmount != null && this.refundedAmount.compareTo(this.amount) == 0);
    }

    // Getters and Setters

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Folio getFolio() {
        return folio;
    }

    public void setFolio(Folio folio) {
        this.folio = folio;
    }

    public UUID getReservationId() {
        return reservationId;
    }

    public void setReservationId(UUID reservationId) {
        this.reservationId = reservationId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public void setBookingId(UUID bookingId) {
        this.bookingId = bookingId;
    }

    public String getPaymentNumber() {
        return paymentNumber;
    }

    public void setPaymentNumber(String paymentNumber) {
        this.paymentNumber = paymentNumber;
    }

    public OffsetDateTime getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(OffsetDateTime paymentDate) {
        this.paymentDate = paymentDate;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public String getCardLastFour() {
        return cardLastFour;
    }

    public void setCardLastFour(String cardLastFour) {
        this.cardLastFour = cardLastFour;
    }

    public String getCardType() {
        return cardType;
    }

    public void setCardType(String cardType) {
        this.cardType = cardType;
    }

    public String getBankName() {
        return bankName;
    }

    public void setBankName(String bankName) {
        this.bankName = bankName;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public String getUpiId() {
        return upiId;
    }

    public void setUpiId(String upiId) {
        this.upiId = upiId;
    }

    public UUID getTravelAgentId() {
        return travelAgentId;
    }

    public void setTravelAgentId(UUID travelAgentId) {
        this.travelAgentId = travelAgentId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getProcessedBy() {
        return processedBy;
    }

    public void setProcessedBy(String processedBy) {
        this.processedBy = processedBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public BigDecimal getRefundedAmount() {
        return refundedAmount;
    }

    public void setRefundedAmount(BigDecimal refundedAmount) {
        this.refundedAmount = refundedAmount;
    }

    public OffsetDateTime getRefundedAt() {
        return refundedAt;
    }

    public void setRefundedAt(OffsetDateTime refundedAt) {
        this.refundedAt = refundedAt;
    }

    public String getRefundReason() {
        return refundReason;
    }

    public void setRefundReason(String refundReason) {
        this.refundReason = refundReason;
    }

    public ChargeCategory getTargetCategory() {
        return targetCategory;
    }

    public void setTargetCategory(ChargeCategory targetCategory) {
        this.targetCategory = targetCategory;
    }

    @Override
    public String toString() {
        return "Payment{" +
                "id=" + id +
                ", paymentNumber='" + paymentNumber + '\'' +
                ", amount=" + amount +
                ", currency='" + currency + '\'' +
                ", paymentMethod=" + paymentMethod +
                ", paymentStatus=" + paymentStatus +
                ", refundedAmount=" + refundedAmount +
                ", createdAt=" + createdAt +
                '}';
    }
}
