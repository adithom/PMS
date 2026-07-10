package com.adith.os.HMS.reservation;

public enum ReservationStatus {
    PENDING,        // Created, awaiting confirmation
    CONFIRMED,      // Confirmed, awaiting check-in
    CHECKED_IN,     // All guests checked in
    CHECKED_OUT,    // Stay completed
    CANCELLED       // Reservation cancelled
}
