package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

@Entity
@Table(name = "property_invoice_sequence")
@IdClass(PropertyInvoiceSequence.PK.class)
public class PropertyInvoiceSequence {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Id
    @Column(name = "sequence_date", nullable = false)
    private LocalDate sequenceDate;

    @Column(name = "next_val", nullable = false)
    private int nextVal = 1;

    public PropertyInvoiceSequence() {}

    public PropertyInvoiceSequence(Property property, LocalDate sequenceDate, int nextVal) {
        this.property = property;
        this.sequenceDate = sequenceDate;
        this.nextVal = nextVal;
    }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getSequenceDate() { return sequenceDate; }
    public void setSequenceDate(LocalDate sequenceDate) { this.sequenceDate = sequenceDate; }

    public int getNextVal() { return nextVal; }
    public void setNextVal(int nextVal) { this.nextVal = nextVal; }

    public static class PK implements Serializable {
        private Property property;
        private LocalDate sequenceDate;

        public PK() {}
        public PK(Property property, LocalDate sequenceDate) {
            this.property = property;
            this.sequenceDate = sequenceDate;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(property, pk.property) && Objects.equals(sequenceDate, pk.sequenceDate);
        }

        @Override
        public int hashCode() {
            return Objects.hash(property, sequenceDate);
        }
    }
}
