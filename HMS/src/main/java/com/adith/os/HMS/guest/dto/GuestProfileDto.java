package com.adith.os.HMS.guest.dto;

import java.util.List;

public record GuestProfileDto(
        GuestDto guest,
        List<GuestBookingSummaryDto> bookingHistory,
        List<GuestPosPreferenceDto> posPreferences
) {}
