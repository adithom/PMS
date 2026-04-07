package com.adith.os.HMS.billing.nightaudit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NightAuditLogRepository extends JpaRepository<NightAuditLog, UUID> {

    List<NightAuditLog> findTop30ByOrderByRanAtDesc();

    Optional<NightAuditLog> findTopByAuditDateOrderByRanAtDesc(LocalDate auditDate);
}
