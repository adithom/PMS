package com.adith.os.HMS.roomassignment;

public enum RoomAssignmentStatus {
    SCHEDULED,   // Assignment created but guest hasn't occupied yet
    ACTIVE,      // Guest is currently occupying this room
    COMPLETED,   // Assignment finished (guest checked out or shifted)
    CANCELLED    // Assignment was cancelled
}
