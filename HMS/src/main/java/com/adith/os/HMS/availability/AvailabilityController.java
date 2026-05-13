package com.adith.os.HMS.availability;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/availability")
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    public AvailabilityController(AvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    /**
     * 1. SEARCH AVAILABLE ROOMS FOR PROPERTY
     * GET /api/availability/properties/{propertyId}?checkIn=2025-11-01&checkOut=2025-11-05
     */
    @GetMapping("/properties/{propertyId}")
    public ResponseEntity<AvailabilitySearchDto> searchAvailableRooms(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut
    ) {
        AvailabilitySearchDto result = availabilityService.searchAvailableRooms(propertyId, checkIn, checkOut);
        return ResponseEntity.ok(result);
    }

    /**
     * 2. CHECK SPECIFIC ROOM AVAILABILITY
     * GET /api/availability/rooms/{roomId}?checkIn=2025-11-01&checkOut=2025-11-05
     */
    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<RoomAvailabilityCheckDto> checkRoomAvailability(
            @PathVariable UUID roomId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut
    ) {
        RoomAvailabilityCheckDto result = availabilityService.checkRoomAvailability(roomId, checkIn, checkOut);
        return ResponseEntity.ok(result);
    }

    /**
     * 3. GET DAILY AVAILABILITY (Calendar View)
     * GET /api/availability/properties/{propertyId}/daily?startDate=2025-11-01&endDate=2025-11-30
     */
    @GetMapping("/properties/{propertyId}/daily")
    public ResponseEntity<List<DailyAvailabilityDto>> getDailyAvailability(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        List<DailyAvailabilityDto> result = availabilityService.getDailyAvailability(propertyId, startDate, endDate);
        return ResponseEntity.ok(result);
    }

    /**
     * 4. GET OCCUPANCY REPORT FOR SPECIFIC DATE
     * GET /api/availability/properties/{propertyId}/occupancy?date=2025-11-15
     */
    @GetMapping("/properties/{propertyId}/occupancy")
    public ResponseEntity<OccupancyReportDto> getOccupancyReport(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        OccupancyReportDto result = availabilityService.getOccupancyReport(propertyId, date);
        return ResponseEntity.ok(result);
    }

    /**
     * 5. GET OCCUPANCY REPORT FOR TIME PERIOD
     * GET /api/availability/properties/{propertyId}/occupancy/period?startDate=2025-11-01&endDate=2025-11-30
     */
    @GetMapping("/properties/{propertyId}/occupancy/period")
    public ResponseEntity<PeriodOccupancyReportDto> getPeriodOccupancyReport(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        PeriodOccupancyReportDto result = availabilityService.getPeriodOccupancyReport(propertyId, startDate, endDate);
        return ResponseEntity.ok(result);
    }

    /**
     * 6. SEARCH AVAILABLE ROOMS BY UNIT
     * GET /api/availability/units/{unitId}?checkIn=2025-11-01&checkOut=2025-11-05
     */
    @GetMapping("/units/{unitId}")
    public ResponseEntity<List<AvailableRoomDto>> searchAvailableRoomsByUnit(
            @PathVariable UUID unitId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut
    ) {
        List<AvailableRoomDto> result = availabilityService.searchAvailableRoomsByUnit(unitId, checkIn, checkOut);
        return ResponseEntity.ok(result);
    }

    /**
     * 7. GET UNIT OCCUPANCY REPORT
     * GET /api/availability/units/{unitId}/occupancy?date=2025-11-15
     */
    @GetMapping("/units/{unitId}/occupancy")
    public ResponseEntity<UnitOccupancyReportDto> getUnitOccupancyReport(
            @PathVariable UUID unitId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        UnitOccupancyReportDto result = availabilityService.getUnitOccupancyReport(unitId, date);
        return ResponseEntity.ok(result);
    }

    /**
     * 8. TAPE CHART (with optional ghost-fill for unassigned bookings)
     * GET /api/availability/properties/{propertyId}/tape-chart?from=2026-05-08&to=2026-05-15&includeGhosts=true
     *
     * Returns rooms, real assignments overlapping the window, and (if includeGhosts=true)
     * deterministic first-fit ghost placements for unassigned bookings within their unit.
     * Ghosts are not persisted — recomputed every call.
     */
    @GetMapping("/properties/{propertyId}/tape-chart")
    public ResponseEntity<TapeChartDto> getTapeChart(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "false") boolean includeGhosts
    ) {
        TapeChartDto result = availabilityService.getTapeChart(propertyId, from, to, includeGhosts);
        return ResponseEntity.ok(result);
    }
}
