package com.adith.os.HMS.reservation;

import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

@Entity
@Table(name = "reservation_sequence")
@IdClass(ReservationSequence.PK.class)
public class ReservationSequence {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Id
    @Column(name = "sequence_month", nullable = false)
    private LocalDate sequenceMonth;

    @Column(name = "next_val", nullable = false)
    private int nextVal = 1;

    public ReservationSequence() {}

    public ReservationSequence(Property property, LocalDate sequenceMonth, int nextVal) {
        this.property = property;
        this.sequenceMonth = sequenceMonth;
        this.nextVal = nextVal;
    }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public LocalDate getSequenceMonth() { return sequenceMonth; }
    public void setSequenceMonth(LocalDate sequenceMonth) { this.sequenceMonth = sequenceMonth; }

    public int getNextVal() { return nextVal; }
    public void setNextVal(int nextVal) { this.nextVal = nextVal; }

    public static class PK implements Serializable {
        private Property property;
        private LocalDate sequenceMonth;

        public PK() {}
        public PK(Property property, LocalDate sequenceMonth) {
            this.property = property;
            this.sequenceMonth = sequenceMonth;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof PK pk)) return false;
            return Objects.equals(property, pk.property) && Objects.equals(sequenceMonth, pk.sequenceMonth);
        }

        @Override
        public int hashCode() {
            return Objects.hash(property, sequenceMonth);
        }
    }
}
