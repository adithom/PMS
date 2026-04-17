package com.adith.os.HMS.billing.nightaudit;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "night_audit_log")
public class NightAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private OffsetDateTime ranAt;

    @Column(nullable = false)
    private LocalDate auditDate;

    @Column(nullable = false, length = 10)
    private String runType; // "AUTO" or "MANUAL"

    @Column(nullable = false)
    private int totalAssignments;

    @Column(nullable = false)
    private int chargesPosted;

    @Column(nullable = false)
    private int chargesSkipped;

    @Column(nullable = false)
    private int errors;

    @Column(nullable = false)
    private int mealPlanChargesPosted;

    @Column(nullable = false)
    private int mealPlanChargesSkipped;

    @Column(length = 1000)
    private String errorSummary;

    @PrePersist
    protected void onCreate() {
        if (ranAt == null) {
            ranAt = OffsetDateTime.now();
        }
    }

    public NightAuditLog() {}

    public NightAuditLog(LocalDate auditDate, String runType,
                         int totalAssignments, int chargesPosted,
                         int chargesSkipped, int errors,
                         int mealPlanChargesPosted, int mealPlanChargesSkipped,
                         String errorSummary) {
        this.auditDate = auditDate;
        this.runType = runType;
        this.totalAssignments = totalAssignments;
        this.chargesPosted = chargesPosted;
        this.chargesSkipped = chargesSkipped;
        this.errors = errors;
        this.mealPlanChargesPosted = mealPlanChargesPosted;
        this.mealPlanChargesSkipped = mealPlanChargesSkipped;
        this.errorSummary = errorSummary;
    }

    public UUID getId() { return id; }
    public OffsetDateTime getRanAt() { return ranAt; }
    public LocalDate getAuditDate() { return auditDate; }
    public String getRunType() { return runType; }
    public int getTotalAssignments() { return totalAssignments; }
    public int getChargesPosted() { return chargesPosted; }
    public int getChargesSkipped() { return chargesSkipped; }
    public int getErrors() { return errors; }
    public int getMealPlanChargesPosted() { return mealPlanChargesPosted; }
    public int getMealPlanChargesSkipped() { return mealPlanChargesSkipped; }
    public String getErrorSummary() { return errorSummary; }
}
