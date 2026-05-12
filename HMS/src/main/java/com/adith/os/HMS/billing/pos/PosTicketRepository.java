package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PosTicketRepository extends JpaRepository<PosTicket, UUID> {

    List<PosTicket> findByPosLocationIdAndStatus(UUID locationId, PosTicketStatus status);
}
