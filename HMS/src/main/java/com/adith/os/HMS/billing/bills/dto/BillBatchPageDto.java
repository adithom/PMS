package com.adith.os.HMS.billing.bills.dto;

import java.math.BigDecimal;
import java.util.List;

public record BillBatchPageDto(
        List<BillBatchRowDto> batches,
        int totalCount,
        BigDecimal grandTotalSum
) {}
