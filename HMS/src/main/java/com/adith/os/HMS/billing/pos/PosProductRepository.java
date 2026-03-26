package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PosProductRepository extends JpaRepository<PosProduct, UUID> {
    List<PosProduct> findByPosLocationId(UUID posLocationId);

    List<PosProduct> findByCategoryId(UUID categoryId);

    boolean existsByCategoryId(UUID categoryId);
}
