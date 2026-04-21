package com.adith.os.HMS.billing.nightaudit;

import java.time.LocalDate;

public record NightAuditCompletedEvent(
        LocalDate auditDate,
        String runType,
        NightAuditService.NightAuditResultDto result,
        String errorSummary
) {}
