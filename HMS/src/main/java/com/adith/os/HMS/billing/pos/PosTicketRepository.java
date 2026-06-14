package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface PosTicketRepository extends JpaRepository<PosTicket, UUID> {

    List<PosTicket> findByPosLocationIdAndStatus(UUID locationId, PosTicketStatus status);

    List<PosTicket> findByBookingIdAndStatus(UUID bookingId, PosTicketStatus status);

    @Query("SELECT t FROM PosTicket t WHERE t.posLocation.id = :locationId " +
           "AND t.closedAt >= :from AND t.closedAt < :to AND t.status = 'CLOSED' " +
           "ORDER BY t.closedAt DESC")
    List<PosTicket> findClosedByLocationAndDateRange(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    @Query("SELECT COUNT(DISTINCT t), " +
           "COALESCE(SUM(CASE WHEN t.mealPlanCovered = false THEN o.totalAmount ELSE 0 END), 0) " +
           "FROM PosTicket t JOIN t.orders o " +
           "WHERE t.posLocation.id = :locationId " +
           "AND t.closedAt >= :from AND t.closedAt < :to AND t.status = 'CLOSED'")
    List<Object[]> getTicketSummary(
            @Param("locationId") UUID locationId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
