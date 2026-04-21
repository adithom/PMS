package com.adith.os.HMS.roomassignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface RoomAssignmentRepository extends JpaRepository<RoomAssignment, UUID> {

    /**
     * Find all assignments for a booking, ordered by start date.
     */
    @Query("SELECT ra FROM RoomAssignment ra WHERE ra.booking.id = :bookingId ORDER BY ra.startDate ASC")
    List<RoomAssignment> findByBookingId(@Param("bookingId") UUID bookingId);

    /**
     * Find overlapping assignments for a specific room (for availability checks).
     * Overlap: ra.startDate <= endDate AND ra.endDate >= startDate (Enforces 1-day buffer)
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.id = :roomId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status NOT IN :excludedStatuses")
    List<RoomAssignment> findOverlappingAssignments(
            @Param("roomId") UUID roomId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludedStatuses") List<RoomAssignmentStatus> excludedStatuses);

    /**
     * Check if a room has any overlapping assignment (boolean version).
     */
    @Query("SELECT CASE WHEN COUNT(ra) > 0 THEN true ELSE false END FROM RoomAssignment ra " +
            "WHERE ra.room.id = :roomId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status NOT IN :excludedStatuses")
    boolean existsOverlappingAssignment(
            @Param("roomId") UUID roomId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludedStatuses") List<RoomAssignmentStatus> excludedStatuses);

    /**
     * Check if a room has any overlapping assignment, excluding a specific booking.
     */
    @Query("SELECT CASE WHEN COUNT(ra) > 0 THEN true ELSE false END FROM RoomAssignment ra " +
            "WHERE ra.room.id = :roomId " +
            "AND ra.booking.id != :bookingId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status NOT IN :excludedStatuses")
    boolean existsOverlappingAssignmentExcludingBooking(
            @Param("roomId") UUID roomId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("bookingId") UUID bookingId,
            @Param("excludedStatuses") List<RoomAssignmentStatus> excludedStatuses);

    /**
     * Find conflicting assignments for a unit, excluding a specific booking.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.unit.id = :unitId " +
            "AND ra.booking.id != :bookingId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findConflictingAssignmentsForUnitExcludingBooking(
            @Param("unitId") UUID unitId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("bookingId") UUID bookingId,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find all conflicting assignments for a property within a date range.
     * Used by AvailabilityService for calendar views and search.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.property.id = :propertyId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findConflictingAssignments(
            @Param("propertyId") UUID propertyId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find conflicting assignments for a specific room.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.id = :roomId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findConflictingAssignmentsForRoom(
            @Param("roomId") UUID roomId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find conflicting assignments for a unit (all rooms in a unit).
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.unit.id = :unitId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findConflictingAssignmentsForUnit(
            @Param("unitId") UUID unitId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Count distinct rooms with conflicting assignments for a unit.
     */
    @Query("SELECT COUNT(DISTINCT ra.room.id) FROM RoomAssignment ra " +
            "WHERE ra.room.unit.id = :unitId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    long countDistinctOccupiedRoomsForUnit(
            @Param("unitId") UUID unitId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Count distinct rooms with conflicting assignments for a unit, excluding a specific booking.
     */
    @Query("SELECT COUNT(DISTINCT ra.room.id) FROM RoomAssignment ra " +
            "WHERE ra.room.unit.id = :unitId " +
            "AND ra.booking.id != :bookingId " +
            "AND ra.startDate <= :endDate " +
            "AND ra.endDate >= :startDate " +
            "AND ra.status IN :statuses")
    long countDistinctOccupiedRoomsForUnitExcludingBooking(
            @Param("unitId") UUID unitId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("bookingId") UUID bookingId,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find assignments where a specific date falls within the occupied range.
     * Used by the nightly batch to post room charges and backfill historical stays.
     * Logic: startDate <= date AND endDate > date (the date is an occupied night)
     * NOTE: Left strictly as > to ensure checkout days are not billed.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "JOIN FETCH ra.booking b " +
            "JOIN FETCH b.property " +
            "LEFT JOIN FETCH b.folios " +
            "JOIN FETCH ra.room " +
            "WHERE ra.startDate <= :date " +
            "AND ra.endDate > :date " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findAssignmentsForDate(
            @Param("date") LocalDate date,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find active/scheduled assignments for a booking (not cancelled/completed).
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.booking.id = :bookingId " +
            "AND ra.status IN :statuses " +
            "ORDER BY ra.startDate ASC")
    List<RoomAssignment> findActiveAssignmentsByBookingId(
            @Param("bookingId") UUID bookingId,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find assignments that should have ended by the start of the business date.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.endDate <= :businessDate " +
            "AND ra.status IN :statuses " +
            "ORDER BY ra.endDate ASC, ra.startDate ASC")
    List<RoomAssignment> findAssignmentsEndingOnOrBefore(
            @Param("businessDate") LocalDate businessDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find scheduled assignments that should become active by the business date.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.startDate <= :businessDate " +
            "AND ra.status = :status " +
            "ORDER BY ra.startDate ASC")
    List<RoomAssignment> findAssignmentsStartingOnOrBefore(
            @Param("businessDate") LocalDate businessDate,
            @Param("status") RoomAssignmentStatus status);
}
