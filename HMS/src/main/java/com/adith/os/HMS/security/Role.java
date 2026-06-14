package com.adith.os.HMS.security;

public enum Role {

    ADMIN,

    MANAGER,

    HOUSEKEEPING,

    POS;

    public String getDisplayName() {
        return switch (this) {
            case ADMIN -> "Administrator";
            case MANAGER -> "Manager";
            case HOUSEKEEPING -> "Housekeeping";
            case POS -> "Point of Sale";
        };
    }

    public String getDescription() {
        return switch (this) {
            case ADMIN -> "Full system access and user management";
            case MANAGER -> "Property and operations management";
            case HOUSEKEEPING -> "Room maintenance and cleaning management";
            case POS -> "Payment and billing operations";
        };
    }
}