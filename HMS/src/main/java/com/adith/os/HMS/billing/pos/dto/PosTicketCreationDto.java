package com.adith.os.HMS.billing.pos.dto;

import com.adith.os.HMS.billing.pos.MealType;

import java.util.UUID;

public record PosTicketCreationDto(
        UUID posLocationId,
        UUID bookingId,
        String guestName,
        MealType mealType
) {
}
