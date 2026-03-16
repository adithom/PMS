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
     * Overlap: ra.startDate < endDate AND ra.endDate > startDate
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.id = :roomId " +
            "AND ra.startDate < :endDate " +
            "AND ra.endDate > :startDate " +
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
            "AND ra.startDate < :endDate " +
            "AND ra.endDate > :startDate " +
            "AND ra.status NOT IN :excludedStatuses")
    boolean existsOverlappingAssignment(
            @Param("roomId") UUID roomId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("excludedStatuses") List<RoomAssignmentStatus> excludedStatuses);

    /**
     * Find all conflicting assignments for a property within a date range.
     * Used by AvailabilityService for calendar views and search.
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.room.property.id = :propertyId " +
            "AND ra.startDate < :endDate " +
            "AND ra.endDate > :startDate " +
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
            "AND ra.startDate < :endDate " +
            "AND ra.endDate > :startDate " +
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
            "AND ra.startDate < :endDate " +
            "AND ra.endDate > :startDate " +
            "AND ra.status IN :statuses")
    List<RoomAssignment> findConflictingAssignmentsForUnit(
            @Param("unitId") UUID unitId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<RoomAssignmentStatus> statuses);

    /**
     * Find all ACTIVE assignments where a specific date falls within the range.
     * Used by the nightly batch to post room charges.
     * Logic: startDate <= date AND endDate > date (the date is an occupied night)
     */
    @Query("SELECT ra FROM RoomAssignment ra " +
            "WHERE ra.startDate <= :date " +
            "AND ra.endDate > :date " +
            "AND ra.status = :status")
    List<RoomAssignment> findAssignmentsForDate(
            @Param("date") LocalDate date,
            @Param("status") RoomAssignmentStatus status);

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
}
