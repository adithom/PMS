package com.adith.os.HMS.roomassignment.dto;

import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RoomAssignmentDto(
        UUID id,
        UUID bookingId,
        UUID roomId,
        String roomNumber,
        String unitName,
        LocalDate startDate,
        LocalDate endDate,
        RoomAssignmentStatus status,
        OffsetDateTime createdAt,
        String notes
) {
}
