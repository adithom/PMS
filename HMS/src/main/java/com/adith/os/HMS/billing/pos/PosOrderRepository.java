package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PosOrderRepository extends JpaRepository<PosOrder, UUID> {
    List<PosOrder> findByPosLocationId(UUID posLocationId);

    List<PosOrder> findByFolioId(UUID folioId);

    List<PosOrder> findByStatus(PosOrderStatus status);
}
