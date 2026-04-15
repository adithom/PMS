package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.ChargeCategory;
import com.adith.os.HMS.billing.folio.Folio;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Entity
@Table(name = "bill")
public class Bill {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    // e.g., 202310250001
    @Column(name = "invoice_number", unique = true, nullable = false, length = 20)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folio_id", nullable = false)
    private Folio folio;

    // Identifies if this bill is for ROOM_RENT or ANCILLARY
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChargeCategory category;

    @Column(name = "guest_gst_number", length = 50)
    private String guestGstNumber;

    @Column(precision = 10, scale = 2, nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 10, scale = 2, nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "bill_date", nullable = false)
    private LocalDate billDate;

    @Column(name = "generated_at", nullable = false)
    private OffsetDateTime generatedAt;

    // Stores the path or URL to the generated PDF Box file
    @Column(name = "pdf_file_path")
    private String pdfFilePath;

    // --- BATCH LINKING ---
    @Column(name = "generation_batch_id")
    private UUID generationBatchId;

    // --- VOIDING FIELDS ---
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean isVoided = false;

    @Column(name = "void_reason")
    private String voidReason;

    @Column(name = "voided_at")
    private java.time.LocalDateTime voidedAt;

    @Column(name = "voided_by")
    private String voidedBy;

    public Bill() {
    }

    @PrePersist
    protected void onCreate() {
        if (generatedAt == null) {
            generatedAt = OffsetDateTime.now();
        }
        if (billDate == null) {
            billDate = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        }
    }

    // --- Getters and Setters ---

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public Folio getFolio() { return folio; }
    public void setFolio(Folio folio) { this.folio = folio; }

    public ChargeCategory getCategory() { return category; }
    public void setCategory(ChargeCategory category) { this.category = category; }

    public String getGuestGstNumber() { return guestGstNumber; }
    public void setGuestGstNumber(String guestGstNumber) { this.guestGstNumber = guestGstNumber; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public LocalDate getBillDate() { return billDate; }
    public void setBillDate(LocalDate billDate) { this.billDate = billDate; }

    public OffsetDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(OffsetDateTime generatedAt) { this.generatedAt = generatedAt; }

    public String getPdfFilePath() { return pdfFilePath; }
    public void setPdfFilePath(String pdfFilePath) { this.pdfFilePath = pdfFilePath; }

    public UUID getGenerationBatchId() {
        return generationBatchId;
    }

    public void setGenerationBatchId(UUID generationBatchId) {
        this.generationBatchId = generationBatchId;
    }

    public boolean isVoided() {
        return isVoided;
    }

    public void setVoided(boolean voided) {
        isVoided = voided;
    }

    public String getVoidReason() {
        return voidReason;
    }

    public void setVoidReason(String voidReason) {
        this.voidReason = voidReason;
    }

    public LocalDateTime getVoidedAt() {
        return voidedAt;
    }

    public void setVoidedAt(LocalDateTime voidedAt) {
        this.voidedAt = voidedAt;
    }

    public String getVoidedBy() {
        return voidedBy;
    }

    public void setVoidedBy(String voidedBy) {
        this.voidedBy = voidedBy;
    }

}