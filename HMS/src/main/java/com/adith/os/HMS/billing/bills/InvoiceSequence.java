package com.adith.os.HMS.billing.bills;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "invoice_sequence")
public class InvoiceSequence {

    @Id
    @Column(name = "sequence_date")
    private LocalDate sequenceDate;

    @Column(name = "next_val", nullable = false)
    private int nextVal = 1;

    public InvoiceSequence() {
    }

    public InvoiceSequence(LocalDate sequenceDate, int nextVal) {
        this.sequenceDate = sequenceDate;
        this.nextVal = nextVal;
    }

    public LocalDate getSequenceDate() {
        return sequenceDate;
    }

    public void setSequenceDate(LocalDate sequenceDate) {
        this.sequenceDate = sequenceDate;
    }

    public int getNextVal() {
        return nextVal;
    }

    public void setNextVal(int nextVal) {
        this.nextVal = nextVal;
    }


}