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

    @Query("SELECT p FROM Payment p WHERE p.transactionId = :transactionId")
    Optional<Payment> findByTransactionId(@Param("transactionId") String transactionId);

    boolean existsByPaymentNumber(String paymentNumber);

    // Routing-aware queries: payments tag a booking XOR a reservation.

    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundedAmount, 0)), 0) FROM Payment p " +
            "WHERE p.bookingId = :bookingId AND p.paymentStatus = 'COMPLETED'")
    BigDecimal sumCompletedByBookingId(@Param("bookingId") UUID bookingId);

    @Query("SELECT COALESCE(SUM(p.amount - COALESCE(p.refundedAmount, 0)), 0) FROM Payment p " +
            "WHERE p.reservationId = :reservationId AND p.paymentStatus = 'COMPLETED'")
    BigDecimal sumCompletedByReservationId(@Param("reservationId") UUID reservationId);

    @Query("SELECT p FROM Payment p WHERE p.bookingId = :bookingId ORDER BY p.paymentDate DESC")
    List<Payment> findByBookingId(@Param("bookingId") UUID bookingId);

    @Query("SELECT p FROM Payment p WHERE p.reservationId = :reservationId ORDER BY p.paymentDate DESC")
    List<Payment> findByReservationId(@Param("reservationId") UUID reservationId);

    // Property-scoped reporting queries: a payment is "in this property" if it tags a booking
    // or a reservation that belongs to the property.

    @Query("SELECT p FROM Payment p WHERE p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = :status AND (" +
            "  EXISTS (SELECT 1 FROM Booking b WHERE b.id = p.bookingId AND b.property.id = :propertyId) " +
            "  OR EXISTS (SELECT 1 FROM com.adith.os.HMS.reservation.Reservation r WHERE r.id = p.reservationId AND r.property.id = :propertyId)" +
            ") ORDER BY p.paymentDate DESC")
    List<Payment> findByPropertyAndDateRangeAndStatus(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate,
            @Param("status") PaymentStatus status
    );

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p " +
            "WHERE p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = 'COMPLETED' AND (" +
            "  EXISTS (SELECT 1 FROM Booking b WHERE b.id = p.bookingId AND b.property.id = :propertyId) " +
            "  OR EXISTS (SELECT 1 FROM com.adith.os.HMS.reservation.Reservation r WHERE r.id = p.reservationId AND r.property.id = :propertyId)" +
            ")")
    BigDecimal getTotalPaymentsByPropertyAndDateRange(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate
    );

    @Query("SELECT p.paymentMethod, SUM(p.amount) FROM Payment p " +
            "WHERE p.paymentDate BETWEEN :startDate AND :endDate " +
            "AND p.paymentStatus = 'COMPLETED' AND (" +
            "  EXISTS (SELECT 1 FROM Booking b WHERE b.id = p.bookingId AND b.property.id = :propertyId) " +
            "  OR EXISTS (SELECT 1 FROM com.adith.os.HMS.reservation.Reservation r WHERE r.id = p.reservationId AND r.property.id = :propertyId)" +
            ") GROUP BY p.paymentMethod")
    List<Object[]> getPaymentBreakdownByMethod(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") OffsetDateTime startDate,
            @Param("endDate") OffsetDateTime endDate
    );

    @Query("SELECT COUNT(p) FROM Payment p WHERE p.paymentStatus = 'PENDING' AND (" +
            "  EXISTS (SELECT 1 FROM Booking b WHERE b.id = p.bookingId AND b.property.id = :propertyId) " +
            "  OR EXISTS (SELECT 1 FROM com.adith.os.HMS.reservation.Reservation r WHERE r.id = p.reservationId AND r.property.id = :propertyId)" +
            ")")
    long countPendingPaymentsByProperty(@Param("propertyId") UUID propertyId);
}
