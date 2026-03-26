package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "pos_location", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"property_id", "code"})
})
public class PosLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @NotBlank
    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 20)
    private String code;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "location_type", nullable = false, length = 50)
    private PosLocationType locationType;

    @Column(name = "is_active")
    private boolean isActive = true;

    @NotNull
    @Column(name = "default_tax_rate", precision = 5, scale = 2, nullable = false)
    private BigDecimal defaultTaxRate = BigDecimal.ZERO;

    @Column(name = "service_charge_rate", precision = 5, scale = 2)
    private BigDecimal serviceChargeRate = BigDecimal.ZERO;

    @Column(name = "opening_time")
    private LocalTime openingTime;

    @Column(name = "closing_time")
    private LocalTime closingTime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_walk_in_folio_id")
    private Folio currentWalkInFolio;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public PosLocation() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Property getProperty() {
        return property;
    }

    public void setProperty(Property property) {
        this.property = property;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public PosLocationType getLocationType() {
        return locationType;
    }

    public void setLocationType(PosLocationType locationType) {
        this.locationType = locationType;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public BigDecimal getDefaultTaxRate() {
        return defaultTaxRate;
    }

    public void setDefaultTaxRate(BigDecimal defaultTaxRate) {
        this.defaultTaxRate = defaultTaxRate;
    }

    public BigDecimal getServiceChargeRate() {
        return serviceChargeRate;
    }

    public void setServiceChargeRate(BigDecimal serviceChargeRate) {
        this.serviceChargeRate = serviceChargeRate;
    }

    public LocalTime getOpeningTime() {
        return openingTime;
    }

    public void setOpeningTime(LocalTime openingTime) {
        this.openingTime = openingTime;
    }

    public LocalTime getClosingTime() {
        return closingTime;
    }

    public void setClosingTime(LocalTime closingTime) {
        this.closingTime = closingTime;
    }

    public Folio getCurrentWalkInFolio() {
        return currentWalkInFolio;
    }

    public void setCurrentWalkInFolio(Folio currentWalkInFolio) {
        this.currentWalkInFolio = currentWalkInFolio;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
