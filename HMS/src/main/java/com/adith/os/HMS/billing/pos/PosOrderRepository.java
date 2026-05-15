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

    @Query("SELECT o FROM PosOrder o JOIN FETCH o.items i JOIN FETCH i.posProduct WHERE o.ticket.id = :ticketId")
    List<PosOrder> findByTicketIdWithItems(@Param("ticketId") UUID ticketId);

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
    List<Object[]> getOrderSummary(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    @Query("""
        SELECT poi.posProduct.id,
               poi.itemName,
               poi.posProduct.category.name,
               SUM(poi.quantity),
               COUNT(DISTINCT poi.posOrder.id)
        FROM PosOrderItem poi
        WHERE poi.posOrder.status != com.adith.os.HMS.billing.pos.PosOrderStatus.CANCELLED
          AND poi.posOrder.ticket.booking IS NOT NULL
          AND (
              poi.posOrder.ticket.booking.guest.id = :guestId
              OR EXISTS (SELECT ag FROM Booking b JOIN b.additionalGuests ag
                         WHERE b.id = poi.posOrder.ticket.booking.id AND ag.id = :guestId)
          )
        GROUP BY poi.posProduct.id, poi.itemName, poi.posProduct.category.name
        ORDER BY COUNT(DISTINCT poi.posOrder.id) DESC
    """)
    List<Object[]> findTopItemsByGuest(@Param("guestId") UUID guestId);
}
