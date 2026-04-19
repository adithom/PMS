package com.adith.os.HMS.property.mealplan.dto;

import com.adith.os.HMS.property.mealplan.MealPlanType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record MealPlanCreationDto(
        @NotNull(message = "Meal plan type is required")
        MealPlanType mealPlanType,

        @NotNull(message = "Price per night is required")
        @Positive(message = "Price per night must be positive")
        BigDecimal pricePerNight,

        @PositiveOrZero(message = "Children price per night cannot be negative")
        BigDecimal childrenPricePerNight,

        Boolean active  // defaults to true if null
) {}
