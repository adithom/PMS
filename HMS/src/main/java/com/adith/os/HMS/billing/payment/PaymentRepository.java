package com.adith.os.HMS.billing.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByPaymentNumber(String paymentNumber);

    @Query("SELECT p FROM Payment p WHERE p.folio.id = :folioId ORDER BY p.paymentDate DESC")
    List<Payment> findByFolioId(@Param("folioId") UUID folioId);

    @Query("SELECT p FROM Payment p WHERE p.folio.id = :folioId AND p.paymentStatus = :status")
    List<Payment> findByFolioIdAndStatus(
            @Param("folioId") UUID folioId,
            @Param("status") PaymentStatus status
    );

    @Query("SELECT p FROM Payment p WHERE p.folio.property.id = :propertyId " +
            "AND p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = :status")
    List<Payment> findByPropertyAndDateRangeAndStatus(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate,
            @Param("status") PaymentStatus status
    );

    @Query("SELECT p FROM Payment p WHERE p.transactionId = :transactionId")
    Optional<Payment> findByTransactionId(@Param("transactionId") String transactionId);

    @Query("SELECT SUM(p.amount) FROM Payment p WHERE p.folio.property.id = :propertyId " +
            "AND p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = 'COMPLETED'")
    BigDecimal getTotalPaymentsByPropertyAndDateRange(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate
    );

    @Query("SELECT p.paymentMethod, SUM(p.amount) FROM Payment p " +
            "WHERE p.folio.property.id = :propertyId " +
            "AND p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = 'COMPLETED' " +
            "GROUP BY p.paymentMethod")
    List<Object[]> getPaymentBreakdownByMethod(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate
    );

    boolean existsByPaymentNumber(String paymentNumber);

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.folio.property.id = :propertyId " +
            "AND p.paymentStatus = 'PENDING'")
    long countPendingPaymentsByProperty(@Param("propertyId") UUID propertyId);
}