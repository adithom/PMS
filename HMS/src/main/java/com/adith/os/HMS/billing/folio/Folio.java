package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.bills.Bill;
import com.adith.os.HMS.billing.payment.Payment;
import com.adith.os.HMS.billing.payment.PaymentStatus;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "folio")
public class Folio {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotBlank
    @Column(name = "folio_number", unique = true, nullable = false)
    private String folioNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id", nullable = false)
    private Guest guest;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FolioStatus status = FolioStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(name = "folio_type", nullable = false)
    private FolioType folioType = FolioType.MASTER;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "paid_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "balance_due", precision = 10, scale = 2, nullable = false)
    private BigDecimal balanceDue = BigDecimal.ZERO;

    @Column(length = 3)
    private String currency = "INR";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @OneToMany(mappedBy = "folio", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FolioCharge> charges = new ArrayList<>();

    @OneToMany(mappedBy = "folio", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Payment> payments = new ArrayList<>();

    @OneToMany(mappedBy = "folio")
    private List<Bill> bills = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "routed_to_folio_id")
    private Folio routedToFolio;

    // Inverse side: child folios routed TO this folio
    @OneToMany(mappedBy = "routedToFolio", fetch = FetchType.LAZY)
    private List<Folio> routedFolios = new ArrayList<>();

    public Folio() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = OffsetDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // Business methods
    public void recalculateTotals() {
        // 1. Totals from charges physically on THIS folio
        BigDecimal selfSubtotal  = BigDecimal.ZERO;
        BigDecimal selfTax       = BigDecimal.ZERO;
        BigDecimal selfDiscount  = BigDecimal.ZERO;
        BigDecimal selfTotal     = BigDecimal.ZERO;

        if (charges != null) {
            List<FolioCharge> valid = charges.stream().filter(c -> !c.isVoided()).toList();
            selfSubtotal = valid.stream().map(FolioCharge::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            selfTax      = valid.stream().map(FolioCharge::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            selfDiscount = valid.stream().map(FolioCharge::getDiscountAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            selfTotal    = valid.stream().map(FolioCharge::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        // 2. Totals from child folios routed TO this folio
        BigDecimal routedSubtotal  = BigDecimal.ZERO;
        BigDecimal routedTax       = BigDecimal.ZERO;
        BigDecimal routedDiscount  = BigDecimal.ZERO;
        BigDecimal routedTotal     = BigDecimal.ZERO;
        BigDecimal routedPaid      = BigDecimal.ZERO;

        if (routedFolios != null && !routedFolios.isEmpty()) {
            for (Folio child : routedFolios) {
                if (child.getCharges() != null) {
                    List<FolioCharge> valid = child.getCharges().stream().filter(c -> !c.isVoided()).toList();
                    routedSubtotal = routedSubtotal.add(valid.stream().map(FolioCharge::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
                    routedTax      = routedTax.add(valid.stream().map(FolioCharge::getTaxAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
                    routedDiscount = routedDiscount.add(valid.stream().map(FolioCharge::getDiscountAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
                    routedTotal    = routedTotal.add(valid.stream().map(FolioCharge::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
                }

                if (child.getPayments() != null) {
                    routedPaid = routedPaid.add(child.getPayments().stream()
                            .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED)
                            .map(p -> p.getAmount().subtract(p.getRefundedAmount() != null ? p.getRefundedAmount() : BigDecimal.ZERO))
                            .reduce(BigDecimal.ZERO, BigDecimal::add));
                }
            }
        }

        // 3. Combined Charges
        this.subtotal       = selfSubtotal.add(routedSubtotal);
        this.taxAmount      = selfTax.add(routedTax);
        this.discountAmount = selfDiscount.add(routedDiscount);
        this.totalAmount    = selfTotal.add(routedTotal);

        // 4. Combined Payments
        BigDecimal selfPaid = payments != null
                ? payments.stream()
                .filter(p -> p.getPaymentStatus() == PaymentStatus.COMPLETED)
                .map(p -> p.getAmount().subtract(p.getRefundedAmount() != null ? p.getRefundedAmount() : BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                : BigDecimal.ZERO;

        this.paidAmount = selfPaid.add(routedPaid);

        // 5. Balance due
        if (this.isRouted()) {
            this.balanceDue = BigDecimal.ZERO;
        } else {
            this.balanceDue = this.totalAmount.subtract(this.paidAmount).max(BigDecimal.ZERO);
        }
    }

    public boolean isFullyPaid() {
        return balanceDue.compareTo(BigDecimal.ZERO) <= 0;
    }

    public void close() {
        if (status != FolioStatus.OPEN) {
            throw new IllegalStateException("Only open folios can be closed");
        }
        this.status = FolioStatus.CLOSED;
        this.closedAt = OffsetDateTime.now();
    }

    public void post() {
        if (status != FolioStatus.CLOSED) {
            throw new IllegalStateException("Only closed folios can be posted");
        }
        if (!isFullyPaid()) {
            throw new IllegalStateException("Cannot post folio with outstanding balance");
        }
        this.status = FolioStatus.POSTED;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFolioNumber() {
        return folioNumber;
    }

    public void setFolioNumber(String folioNumber) {
        this.folioNumber = folioNumber;
    }

    public Booking getBooking() {
        return booking;
    }

    public void setBooking(Booking booking) {
        this.booking = booking;
    }

    public Guest getGuest() {
        return guest;
    }

    public void setGuest(Guest guest) {
        this.guest = guest;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public FolioStatus getStatus() {
        return status;
    }

    public void setStatus(FolioStatus status) {
        this.status = status;
    }

    public FolioType getFolioType() {
        return folioType;
    }

    public void setFolioType(FolioType folioType) {
        this.folioType = folioType;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal taxAmount) {
        this.taxAmount = taxAmount;
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

    public BigDecimal getPaidAmount() {
        return paidAmount;
    }

    public void setPaidAmount(BigDecimal paidAmount) {
        this.paidAmount = paidAmount;
    }

    public BigDecimal getBalanceDue() {
        return balanceDue;
    }

    public void setBalanceDue(BigDecimal balanceDue) {
        this.balanceDue = balanceDue;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
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

    public OffsetDateTime getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(OffsetDateTime closedAt) {
        this.closedAt = closedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public List<FolioCharge> getCharges() {
        return charges;
    }

    public void setCharges(List<FolioCharge> charges) {
        this.charges = charges;
    }

    public List<Payment> getPayments() {
        return payments;
    }

    public void setPayments(List<Payment> payments) {
        this.payments = payments;
    }

    public java.util.List<com.adith.os.HMS.billing.bills.Bill> getBills() { return bills; }

    public void setBills(java.util.List<com.adith.os.HMS.billing.bills.Bill> bills) { this.bills = bills; }

    public Folio getRoutedToFolio() { return routedToFolio; }
    public void setRoutedToFolio(Folio routedToFolio) { this.routedToFolio = routedToFolio; }

    public boolean isRouted() { return routedToFolio != null; }

    public List<Folio> getRoutedFolios() { return routedFolios; }
    public void setRoutedFolios(List<Folio> routedFolios) { this.routedFolios = routedFolios; }
}