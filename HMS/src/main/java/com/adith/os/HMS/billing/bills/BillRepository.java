package com.adith.os.HMS.billing.bills;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BillRepository extends JpaRepository<Bill, UUID> {
    boolean existsByFolioId(UUID folioId);

    long countByFolioIdAndIsVoidedFalse(java.util.UUID folioId);

    List<Bill> findByFolioIdAndIsVoidedFalse(java.util.UUID folioId);
}
