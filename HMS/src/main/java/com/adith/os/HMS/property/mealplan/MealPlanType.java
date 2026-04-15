package com.adith.os.HMS.property.mealplan;

public enum MealPlanType {
    CP,   // Continental Plan — breakfast only
    MAP,  // Modified American Plan — breakfast + lunch or dinner
    AP;   // All Inclusive — all meals

    public String getDisplayName() {
        return switch (this) {
            case CP -> "Continental Plan";
            case MAP -> "Modified American Plan";
            case AP -> "All Inclusive";
        };
    }
}
