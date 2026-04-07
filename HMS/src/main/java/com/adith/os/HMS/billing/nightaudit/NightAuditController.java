package com.adith.os.HMS.billing.nightaudit;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/night-audit")
public class NightAuditController {

    private final NightAuditService nightAuditService;
    private final NightAuditLogRepository nightAuditLogRepository;

    public NightAuditController(NightAuditService nightAuditService,
                                NightAuditLogRepository nightAuditLogRepository) {
        this.nightAuditService = nightAuditService;
        this.nightAuditLogRepository = nightAuditLogRepository;
    }

    /**
     * Manually run the full night audit for a specific audit date.
     * The audit date represents the night being charged; inventory is rolled
     * forward into the next business date automatically.
     */
    @PostMapping("/run")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<NightAuditService.NightAuditResultDto> runNightAudit(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        NightAuditService.NightAuditResultDto result = nightAuditService.runFullNightAuditForDate(date);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<NightAuditLog>> getHistory() {
        return ResponseEntity.ok(nightAuditLogRepository.findTop30ByOrderByRanAtDesc());
    }
}
