package com.adith.os.HMS.property.mealplan;

import com.adith.os.HMS.property.mealplan.dto.MealPlanCreationDto;
import com.adith.os.HMS.property.mealplan.dto.MealPlanDto;
import com.adith.os.HMS.property.mealplan.dto.MealPlanUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/meal-plans")
public class MealPlanController {

    private final MealPlanService mealPlanService;

    public MealPlanController(MealPlanService mealPlanService) {
        this.mealPlanService = mealPlanService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public List<MealPlanDto> getMealPlans(@PathVariable UUID propertyId) {
        return mealPlanService.getMealPlans(propertyId);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public MealPlanDto getMealPlan(@PathVariable UUID propertyId, @PathVariable UUID id) {
        return mealPlanService.getMealPlan(propertyId, id);
    }

    @GetMapping("/type/{mealPlanType}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public MealPlanDto getMealPlanByType(@PathVariable UUID propertyId,
                                         @PathVariable MealPlanType mealPlanType) {
        return mealPlanService.getMealPlanByType(propertyId, mealPlanType);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public MealPlanDto createMealPlan(@PathVariable UUID propertyId,
                                       @Valid @RequestBody MealPlanCreationDto dto) {
        return mealPlanService.createMealPlan(propertyId, dto);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public MealPlanDto updateMealPlan(@PathVariable UUID propertyId,
                                       @PathVariable UUID id,
                                       @Valid @RequestBody MealPlanUpdateDto dto) {
        return mealPlanService.updateMealPlan(propertyId, id, dto);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public MealPlanDto patchMealPlan(@PathVariable UUID propertyId,
                                      @PathVariable UUID id,
                                      @RequestBody MealPlanUpdateDto dto) {
        return mealPlanService.updateMealPlan(propertyId, id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteMealPlan(@PathVariable UUID propertyId, @PathVariable UUID id) {
        mealPlanService.deleteMealPlan(propertyId, id);
    }
}
