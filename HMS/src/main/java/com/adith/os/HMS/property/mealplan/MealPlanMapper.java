package com.adith.os.HMS.property.mealplan;

import com.adith.os.HMS.property.mealplan.dto.MealPlanDto;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class MealPlanMapper {

    public MealPlanDto toDto(PropertyMealPlan plan) {
        if (plan == null) return null;
        return new MealPlanDto(
                plan.getId(),
                plan.getProperty().getId(),
                plan.getMealPlanType(),
                plan.getMealPlanType().getDisplayName(),
                plan.getPricePerNight(),
                plan.isActive()
        );
    }

    public List<MealPlanDto> toDtoList(List<PropertyMealPlan> plans) {
        if (plans == null || plans.isEmpty()) return List.of();
        return plans.stream().map(this::toDto).collect(Collectors.toList());
    }
}
