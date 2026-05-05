package com.adith.os.HMS.unit;

import jakarta.validation.constraints.NotBlank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UnitRepository extends JpaRepository<Unit, UUID> {
    boolean existsByName(@NotBlank String name);

    boolean existsByNameAndPropertyId(@NotBlank String name, UUID propertyId);

    Optional<Unit> findByName(String cleanName);

    Optional<Unit> findByNameAndPropertyId(String name, UUID propertyId);

    @Query("SELECT u FROM Unit u WHERE u.property.id = :propertyId ORDER BY u.sortOrder ASC, u.name ASC")
    List<Unit> findByPropertyIdOrderBySortOrder(UUID propertyId);

    @Modifying
    @Query("UPDATE Unit u SET u.totalRooms = (SELECT COUNT(r) FROM Room r WHERE r.unit.id = :unitId) WHERE u.id = :unitId")
    void updateTotalRooms(@Param("unitId") UUID unitId);
}
