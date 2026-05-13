package com.adith.os.HMS.billing.bills;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupBillRepository extends JpaRepository<GroupBill, UUID> {

    List<GroupBill> findByReservationId(UUID reservationId);

    @Query("SELECT gb FROM GroupBill gb WHERE gb.reservation.id = :reservationId AND gb.isVoided = false")
    List<GroupBill> findActiveByReservationId(@Param("reservationId") UUID reservationId);

    @Query("SELECT COUNT(gb) FROM GroupBill gb WHERE gb.reservation.id = :reservationId AND gb.isVoided = false")
    long countActiveByReservationId(@Param("reservationId") UUID reservationId);

    List<GroupBill> findByGenerationBatchId(UUID generationBatchId);
}
