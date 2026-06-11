package com.adith.os.HMS.reservation;

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
public interface ReservationSequenceRepository
        extends JpaRepository<ReservationSequence, ReservationSequence.PK> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ReservationSequence s WHERE s.property.id = :propertyId AND s.sequenceMonth = :month")
    Optional<ReservationSequence> findByPropertyAndMonthWithLock(
            @Param("propertyId") UUID propertyId,
            @Param("month") LocalDate month);
}
