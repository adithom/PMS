package com.adith.os.HMS.billing.bills.dto;

import java.math.BigDecimal;
import java.util.List;

public record BillLedgerPageDto(
        List<BillDto> bills,
        int totalCount,
        BigDecimal grandTotalSum
) {}
