package com.adith.os.HMS.travelagent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TravelAgentRepository extends JpaRepository<TravelAgent, UUID> {

    boolean existsByEmail(String email);

    Optional<TravelAgent> findByEmail(String email);

    List<TravelAgent> findAllByOrderByNameAsc();
    List<TravelAgent> findAllByActiveOrderByNameAsc(boolean active);

    boolean existsByEmailAndIdNot(String email, UUID id);

    @Query("SELECT ta FROM TravelAgent ta WHERE " +
           "LOWER(ta.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(ta.email) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY ta.name ASC")
    List<TravelAgent> searchTravelAgents(@Param("search") String search);
}
