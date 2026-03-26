package com.adith.os.HMS.billing.pos.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PosItemCategoryCreationDto(
        @NotNull UUID locationId,
        @NotBlank String name,
        Integer displayOrder) {
}
