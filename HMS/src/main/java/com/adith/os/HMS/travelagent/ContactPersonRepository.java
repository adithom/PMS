package com.adith.os.HMS.travelagent;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContactPersonRepository extends JpaRepository<ContactPerson, UUID> {
    List<ContactPerson> findByTravelAgentId(UUID travelAgentId);
}
