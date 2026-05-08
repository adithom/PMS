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

    List<Booking> findByPropertyIdAndStatus(UUID propertyId, String status);

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

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    boolean existsOverlappingBooking(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN true ELSE false END FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.id != :currentBookingId " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    boolean existsOverlappingBookingExcludingCurrent(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingUnitBookings(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    // Count overlapping bookings excluding current booking
    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.id != :currentBookingId " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingUnitBookingsExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NOT NULL " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingRoomBookingsInUnit(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut);

    // Count overlapping room bookings excluding current
    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NOT NULL " +
            "AND b.id != :currentBookingId " +
            "AND b.status NOT IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW') " +
            "AND b.checkIn < :checkOut AND b.checkOut > :checkIn")
    long countOverlappingRoomBookingsInUnitExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("currentBookingId") UUID currentBookingId);

    // Count total rooms in a unit
    @Query("SELECT COUNT(r) FROM Room r WHERE r.unit.id = :unitId")
    long countRoomsInUnit(@Param("unitId") UUID unitId);

    /**
     * Count unassigned bookings for a unit that overlap with a date range.
     * These bookings consume unit capacity even though they have no room mapped yet.
     */
    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    long countUnassignedOverlappingUnitBookings(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("statuses") List<BookingStatus> statuses);

    /**
     * Count unassigned bookings for a unit that overlap, excluding a specific booking.
     */
    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.room IS NULL " +
            "AND b.id != :bookingId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    long countUnassignedOverlappingUnitBookingsExcludingCurrent(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("bookingId") UUID bookingId,
            @Param("statuses") List<BookingStatus> statuses);

    /**
     * Count unassigned bookings for a property that overlap with a date range.
     * These bookings consume capacity even though they have no room mapped yet.
     */
    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.room IS NULL " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    long countUnassignedOverlappingPropertyBookings(
            @Param("propertyId") UUID propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("statuses") List<BookingStatus> statuses);

    /**
     * Find all bookings for a property that conflict with the given date range
     */
    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    List<Booking> findConflictingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("statuses") List<BookingStatus> statuses
    );

    /**
     * Find all bookings for a specific room that conflict with the given date range
     */
    @Query("SELECT b FROM Booking b " +
            "WHERE b.room.id = :roomId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    List<Booking> findConflictingBookingsForRoom(
            @Param("roomId") UUID roomId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("statuses") List<BookingStatus> statuses
    );

    /**
     * Find all bookings for a specific unit that conflict with the given date range
     */
    @Query("SELECT b FROM Booking b " +
            "WHERE b.unit.id = :unitId " +
            "AND b.checkIn < :checkOut " +
            "AND b.checkOut > :checkIn " +
            "AND b.status IN :statuses")
    List<Booking> findConflictingBookingsForUnit(
            @Param("unitId") UUID unitId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("statuses") List<BookingStatus> statuses
    );

    /**
     * Find bookings by property
     */
    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId")
    List<Booking> findByPropertyId(@Param("propertyId") UUID propertyId);

    /**
     * Find bookings by room
     */
    List<Booking> findByRoomId(UUID roomId);

    /**
     * Find bookings by status
     */
    List<Booking> findByStatus(BookingStatus status);

    @Query("SELECT b FROM Booking b WHERE " +
            "LOWER(CONCAT(b.guest.firstName, ' ', b.guest.lastName)) LIKE LOWER(CONCAT('%', :guestName, '%')) " +
            "OR LOWER(b.guest.firstName) LIKE LOWER(CONCAT('%', :guestName, '%')) " +
            "OR LOWER(b.guest.lastName) LIKE LOWER(CONCAT('%', :guestName, '%'))")
    List<Booking> findByGuestNameContainingIgnoreCase(@Param("guestName") String guestName);

    /**
     * Find all bookings for a property that are active on a specific date
     * A booking is active on a date if: checkIn <= date < checkOut
     */
    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn <= :date " +
            "AND b.checkOut >= :date " +
            "ORDER BY b.checkIn ASC")
    List<Booking> findByPropertyIdAndDate(
            @Param("propertyId") UUID propertyId,
            @Param("date") LocalDate date
    );

    @Query("""
        SELECT b FROM Booking b 
        WHERE b.property.id = :propertyId 
        AND b.checkIn <= :to 
        AND b.checkOut >= :from 
        AND b.status NOT IN ('CANCELLED') 
        ORDER BY b.checkIn ASC
    """)
    List<Booking> findOverlappingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    /**
     * Find all bookings for a property that are active on a specific date with specific statuses
     */
    @Query("SELECT b FROM Booking b " +
            "WHERE b.property.id = :propertyId " +
            "AND b.checkIn <= :date " +
            "AND b.checkOut >= :date " +
            "AND b.status IN :statuses " +
            "ORDER BY b.checkIn ASC")
    List<Booking> findByPropertyIdAndDateAndStatuses(
            @Param("propertyId") UUID propertyId,
            @Param("date") LocalDate date,
            @Param("statuses") List<BookingStatus> statuses
    );

    //Group Bookings

    @Query("SELECT b FROM Booking b WHERE b.parentBooking.id = :parentBookingId ORDER BY b.createdAt ASC")
    List<Booking> findByParentBookingId(@Param("parentBookingId") UUID parentBookingId);

    // Fetch all group master bookings for a property
    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId AND b.isGroupMaster = true ORDER BY b.checkIn DESC")
    List<Booking> findGroupMastersByPropertyId(@Param("propertyId") UUID propertyId);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId AND b.room IS NULL AND b.status IN :statuses AND b.checkIn BETWEEN :startDate AND :endDate ORDER BY b.checkIn ASC")
    List<Booking> findUnassignedUpcomingBookings(
            @Param("propertyId") UUID propertyId,
            @Param("statuses") List<BookingStatus> statuses,
            @Param("startDate") java.time.LocalDate startDate,
            @Param("endDate") java.time.LocalDate endDate
    );

    boolean existsByTravelAgentId(UUID travelAgentId);

    @Query("SELECT b FROM Booking b WHERE b.travelAgent.id = :travelAgentId ORDER BY b.checkIn DESC")
    List<Booking> findByTravelAgentIdOrderByCheckInDesc(@Param("travelAgentId") UUID travelAgentId);

    @Query("SELECT b FROM Booking b WHERE b.property.id = :propertyId AND b.travelAgent.id = :travelAgentId ORDER BY b.checkIn DESC")
    List<Booking> findByPropertyIdAndTravelAgentIdOrderByCheckInDesc(
            @Param("propertyId") UUID propertyId,
            @Param("travelAgentId") UUID travelAgentId);
}
