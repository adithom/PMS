package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.booking.Booking;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persisted record of one bill (ROOM_RENT or ANCILLARY) generated for a group booking.
 *
 * Relationship to existing Bill:
 *   - Bill      → tied to a single Folio (individual stay)
 *   - GroupBill → tied to the parent Booking (group master), aggregates across all child folios
 *
 * The two GroupBills for the same generation run share the same generationBatchId,
 * mirroring the exact same batch-linking pattern used in Bill.
 *
 * roomBreakdownJson stores a snapshot of per-room charge totals at generation time
 * (serialised by GroupBillGenerationService via Jackson). This is a denormalised
 * snapshot — it will not change even if charges are later voided on the folios,
 * which is the correct behaviour for a printed tax invoice.
 */
@Entity
@Table(name = "group_bill")
public class GroupBill {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "invoice_number", unique = true, nullable = false, length = 30)
    private String invoiceNumber;

    /**
     * Links this GroupBill to the group master Booking.
     * NOT the organiser folio — the booking itself.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_booking_id", nullable = false)
    @JsonIgnore
    private Booking parentBooking;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false)
    private BillType billType;

    @Column(name = "guest_gst_number", length = 50)
    private String guestGstNumber;

    // --- Group-level financial totals ---
    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "discount_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    // --- Batch linking (ties roomRentBill + ancillaryBill generated together) ---
    @Column(name = "generation_batch_id")
    private UUID generationBatchId;

    @Column(name = "bill_date", nullable = false)
    private LocalDate billDate;

    @Column(name = "generated_at", nullable = false)
    private OffsetDateTime generatedAt;

    @Column(name = "pdf_file_path")
    private String pdfFilePath;

    /**
     * JSON snapshot of per-room charge breakdown at generation time.
     * Stored as TEXT so no extra join table is needed for what is
     * essentially a read-only audit snapshot.
     * Example shape: [{roomNumber, guestName, subtotal, taxAmount, totalAmount}, ...]
     */
    @Lob
    @Column(name = "room_breakdown_json", columnDefinition = "TEXT")
    private String roomBreakdownJson;

    // --- Void fields (identical pattern to Bill) ---
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean isVoided = false;

    @Column(name = "void_reason")
    private String voidReason;

    @Column(name = "voided_at")
    private LocalDateTime voidedAt;

    @Column(name = "voided_by")
    private String voidedBy;

    // =========================================================================
    // Lifecycle
    // =========================================================================

    public GroupBill() {}

    @PrePersist
    protected void onCreate() {
        if (generatedAt == null) generatedAt = OffsetDateTime.now();
        if (billDate    == null) billDate    = generatedAt.toLocalDate();
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getInvoiceNumber() { return invoiceNumber; }
    public void setInvoiceNumber(String invoiceNumber) { this.invoiceNumber = invoiceNumber; }

    public Booking getParentBooking() { return parentBooking; }
    public void setParentBooking(Booking parentBooking) { this.parentBooking = parentBooking; }

    public BillType getBillType() { return billType; }
    public void setBillType(BillType billType) { this.billType = billType; }

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

    public UUID getGenerationBatchId() { return generationBatchId; }
    public void setGenerationBatchId(UUID generationBatchId) { this.generationBatchId = generationBatchId; }

    public LocalDate getBillDate() { return billDate; }
    public void setBillDate(LocalDate billDate) { this.billDate = billDate; }

    public OffsetDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(OffsetDateTime generatedAt) { this.generatedAt = generatedAt; }

    public String getPdfFilePath() { return pdfFilePath; }
    public void setPdfFilePath(String pdfFilePath) { this.pdfFilePath = pdfFilePath; }

    public String getRoomBreakdownJson() { return roomBreakdownJson; }
    public void setRoomBreakdownJson(String roomBreakdownJson) { this.roomBreakdownJson = roomBreakdownJson; }

    public boolean isVoided() { return isVoided; }
    public void setVoided(boolean voided) { isVoided = voided; }

    public String getVoidReason() { return voidReason; }
    public void setVoidReason(String voidReason) { this.voidReason = voidReason; }

    public LocalDateTime getVoidedAt() { return voidedAt; }
    public void setVoidedAt(LocalDateTime voidedAt) { this.voidedAt = voidedAt; }

    public String getVoidedBy() { return voidedBy; }
    public void setVoidedBy(String voidedBy) { this.voidedBy = voidedBy; }
}
