package com.adith.os.HMS.room;


import com.adith.os.HMS.room.dto.RoomCreationDto;
import com.adith.os.HMS.room.dto.RoomDto;
import com.adith.os.HMS.room.dto.RoomUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/properties/{propertyId}/rooms")
public class RoomController {
    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    // CREATE
    @PostMapping()
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<RoomDto> createRoom(
            @PathVariable UUID propertyId,
            @Valid @RequestBody RoomCreationDto roomCreationDto) {
        try {
            RoomDto createdRoom = roomService.createRoom(roomCreationDto, propertyId);
            return new ResponseEntity<>(createdRoom, HttpStatus.CREATED);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    // READ
    @GetMapping("/{id}")
    public ResponseEntity<RoomDto> getRoomById(@PathVariable UUID id) {
        RoomDto roomDto = roomService.getRoomById(id);
        return ResponseEntity.ok(roomDto);
    }

    @GetMapping("/number/{number}")
    public ResponseEntity<RoomDto> getRoomByNumber(
            @PathVariable UUID propertyId,
            @PathVariable String number) {
        RoomDto roomDto = roomService.getRoomByNumber(propertyId, number);
        return ResponseEntity.ok(roomDto);
    }

    @GetMapping
    public ResponseEntity<List<RoomDto>> getAllRoomsForProperty(@PathVariable UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        List<RoomDto> rooms = roomService.getRoomsByProperty(propertyId);
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/unit/{unitId}")
    public ResponseEntity<List<RoomDto>> getAllRoomsByUnit(
            @PathVariable UUID propertyId,
            @PathVariable UUID unitId) {
        List<RoomDto> rooms = roomService.getRoomsByUnit(propertyId, unitId);
        return ResponseEntity.ok(rooms);
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<RoomDto>> getRoomsByStatus(
            @PathVariable UUID propertyId,
            @PathVariable RoomStatus status) {
        List<RoomDto> rooms = roomService.getRoomsByStatus(propertyId, status);
        return ResponseEntity.ok(rooms);
    }

    // UPDATE
    @PutMapping("/{id}")
    public ResponseEntity<RoomDto> updateRoom(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @Valid @RequestBody RoomUpdateDto roomUpdateDto) {
        RoomDto updatedRoom = roomService.updateRoom(propertyId, id, roomUpdateDto);
        return ResponseEntity.ok(updatedRoom);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<RoomDto> partialUpdateRoom(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestBody RoomUpdateDto roomUpdateDto) {
        RoomDto updatedRoom = roomService.partialUpdateRoom(propertyId, id, roomUpdateDto);
        return ResponseEntity.ok(updatedRoom);
    }

    // DELETE
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        roomService.deleteRoom(propertyId, id);
        return ResponseEntity.noContent().build();
    }

}
