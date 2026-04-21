package com.adith.os.HMS.property.mealplan;

import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "property_meal_plan", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"property_id", "meal_plan_type"})
})
public class PropertyMealPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Enumerated(EnumType.STRING)
    @Column(name = "meal_plan_type", nullable = false)
    private MealPlanType mealPlanType;

    @Column(name = "price_per_night", precision = 10, scale = 2, nullable = false)
    private BigDecimal pricePerNight;

    @Column(name = "children_price_per_night", precision = 10, scale = 2,
            columnDefinition = "numeric(10,2) default 0")
    private BigDecimal childrenPricePerNight = BigDecimal.ZERO;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    @Column(name = "created_at", nullable = false, columnDefinition = "timestamp with time zone default now()")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public PropertyMealPlan() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Property getProperty() { return property; }
    public void setProperty(Property property) { this.property = property; }

    public MealPlanType getMealPlanType() { return mealPlanType; }
    public void setMealPlanType(MealPlanType mealPlanType) { this.mealPlanType = mealPlanType; }

    public BigDecimal getPricePerNight() { return pricePerNight; }
    public void setPricePerNight(BigDecimal pricePerNight) { this.pricePerNight = pricePerNight; }

    public BigDecimal getChildrenPricePerNight() { return childrenPricePerNight; }
    public void setChildrenPricePerNight(BigDecimal childrenPricePerNight) { this.childrenPricePerNight = childrenPricePerNight; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
