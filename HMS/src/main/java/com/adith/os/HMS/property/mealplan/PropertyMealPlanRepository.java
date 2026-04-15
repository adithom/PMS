package com.adith.os.HMS.property.mealplan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PropertyMealPlanRepository extends JpaRepository<PropertyMealPlan, UUID> {
    List<PropertyMealPlan> findByPropertyId(UUID propertyId);
    Optional<PropertyMealPlan> findByPropertyIdAndMealPlanType(UUID propertyId, MealPlanType type);
    boolean existsByPropertyIdAndMealPlanType(UUID propertyId, MealPlanType type);
}
