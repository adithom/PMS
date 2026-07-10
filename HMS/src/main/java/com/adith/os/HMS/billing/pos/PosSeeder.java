package com.adith.os.HMS.billing.pos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Component
public class PosSeeder {

    private static final Logger log = LoggerFactory.getLogger(PosSeeder.class);
    private static final String CHEFS_SPECIAL_NAME = "Chef's Special";

    private final PosLocationRepository locationRepository;
    private final PosProductRepository productRepository;

    public PosSeeder(PosLocationRepository locationRepository, PosProductRepository productRepository) {
        this.locationRepository = locationRepository;
        this.productRepository  = productRepository;
    }

    @Transactional
    public void seedChefsSpecial() {
        List<PosLocation> restaurants = locationRepository.findAll().stream()
                .filter(l -> l.getLocationType() == PosLocationType.RESTAURANT && l.isActive())
                .toList();

        for (PosLocation location : restaurants) {
            boolean exists = productRepository.findByPosLocationId(location.getId()).stream()
                    .anyMatch(PosProduct::isPriceOverridable);
            if (!exists) {
                createChefsSpecial(location);
                log.info("[PosSeeder] Created '{}' for location '{}'", CHEFS_SPECIAL_NAME, location.getName());
            }
        }
    }

    @Transactional
    public void createChefsSpecialForLocation(PosLocation location) {
        if (location.getLocationType() != PosLocationType.RESTAURANT) return;
        boolean exists = productRepository.findByPosLocationId(location.getId()).stream()
                .anyMatch(PosProduct::isPriceOverridable);
        if (!exists) {
            createChefsSpecial(location);
            log.info("[PosSeeder] Created '{}' for new location '{}'", CHEFS_SPECIAL_NAME, location.getName());
        }
    }

    private void createChefsSpecial(PosLocation location) {
        PosProduct product = new PosProduct();
        product.setPosLocation(location);
        product.setName(CHEFS_SPECIAL_NAME);
        product.setCode("CHEFS-" + location.getId().toString().substring(0, 8).toUpperCase());
        product.setDescription("Custom dish — price set at the time of order");
        product.setPrice(BigDecimal.ZERO);
        product.setTaxRate(location.getDefaultTaxRate() != null ? location.getDefaultTaxRate() : BigDecimal.ZERO);
        product.setAvailable(true);
        product.setPriceOverridable(true);
        productRepository.save(product);
    }
}
