package com.adith.os.HMS.booking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface BookingRepository extends JpaRepository<Booking, UUID> {

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId ORDER BY b.checkIn DESC")
    List<Booking> findByPropertyIdOrderByCheckInDesc(UUID propertyId);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId " +
            "AND b.checkIn >= :checkInFrom AND b.checkIn <= :checkInTo " +
            "ORDER BY b.checkIn ASC")
    List<Booking> findByPropertyIdAndCheckInBetween(
            @Param("propertyId") UUID propertyId,
            @Param("checkInFrom") LocalDate checkInFrom,
            @Param("checkInTo") LocalDate checkInTo);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId " +
            "AND b.guest.id = :guestId ORDER BY b.checkIn DESC")
    List<Booking> findByPropertyIdAndGuestIdOrderByCheckInDesc(UUID propertyId, UUID guestId);

    @Query("SELECT b FROM Booking b WHERE b.room.id = :roomId ORDER BY b.checkIn DESC")
    List<Booking> findByRoomIdOrderByCheckInDesc(UUID roomId);

    @Query("SELECT b FROM Booking b WHERE b.unit.id = :unitId ORDER BY b.checkIn DESC")
    List<Booking> findByUnitIdOrderByCheckInDesc(UUID unitId);

    // Active booking = not cancelled and reservation not checked-out/cancelled
    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    boolean existsOverlappingBooking(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.id != :currentBookingId " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    boolean existsOverlappingBookingExcludingCurrent(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingUnitBookings(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.id != :currentBookingId " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingUnitBookingsExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NOT NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingRoomBookingsInUnit(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NOT NULL " +
            "AND b.id != :currentBookingId " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingRoomBookingsInUnitExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    @Query("SELECT COUNT(r) FROM Room r WHERE r.unit.id = :unitId")
    long countRoomsInUnit(@Param("unitId") UUID unitId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countUnassignedOverlappingUnitBookings(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.id != :bookingId " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countUnassignedOverlappingUnitBookingsExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("bookingId") UUID bookingId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.room IS NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countUnassignedOverlappingPropertyBookings(
            @Param("propertyId") UUID propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED')")
    List<Booking> findConflictingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED')")
    List<Booking> findConflictingBookingsForRoom(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.cancelled = false " +
            "AND b.reservation.status IN ('CONFIRMED', 'CHECKED_IN')")
    List<Booking> findConflictingBookingsForUnit(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId")
    List<Booking> findByPropertyId(@Param("propertyId") UUID propertyId);

    List<Booking> findByRoomId(UUID roomId);

    @Query("SELECT b FROM Booking b WHERE " +
            "LOWER(CONCAT(b.guest.firstName, ' ', b.guest.lastName)) LIKE LOWER(CONCAT('%', :guestName, '%')) " +
            "OR LOWER(b.guest.firstName) LIKE LOWER(CONCAT('%', :guestName, '%')) " +
            "OR LOWER(b.guest.lastName) LIKE LOWER(CONCAT('%', :guestName, '%'))")
    List<Booking> findByGuestNameContainingIgnoreCase(@Param("guestName") String guestName);

    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn <= :date " +
            "AND b.checkOut >= :date " +
            "ORDER BY b.checkIn ASC")
    List<Booking> findByPropertyIdAndDate(
            @Param("propertyId") UUID propertyId,
            @Param("date") LocalDate date);

    @Query("""
        SELECT b FROM Booking b
        WHERE b.property.id = :propertyId
        AND b.checkIn <= :to
        AND b.checkOut >= :from
        AND b.cancelled = false
        AND b.reservation.status != 'CANCELLED'
        ORDER BY b.checkIn ASC
    """)
    List<Booking> findOverlappingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    // Active in-house bookings on a date (CONFIRMED or CHECKED_IN, not cancelled)
    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn <= :date " +
            "AND b.checkOut >= :date " +
            "AND b.cancelled = false " +
            "AND b.reservation.status IN ('CONFIRMED', 'CHECKED_IN') " +
            "ORDER BY b.checkIn ASC")
    List<Booking> findActiveByPropertyIdAndDate(
            @Param("propertyId") UUID propertyId,
            @Param("date") LocalDate date);

    // Unassigned upcoming bookings (not yet checked in, not cancelled)
    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId " +
            "AND b.room IS NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED', 'CHECKED_IN') " +
            "AND b.checkIn BETWEEN :startDate AND :endDate ORDER BY b.checkIn ASC")
    List<Booking> findUnassignedUpcomingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // Unassigned bookings overlapping a window — used for tape-chart ghost fill
    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId AND b.room IS NULL " +
            "AND b.cancelled = false " +
            "AND b.reservation.status NOT IN ('CHECKED_OUT', 'CANCELLED') " +
            "AND b.checkIn < :to AND b.checkOut > :from " +
            "ORDER BY b.checkIn ASC, b.id ASC")
    List<Booking> findUnassignedOverlapping(
            @Param("propertyId") UUID propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.reservation.id = :reservationId")
    long countByReservationId(@Param("reservationId") UUID reservationId);

    @Query("SELECT b FROM Booking b WHERE b.reservation.id = :reservationId")
    List<Booking> findByReservationId(@Param("reservationId") UUID reservationId);

    boolean existsByTravelAgentId(UUID travelAgentId);

    @Query("SELECT b FROM Booking b WHERE b.travelAgent.id = :travelAgentId ORDER BY b.checkIn DESC")
    List<Booking> findByTravelAgentIdOrderByCheckInDesc(@Param("travelAgentId") UUID travelAgentId);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId AND b.travelAgent.id = :travelAgentId ORDER BY b.checkIn DESC")
    List<Booking> findByPropertyIdAndTravelAgentIdOrderByCheckInDesc(
            @Param("propertyId") UUID propertyId,
            @Param("travelAgentId") UUID travelAgentId);

    @Query("""
        SELECT b FROM Booking b
        WHERE b.guest.id = :guestId
           OR :guestId IN (SELECT ag.id FROM b.additionalGuests ag)
        ORDER BY b.checkIn DESC
    """)
    List<Booking> findAllBookingsForGuest(@Param("guestId") UUID guestId);
}
