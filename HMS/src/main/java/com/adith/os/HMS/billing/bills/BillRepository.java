package com.adith.os.HMS.billing.bills;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface BillRepository extends JpaRepository<Bill, UUID> {
    boolean existsByFolioId(UUID folioId);

    boolean existsByFolioIdAndBillTypeInAndIsVoidedFalse(UUID folioId, Collection<BillType> billTypes);

    long countByFolioIdAndIsVoidedFalse(java.util.UUID folioId);

    List<Bill> findByFolioIdAndIsVoidedFalse(java.util.UUID folioId);

    List<Bill> findByFolioId(java.util.UUID folioId);

    @Query("""
            SELECT b FROM Bill b
            JOIN FETCH b.folio f
            JOIN FETCH f.property p
            JOIN FETCH f.guest g
            LEFT JOIN FETCH f.booking bk
            LEFT JOIN FETCH bk.room r
            LEFT JOIN FETCH bk.reservation re
            WHERE b.isVoided = false
              AND b.generatedAt >= :from
              AND b.generatedAt <= :to
            ORDER BY b.generatedAt DESC
            """)
    List<Bill> findActiveBillsInRange(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

    @Query("""
            SELECT b FROM Bill b
            JOIN FETCH b.folio f
            JOIN FETCH f.property p
            JOIN FETCH f.guest g
            LEFT JOIN FETCH f.booking bk
            LEFT JOIN FETCH bk.room r
            LEFT JOIN FETCH bk.reservation re
            WHERE b.generatedAt >= :from
              AND b.generatedAt <= :to
            ORDER BY b.generatedAt DESC
            """)
    List<Bill> findAllBillsInRange(@Param("from") OffsetDateTime from, @Param("to") OffsetDateTime to);

    @Query("SELECT b FROM Bill b JOIN FETCH b.folio f JOIN FETCH f.guest WHERE b.id IN :ids AND b.isVoided = false")
    List<Bill> findActiveByIds(@Param("ids") List<UUID> ids);
}
