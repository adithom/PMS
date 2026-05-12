package com.adith.os.HMS.billing.pos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PosReceiptSequenceRepository extends JpaRepository<PosReceiptSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM PosReceiptSequence s WHERE s.posLocation.id = :locationId AND s.financialYear = :year")
    Optional<PosReceiptSequence> findByLocationAndYearForUpdate(
            @Param("locationId") UUID locationId,
            @Param("year") int year);
}
