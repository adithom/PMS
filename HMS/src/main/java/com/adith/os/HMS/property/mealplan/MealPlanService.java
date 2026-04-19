package com.adith.os.HMS.property.mealplan;

import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.property.mealplan.dto.MealPlanCreationDto;
import com.adith.os.HMS.property.mealplan.dto.MealPlanDto;
import com.adith.os.HMS.property.mealplan.dto.MealPlanUpdateDto;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class MealPlanService {

    private final PropertyMealPlanRepository mealPlanRepository;
    private final PropertyRepository propertyRepository;
    private final MealPlanMapper mealPlanMapper;

    public MealPlanService(PropertyMealPlanRepository mealPlanRepository,
                           PropertyRepository propertyRepository,
                           MealPlanMapper mealPlanMapper) {
        this.mealPlanRepository = mealPlanRepository;
        this.propertyRepository = propertyRepository;
        this.mealPlanMapper = mealPlanMapper;
    }

    public List<MealPlanDto> getMealPlans(UUID propertyId) {
        validatePropertyExists(propertyId);
        return mealPlanMapper.toDtoList(mealPlanRepository.findByPropertyId(propertyId));
    }

    public MealPlanDto getMealPlan(UUID propertyId, UUID id) {
        validatePropertyExists(propertyId);
        PropertyMealPlan plan = mealPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found: " + id));
        if (!plan.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found for this property");
        }
        return mealPlanMapper.toDto(plan);
    }

    public MealPlanDto getMealPlanByType(UUID propertyId, MealPlanType type) {
        validatePropertyExists(propertyId);
        return mealPlanRepository.findByPropertyIdAndMealPlanType(propertyId, type)
                .map(mealPlanMapper::toDto)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Meal plan " + type + " not configured for this property"));
    }

    @Transactional
    public MealPlanDto createMealPlan(UUID propertyId, @Valid MealPlanCreationDto dto) {
        var property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        if (mealPlanRepository.existsByPropertyIdAndMealPlanType(propertyId, dto.mealPlanType())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Meal plan " + dto.mealPlanType() + " already exists for this property. Use PUT/PATCH to update it.");
        }

        PropertyMealPlan plan = new PropertyMealPlan();
        plan.setProperty(property);
        plan.setMealPlanType(dto.mealPlanType());
        plan.setPricePerNight(dto.pricePerNight());
        plan.setChildrenPricePerNight(dto.childrenPricePerNight() != null ? dto.childrenPricePerNight() : java.math.BigDecimal.ZERO);
        plan.setActive(dto.active() == null ? true : dto.active());

        return mealPlanMapper.toDto(mealPlanRepository.save(plan));
    }

    @Transactional
    public MealPlanDto updateMealPlan(UUID propertyId, UUID id, @Valid MealPlanUpdateDto dto) {
        validatePropertyExists(propertyId);
        PropertyMealPlan plan = mealPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found: " + id));
        if (!plan.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found for this property");
        }
        if (dto.pricePerNight() != null) {
            plan.setPricePerNight(dto.pricePerNight());
        }
        if (dto.childrenPricePerNight() != null) {
            plan.setChildrenPricePerNight(dto.childrenPricePerNight());
        }
        if (dto.active() != null) {
            plan.setActive(dto.active());
        }
        return mealPlanMapper.toDto(mealPlanRepository.save(plan));
    }

    @Transactional
    public void deleteMealPlan(UUID propertyId, UUID id) {
        validatePropertyExists(propertyId);
        PropertyMealPlan plan = mealPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found: " + id));
        if (!plan.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal plan not found for this property");
        }
        mealPlanRepository.delete(plan);
    }

    private void validatePropertyExists(UUID propertyId) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }
    }
}
