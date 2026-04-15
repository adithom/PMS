package com.adith.os.HMS.property.mealplan.dto;

import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record MealPlanUpdateDto(
        @Positive(message = "Price per night must be positive")
        BigDecimal pricePerNight,

        Boolean active  // null = no change
) {}
