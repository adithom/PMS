package com.adith.os.HMS.billing.pos;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "pos_receipt_sequence",
        uniqueConstraints = @UniqueConstraint(columnNames = {"location_id", "financial_year"}))
public class PosReceiptSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private PosLocation posLocation;

    @Column(name = "financial_year", nullable = false)
    private int financialYear;

    @Column(name = "last_sequence_number", nullable = false)
    private long lastSequenceNumber = 0;

    public PosReceiptSequence() {
    }

    public UUID getId() { return id; }

    public PosLocation getPosLocation() { return posLocation; }
    public void setPosLocation(PosLocation posLocation) { this.posLocation = posLocation; }

    public int getFinancialYear() { return financialYear; }
    public void setFinancialYear(int financialYear) { this.financialYear = financialYear; }

    public long getLastSequenceNumber() { return lastSequenceNumber; }
    public void setLastSequenceNumber(long lastSequenceNumber) { this.lastSequenceNumber = lastSequenceNumber; }
}
