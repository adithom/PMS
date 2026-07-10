package com.adith.os.HMS.billing.bills.dto;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record DownloadZipRequestDto(
        @Size(max = 150, message = "Maximum 150 bills per ZIP request")
        List<UUID> billIds,

        List<UUID> reservationIds
) {
    public DownloadZipRequestDto {
        if (billIds == null) billIds = List.of();
        if (reservationIds == null) reservationIds = List.of();
    }
}
