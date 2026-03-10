package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;

import java.math.BigDecimal;
import java.util.List;

public class BillTotalCalculator {

    public static BillTotals calculate(List<ChargeDto> charges) {

        BigDecimal subtotal = charges.stream()
                .map(ChargeDto::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal tax = charges.stream()
                .map(ChargeDto::taxAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal discount = charges.stream()
                .map(ChargeDto::discountAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal total = charges.stream()
                .map(ChargeDto::totalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new BillTotals(subtotal, tax, discount, total);
    }

    public record BillTotals(
            BigDecimal subtotal,
            BigDecimal tax,
            BigDecimal discount,
            BigDecimal total
    ) {}
}