package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PosOrderRepository extends JpaRepository<PosOrder, UUID> {
    List<PosOrder> findByPosLocationId(UUID posLocationId);

    List<PosOrder> findByFolioId(UUID folioId);

    List<PosOrder> findByStatus(PosOrderStatus status);

    @Query("SELECT COUNT(i) > 0 FROM PosOrderItem i WHERE i.posProduct.id = :productId")
    boolean existsOrderItemByProductId(@Param("productId") UUID productId);

    @Query("SELECT o FROM PosOrder o WHERE o.posLocation.id = :locationId " +
           "AND o.orderDate >= :from AND o.orderDate <= :to " +
           "ORDER BY o.orderDate DESC")
    List<PosOrder> findByLocationAndDateRange(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    @Query("SELECT o FROM PosOrder o WHERE o.posLocation.id = :locationId " +
           "AND o.orderDate >= :from AND o.orderDate <= :to " +
           "AND o.status = :status " +
           "ORDER BY o.orderDate DESC")
    List<PosOrder> findByLocationAndDateRangeAndStatus(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("status") PosOrderStatus status);

    @Query("SELECT COUNT(o), COALESCE(SUM(o.totalAmount), 0), COALESCE(AVG(o.totalAmount), 0) " +
           "FROM PosOrder o WHERE o.posLocation.id = :locationId " +
           "AND o.orderDate >= :from AND o.orderDate <= :to " +
           "AND o.status IN (com.adith.os.HMS.billing.pos.PosOrderStatus.CLOSED, " +
           "com.adith.os.HMS.billing.pos.PosOrderStatus.CHARGED)")
    Object[] getOrderSummary(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
