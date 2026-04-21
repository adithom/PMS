package com.adith.os.HMS.billing.bills;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PropertyInvoiceSequenceRepository
        extends JpaRepository<PropertyInvoiceSequence, PropertyInvoiceSequence.PK> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM PropertyInvoiceSequence s WHERE s.property.id = :propertyId AND s.sequenceDate = :date")
    Optional<PropertyInvoiceSequence> findByPropertyAndDateWithLock(
            @Param("propertyId") UUID propertyId,
            @Param("date") LocalDate date);
}
