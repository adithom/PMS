package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.bills.Bill;
import com.adith.os.HMS.billing.bills.GroupBill;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "folio_charge")
public class FolioCharge {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folio_id", nullable = false)
    private Folio folio;

    @NotNull
    @Column(name = "charge_date", nullable = false)
    private LocalDate chargeDate;

    @Column(name = "posting_date", nullable = false)
    private OffsetDateTime postingDate;

    @NotNull
    @Column(name = "charge_code", nullable = false)
    ChargeCode chargeCode;

    @NotBlank
    @Column(nullable = false, length = 500)
    private String description;

    @Column(name = "reference_type")
    private String referenceType;

    @Column(name = "reference_id")
    private UUID referenceId;

    @NotNull
    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal quantity = BigDecimal.ONE;

    @NotNull
    @Column(name = "unit_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal subtotal;

    @Column(name = "tax_rate", precision = 5, scale = 2, nullable = false)
    private BigDecimal taxRate = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "discount_rate", precision = 5, scale = 2, nullable = false)
    private BigDecimal discountRate = BigDecimal.ZERO;

    @Column(name = "discount_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "is_voided", nullable = false)
    private boolean isVoided = false;

    @Column(name = "voided_at")
    private OffsetDateTime voidedAt;

    @Column(name = "voided_by")
    private String voidedBy;

    @Column(name = "void_reason", columnDefinition = "TEXT")
    private String voidReason;

    @Column(name = "posted_by")
    private String postedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id")
    private Bill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_bill_id")
    private GroupBill groupBill;

    public FolioCharge() {
    }

    @PrePersist
    protected void onCreate() {
        if (postingDate == null) {
            postingDate = OffsetDateTime.now();
        }
        calculateAmounts();
    }

    @PreUpdate
    protected void onUpdate() {
        calculateAmounts();
    }

    public void calculateAmounts() {

        BigDecimal safeQuantity =
                this.quantity != null ? this.quantity : BigDecimal.ONE;

        BigDecimal safeUnitPrice =
                this.unitPrice != null ? this.unitPrice : BigDecimal.ZERO;

        BigDecimal safeTaxRate =
                this.taxRate != null ? this.taxRate : BigDecimal.ZERO;

        BigDecimal safeDiscountRate =
                this.discountRate != null ? this.discountRate : BigDecimal.ZERO;

        // Subtotal = quantity * unit price
        this.subtotal = safeUnitPrice
                .multiply(safeQuantity)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // Discount calculation
        this.discountAmount = BigDecimal.ZERO;

        if (safeDiscountRate.compareTo(BigDecimal.ZERO) > 0) {
            this.discountAmount = this.subtotal
                    .multiply(safeDiscountRate)
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }

        BigDecimal subtotalAfterDiscount =
                this.subtotal.subtract(this.discountAmount);

        // Tax calculation
        this.taxAmount = BigDecimal.ZERO;

        if (safeTaxRate.compareTo(BigDecimal.ZERO) > 0) {
            this.taxAmount = subtotalAfterDiscount
                    .multiply(safeTaxRate)
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        }

        // Total = subtotal - discount + tax
        this.totalAmount = subtotalAfterDiscount
                .add(this.taxAmount)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    public void voidCharge(String voidedBy, String reason) {
        if (isVoided) {
            throw new IllegalStateException("Charge is already voided");
        }
        this.isVoided = true;
        this.voidedAt = OffsetDateTime.now();
        this.voidedBy = voidedBy;
        this.voidReason = reason;
    }

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

    public LocalDate getChargeDate() {
        return chargeDate;
    }

    public void setChargeDate(LocalDate chargeDate) {
        this.chargeDate = chargeDate;
    }

    public OffsetDateTime getPostingDate() {
        return postingDate;
    }

    public void setPostingDate(OffsetDateTime postingDate) {
        this.postingDate = postingDate;
    }

    public ChargeCode getChargeCode() {
        return chargeCode;
    }

    public void setChargeCode(ChargeCode chargeCode) {
        this.chargeCode = chargeCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getReferenceType() {
        return referenceType;
    }

    public void setReferenceType(String referenceType) {
        this.referenceType = referenceType;
    }

    public UUID getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(UUID referenceId) {
        this.referenceId = referenceId;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public BigDecimal getTaxRate() {
        return taxRate;
    }

    public void setTaxRate(BigDecimal taxRate) {
        this.taxRate = taxRate;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getDiscountRate() {
        return discountRate;
    }

    public void setDiscountRate(BigDecimal discountRate) {
        this.discountRate = discountRate;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(BigDecimal discountAmount) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public boolean isVoided() {
        return isVoided;
    }

    public void setVoided(boolean voided) {
        isVoided = voided;
    }

    public OffsetDateTime getVoidedAt() {
        return voidedAt;
    }

    public void setVoidedAt(OffsetDateTime voidedAt) {
        this.voidedAt = voidedAt;
    }

    public String getVoidedBy() {
        return voidedBy;
    }

    public void setVoidedBy(String voidedBy) {
        this.voidedBy = voidedBy;
    }

    public String getVoidReason() {
        return voidReason;
    }

    public void setVoidReason(String voidReason) {
        this.voidReason = voidReason;
    }

    public String getPostedBy() {
        return postedBy;
    }

    public void setPostedBy(String postedBy) {
        this.postedBy = postedBy;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Bill getBill() { return bill; }

    public void setBill(Bill bill) { this.bill = bill; }

    public GroupBill getGroupBill() { return groupBill; }
    public void setGroupBill(GroupBill groupBill) { this.groupBill = groupBill; }
}
