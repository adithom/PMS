package com.adith.os.HMS.billing.folio.dto;

import jakarta.validation.constraints.NotNull;

public record ChargeRouteUpdateDto(
        @NotNull(message = "routeToMaster is required")
        Boolean routeToMaster
) {}
