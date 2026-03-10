package com.adith.os.HMS.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    boolean existsByPropertyIdAndNumber(UUID propertyId, String number);

    Optional<Room> findByPropertyIdAndNumber(UUID propertyId, String number);

    @Query("SELECT r FROM Room r WHERE r.property.id = :propertyId ORDER BY r.number ASC")
    List<Room> findByPropertyIdOrderByNumber(UUID propertyId);

    @Query("SELECT r FROM Room r WHERE r.unit.id = :unitId ORDER BY r.number ASC")
    List<Room> findByUnitIdOrderByNumber(UUID unitId);
    /**
     * Find all rooms for a property
     */
    @Query("SELECT r FROM Room r WHERE r.property.id = :propertyId")
    List<Room> findByPropertyId(@Param("propertyId") UUID propertyId);

    /**
     * Find all rooms for a property with a specific status
     */
    @Query("SELECT r FROM Room r WHERE r.property.id = :propertyId AND r.status = :status")
    List<Room> findByPropertyIdAndStatus(
            @Param("propertyId") UUID propertyId,
            @Param("status") RoomStatus status
    );

    /**
     * Find all rooms for a unit
     */
    @Query("SELECT r FROM Room r WHERE r.unit.id = :unitId")
    List<Room> findByUnitId(@Param("unitId") UUID unitId);

    /**
     * Find all rooms for a unit with a specific status
     */
    @Query("SELECT r FROM Room r WHERE r.unit.id = :unitId AND r.status = :status")
    List<Room> findByUnitIdAndStatus(
            @Param("unitId") UUID unitId,
            @Param("status") RoomStatus status
    );

    /**
     * Find room by room number within a property
     */
    @Query("SELECT r FROM Room r WHERE r.number = :roomNumber AND r.property.id = :propertyId")
    Optional<Room> findByRoomNumberAndPropertyId(
            @Param("roomNumber") String roomNumber,
            @Param("propertyId") UUID propertyId
    );

    /**
     * Check if room number exists within a property
     */
    @Query("SELECT COUNT(r) > 0 FROM Room r WHERE r.number = :roomNumber AND r.property.id = :propertyId")
    boolean existsByRoomNumberAndPropertyId(
            @Param("roomNumber") String roomNumber,
            @Param("propertyId") UUID propertyId
    );


    /**
     * Find rooms by status
     */
    List<Room> findByStatus(RoomStatus status);

    /**
     * Count rooms by property
     */
    @Query("SELECT COUNT(r) FROM Room r WHERE r.property.id = :propertyId")
    long countByPropertyId(@Param("propertyId") UUID propertyId);

    /**
     * Count rooms by property and status
     */
    @Query("SELECT COUNT(r) FROM Room r WHERE r.property.id = :propertyId AND r.status = :status")
    long countByPropertyIdAndStatus(
            @Param("propertyId") UUID propertyId,
            @Param("status") RoomStatus status
    );
}

