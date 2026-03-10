package com.adith.os.HMS.security;

/**
 * Department/Role types for the hotel management system
 * Each role represents a department with specific access levels
 */
public enum Role {

    ADMIN,

    MANAGER,

    FRONTDESK,

    HOUSEKEEPING,

    AGENCY,

    POS;

    public String getDisplayName() {
        return switch (this) {
            case ADMIN -> "Administrator";
            case MANAGER -> "Manager";
            case FRONTDESK -> "Front Desk";
            case HOUSEKEEPING -> "Housekeeping";
            case AGENCY -> "Agency";
            case POS -> "Point of Sale";
        };
    }

    public String getDescription() {
        return switch (this) {
            case ADMIN -> "Full system access and user management";
            case MANAGER -> "Property and operations management";
            case FRONTDESK -> "Guest services and check-in/out operations";
            case HOUSEKEEPING -> "Room maintenance and cleaning management";
            case AGENCY -> "External booking and reservation access";
            case POS -> "Payment and billing operations";
        };
    }
}