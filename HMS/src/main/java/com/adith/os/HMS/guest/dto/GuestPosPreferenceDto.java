package com.adith.os.HMS.guest.dto;

import java.util.UUID;

public record GuestPosPreferenceDto(
        UUID productId,
        String itemName,
        String category,
        long totalQuantity,
        long orderCount
) {}
