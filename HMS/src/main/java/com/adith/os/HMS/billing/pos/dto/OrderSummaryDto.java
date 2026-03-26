package com.adith.os.HMS.billing.pos.dto;

import java.math.BigDecimal;

public record OrderSummaryDto(
        long orderCount,
        BigDecimal totalRevenue,
        BigDecimal avgOrderValue) {
}
