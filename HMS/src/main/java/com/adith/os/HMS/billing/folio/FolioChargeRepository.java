package com.adith.os.HMS.billing.folio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface FolioChargeRepository extends JpaRepository<FolioCharge, UUID> {

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.id = :folioId AND c.isVoided = false ORDER BY c.chargeDate DESC")
    List<FolioCharge> findActiveChargesByFolioId(@Param("folioId") UUID folioId);

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.id = :folioId ORDER BY c.chargeDate DESC")
    List<FolioCharge> findAllChargesByFolioId(@Param("folioId") UUID folioId);

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.property.id = :propertyId " +
            "AND c.chargeDate BETWEEN :startDate AND :endDate " +
            "AND c.isVoided = false")
    List<FolioCharge> findChargesByPropertyAndDateRange(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    List<FolioCharge> findByBillId(UUID billId);

    List<FolioCharge> findByGroupBillId(UUID groupBillId);

    boolean existsByFolioIdAndChargeCodeAndChargeDateAndIsVoidedFalse(
            UUID folioId, ChargeCode chargeCode, LocalDate chargeDate);

    boolean existsByFolioIdAndReferenceTypeAndChargeDateAndIsVoidedFalse(
            UUID folioId, String referenceType, LocalDate chargeDate);

    // Phase B: charge-level routing queries

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.booking.reservation.id = :reservationId " +
            "AND c.routeToMaster = true AND c.isVoided = false " +
            "ORDER BY c.chargeDate")
    List<FolioCharge> findRouteToMasterChargesByReservationId(@Param("reservationId") UUID reservationId);

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.booking.reservation.id = :reservationId " +
            "AND c.isVoided = false")
    List<FolioCharge> findActiveChargesByReservationId(@Param("reservationId") UUID reservationId);

    @Query("SELECT c FROM FolioCharge c WHERE c.folio.booking.id = :bookingId " +
            "AND c.routeToMaster = false AND c.isVoided = false " +
            "ORDER BY c.chargeDate")
    List<FolioCharge> findOwnFolioChargesByBookingId(@Param("bookingId") UUID bookingId);
}