package com.adith.os.HMS.billing.nightaudit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class NightAuditEventListener {

    private static final Logger log = LoggerFactory.getLogger(NightAuditEventListener.class);
    private final NightAuditLogRepository nightAuditLogRepository;

    public NightAuditEventListener(NightAuditLogRepository nightAuditLogRepository) {
        this.nightAuditLogRepository = nightAuditLogRepository;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onAuditCompleted(NightAuditCompletedEvent event) {
        NightAuditService.NightAuditResultDto r = event.result();
        nightAuditLogRepository.save(new NightAuditLog(
                event.auditDate(), event.runType(),
                r.totalAssignments(), r.chargesPosted(),
                r.skippedAlreadyPosted() + r.skippedFolioNotOpen() + r.skippedNoFolio(),
                r.errors(),
                r.mealPlanChargesPosted(), r.mealPlanChargesSkipped(),
                r.extraBedChargesPosted(), r.extraBedChargesSkipped(),
                event.errorSummary()
        ));
        log.info("Night Audit log persisted for {} ({})", event.auditDate(), event.runType());
    }
}
