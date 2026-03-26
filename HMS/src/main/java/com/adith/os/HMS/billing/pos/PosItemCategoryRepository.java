package com.adith.os.HMS.billing.pos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PosItemCategoryRepository extends JpaRepository<PosItemCategory, UUID> {

    List<PosItemCategory> findByPosLocationIdOrderByDisplayOrder(UUID locationId);

    List<PosItemCategory> findByPosLocationIdAndIsActiveTrueOrderByDisplayOrder(UUID locationId);
}
