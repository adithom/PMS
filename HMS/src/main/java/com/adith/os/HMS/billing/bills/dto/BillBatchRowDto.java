package com.adith.os.HMS.billing.bills.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record BillBatchRowDto(
        UUID batchId,
        String mainInvoiceNumber,
        LocalDate billDate,
        String propertyName,
        String guestName,
        BigDecimal grandTotal,
        boolean isVoided,
        List<UUID> billIds
) {}
