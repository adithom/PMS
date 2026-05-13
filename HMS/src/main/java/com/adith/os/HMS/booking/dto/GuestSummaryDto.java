package com.adith.os.HMS.booking.dto;

import java.util.UUID;

public record GuestSummaryDto(UUID id, String fullName, String email, String phone) {}
