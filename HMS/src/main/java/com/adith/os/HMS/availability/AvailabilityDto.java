package com.adith.os.HMS.availability;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * All DTOs for Availability API responses
 */

// 1. Available room details
record AvailableRoomDto(
        UUID roomId,
        String roomNumber,
        Integer capacity,
        BigDecimal baseRate,
        String unitName,
        String status
) {}

// 2. Check specific room availability
record RoomAvailabilityCheckDto(
        UUID roomId,
        String roomNumber,
        boolean isAvailable,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkIn,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkOut,
        String reason  // "AVAILABLE", "BOOKED", "IN_MAINTENANCE", etc.
) {}

// 3. Comprehensive availability response (main search endpoint)
record AvailabilitySearchDto(
        UUID propertyId,
        String propertyName,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkIn,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkOut,
        int totalActiveRooms,
        int availableRooms,
        int bookedRooms,
        boolean hasAvailability,
        List<AvailableRoomDto> availableRoomsList
) {}

// 5. Availability by unit
record UnitAvailabilityDto(
        UUID unitId,
        String unitName,
        int totalRooms,
        int availableRooms,
        int bookedRooms,
        double occupancyRate,
        List<AvailableRoomDto> availableRoomsList
) {}

// 6. Daily availability for calendar view
record DailyAvailabilityDto(
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate date,
        String dayOfWeek,
        int totalActiveRooms,
        int availableRooms,
        int bookedRooms,
        int inMaintenanceRooms,
        double occupancyRate,
        List<AvailableRoomDto> availableRoomsList
) {}

// 7. Occupancy report for a single date
record OccupancyReportDto(
        UUID propertyId,
        String propertyName,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate reportDate,
        int totalRooms,
        int activeRooms,
        int bookedRooms,
        int availableRooms,
        int inMaintenanceRooms,
        int inactiveRooms,
        double occupancyRate,
        List<BookedRoomDto> bookedRoomsList
) {}

// 8. Occupancy report for time period
record PeriodOccupancyReportDto(
        UUID propertyId,
        String propertyName,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate startDate,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate endDate,
        int totalDays,
        long totalRoomNights,           // Total possible room-nights
        long bookedRoomNights,          // Actually booked room-nights
        double averageOccupancyRate,
        int peakOccupiedRooms,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate peakOccupancyDate,
        List<DailyAvailabilityDto> dailyBreakdown
) {}

// 9. Booked room info for occupancy reports
record BookedRoomDto(
        UUID roomId,
        String roomNumber,
        UUID bookingId,
        String guestName,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkIn,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate checkOut,
        String bookingStatus
) {}

// 10. Unit occupancy report
record UnitOccupancyReportDto(
        UUID unitId,
        String unitName,
        @JsonFormat(pattern = "yyyy-MM-dd")
        LocalDate reportDate,
        int totalRooms,
        int activeRooms,
        int bookedRooms,
        int availableRooms,
        double occupancyRate,
        List<BookedRoomDto> bookedRoomsList
) {}