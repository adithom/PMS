package com.adith.os.HMS.property;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PropertyRepository extends JpaRepository<Property, UUID>, JpaSpecificationExecutor<Property> {

    Optional<Property> findByCode(String code);

    List<Property> findByCountry(String country);

    List<Property> findByRegion(String region);

    List<Property> findByNameContainingIgnoreCase(String name);

    @Query("SELECT p FROM Property p JOIN p.rooms r WHERE r.status = :status")
    List<Property> findPropertiesWithRoomStatus(@Param("status") String status);

    @Query("SELECT p FROM Property p WHERE p.totalRooms >= :minRooms")
    List<Property> findPropertiesWithMinimumRooms(@Param("minRooms") Integer minRooms);

    boolean existsByCode(String code);

    @Modifying
    @Query("UPDATE Property p SET p.totalRooms = (SELECT COUNT(r) FROM Room r WHERE r.property.id = :propertyId) WHERE p.id = :propertyId")
    void updateTotalRooms(@Param("propertyId") UUID propertyId);
}
