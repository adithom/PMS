package com.adith.os.HMS.guest;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository extends JpaRepository<Guest, UUID> {

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    boolean existsByIdNumber(String docId);

    Optional<Guest> findByEmail(String email);

    Optional<Guest> findByPhone(String phone);

    Optional<Guest> findByIdNumber(String docId);

    List<Guest> findAllByOrderByLastNameAscFirstNameAsc();

    @Query("SELECT g FROM Guest g WHERE " +
            "LOWER(g.firstName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.lastName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "g.phone LIKE CONCAT('%', :search, '%') OR " +
            "g.idNumber LIKE CONCAT('%', :search, '%') " +
            "ORDER BY g.lastName ASC, g.firstName ASC")
    List<Guest> searchGuests(@Param("search") String search);
}
