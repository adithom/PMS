package com.adith.os.HMS.booking;

public enum BookingStatus {
    PENDING,        // Initial booking, awaiting confirmation
    CONFIRMED,      // Booking confirmed, awaiting check-in
    CHECKED_IN,     // Guest has checked in
    CHECKED_OUT,    // Guest has checked out
    CANCELLED,      // Booking cancelled
    NO_SHOW         // Guest didn't show up
}
