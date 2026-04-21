package com.adith.os.HMS.billing.bills;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupBillRepository extends JpaRepository<GroupBill, UUID> {

    List<GroupBill> findByParentBookingId(UUID parentBookingId);

    @Query("SELECT gb FROM GroupBill gb WHERE gb.parentBooking.id = :parentBookingId AND gb.isVoided = false")
    List<GroupBill> findActiveByParentBookingId(@Param("parentBookingId") UUID parentBookingId);

    @Query("SELECT COUNT(gb) FROM GroupBill gb WHERE gb.parentBooking.id = :parentBookingId AND gb.isVoided = false")
    long countActiveByParentBookingId(@Param("parentBookingId") UUID parentBookingId);

    List<GroupBill> findByGenerationBatchId(UUID generationBatchId);
}