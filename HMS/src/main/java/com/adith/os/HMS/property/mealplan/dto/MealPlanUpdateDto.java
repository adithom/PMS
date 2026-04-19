package com.adith.os.HMS.property.mealplan.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

public record MealPlanUpdateDto(
        @Positive(message = "Price per night must be positive")
        BigDecimal pricePerNight,

        @PositiveOrZero(message = "Children price per night cannot be negative")
        BigDecimal childrenPricePerNight,

        Boolean active  // null = no change
) {}
