package com.adith.os.HMS.property.mealplan.dto;

import com.adith.os.HMS.property.mealplan.MealPlanType;

import java.math.BigDecimal;
import java.util.UUID;

public record MealPlanDto(
        UUID id,
        UUID propertyId,
        MealPlanType mealPlanType,
        String displayName,
        BigDecimal pricePerNight,
        BigDecimal childrenPricePerNight,
        boolean active
) {}
