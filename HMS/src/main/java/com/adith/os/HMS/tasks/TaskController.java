package com.adith.os.HMS.tasks;

import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.guest.dto.GuestDto;
import com.adith.os.HMS.room.dto.RoomDto;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("/maintenance")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<RoomDto>> getMaintenanceRooms(@PathVariable UUID propertyId) {
        return ResponseEntity.ok(taskService.getRoomsInMaintenance(propertyId));
    }

    @GetMapping("/birthdays")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<GuestDto>> getBirthdays(@PathVariable UUID propertyId) {
        return ResponseEntity.ok(taskService.getInHouseGuestBirthdays(propertyId));
    }

    @GetMapping("/unassigned")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<BookingDto>> getUnassignedCheckins(@PathVariable UUID propertyId) {
        return ResponseEntity.ok(taskService.getUnassignedUpcomingCheckins(propertyId));
    }
}
