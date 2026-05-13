package com.adith.os.HMS.billing.folio;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FolioRepository extends JpaRepository<Folio, UUID> {

    Optional<Folio> findByFolioNumber(String folioNumber);

    @Query("SELECT f FROM Folio f WHERE f.booking.id = :bookingId")
    Optional<Folio> findByBookingId(@Param("bookingId") UUID bookingId);

    @Query("SELECT f FROM Folio f WHERE f.booking.id = :bookingId")
    List<Folio> findAllByBookingId(@Param("bookingId") UUID bookingId);

    @Query("""
            SELECT DISTINCT f FROM Folio f
            LEFT JOIN FETCH f.booking b
            LEFT JOIN FETCH b.roomAssignments ra
            LEFT JOIN FETCH ra.room
            WHERE f.property.id = :propertyId AND f.status = :status
            """)
    List<Folio> findByPropertyAndStatus(
            @Param("propertyId") UUID propertyId,
            @Param("status") FolioStatus status
    );

    @Query("SELECT f FROM Folio f WHERE f.guest.id = :guestId ORDER BY f.createdAt DESC")
    List<Folio> findByGuestId(@Param("guestId") UUID guestId);

    @Query("SELECT COUNT(f) FROM Folio f WHERE f.property.id = :propertyId " +
            "AND f.status = 'OPEN' AND f.balanceDue > 0")
    long countOpenFoliosWithBalance(@Param("propertyId") UUID propertyId);

    boolean existsByFolioNumber(String folioNumber);
}
