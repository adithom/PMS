package com.adith.os.HMS.billing.folio.dto;

import com.adith.os.HMS.billing.folio.DiscountType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record FolioDiscountDto(
        @NotNull DiscountType discountType,
        @NotNull @Positive BigDecimal value
) {}
