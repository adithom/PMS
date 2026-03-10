package com.adith.os.HMS.room;

public enum RoomStatus {
    ACTIVE,                 // Room is available for booking
    QUEUED_FOR_MAINTENANCE, // Scheduled for maintenance, don't book
    IN_MAINTENANCE,         // Currently being maintained
    INACTIVE                // Room is offline (renovation, permanent closure, etc.)
}
