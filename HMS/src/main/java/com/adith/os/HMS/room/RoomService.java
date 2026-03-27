package com.adith.os.HMS.room;

import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.dto.RoomCreationDto;
import com.adith.os.HMS.room.dto.RoomDto;
import com.adith.os.HMS.room.dto.RoomUpdateDto;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class RoomService {
    private final PropertyRepository propertyRepository;
    private final UnitRepository unitRepository;
    private final RoomRepository roomRepository;
    private final RoomMapper roomMapper;

    public RoomService(PropertyRepository propertyRepository, UnitRepository unitRepository,
                       RoomRepository roomRepository, RoomMapper roomMapper) {
        this.propertyRepository = propertyRepository;
        this.unitRepository = unitRepository;
        this.roomRepository = roomRepository;
        this.roomMapper = roomMapper;
    }

    @Transactional
    public RoomDto createRoom(@Valid RoomCreationDto roomCreationDto, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        if (roomCreationDto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room creation data is required");
        }

        // Check if room number already exists for this property
        if (roomRepository.existsByPropertyIdAndNumber(propertyId, roomCreationDto.number())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Room with number " + roomCreationDto.number() + " already exists in this property");
        }

        // Unit is required
        if (roomCreationDto.unitId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit is required");
        }

        Unit unit = unitRepository.findById(roomCreationDto.unitId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        try {
            Room room = roomMapper.toEntity(roomCreationDto, property, unit);
            Room savedRoom = roomRepository.save(room);

            if (unit != null) {
                unitRepository.updateTotalRooms(unit.getId());
            }

            propertyRepository.updateTotalRooms(propertyId);

            return roomMapper.toDto(savedRoom);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create room: " + e.getMessage());
        }
    }

    public RoomDto getRoomById(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room id is required");
        }

        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + id));

        return roomMapper.toDto(room);
    }

    public RoomDto getRoomByNumber(UUID propertyId, String number) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (number == null || number.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room number is required");
        }

        String cleanNumber = number.trim();
        Room room = roomRepository.findByPropertyIdAndNumber(propertyId, cleanNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Room not found with number: " + cleanNumber));

        return roomMapper.toDto(room);
    }

    public List<RoomDto> getRoomsByProperty(UUID propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Room> rooms = roomRepository.findByPropertyIdOrderByNumber(propertyId);
            return roomMapper.toDtoList(rooms);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch rooms for property: " + e.getMessage());
        }
    }

    public List<RoomDto> getRoomsByUnit(UUID propertyId, UUID unitId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (unitId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit ID is required");
        }

        Unit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found: " + unitId));

        if (!unit.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unit does not belong to the specified property");
        }

        try {
            List<Room> rooms = roomRepository.findByUnitIdOrderByNumber(unitId);
            return roomMapper.toDtoList(rooms);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch rooms for unit: " + e.getMessage());
        }
    }

    public List<RoomDto> getRoomsByStatus(UUID propertyId, RoomStatus status) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        try {
            List<Room> rooms = roomRepository.findByPropertyIdAndStatus(propertyId, status);
            return roomMapper.toDtoList(rooms);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch rooms by status: " + e.getMessage());
        }
    }

    @Transactional
    public RoomDto updateRoom(UUID propertyId, UUID roomId, @Valid RoomUpdateDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (roomId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + roomId));

        if (!room.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the specified property");
        }

        // Validate required fields for full update
        if (dto.number() == null || dto.number().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room number is required for full update");
        }
        if (dto.type() == null || dto.type().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room type is required for full update");
        }
        if (dto.capacity() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Capacity is required for full update");
        }
        if (dto.baseRate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Base rate is required for full update");
        }
        if (dto.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required for full update");
        }

        // Check for duplicate room number (excluding current room)
        String cleanNumber = dto.number().trim();
        if (!cleanNumber.equals(room.getNumber()) &&
                roomRepository.existsByPropertyIdAndNumber(propertyId, cleanNumber)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Room with number '" + cleanNumber + "' already exists in this property");
        }

        // Validate unit if provided
        Unit oldUnit = room.getUnit();
        Unit unit = null;
        if (dto.unitId() != null) {
            unit = unitRepository.findById(dto.unitId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

            if (!unit.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unit does not belong to the specified property");
            }
        }

        try {
            // Full update (PUT semantics)
            room.setNumber(cleanNumber);
            room.setType(dto.type().trim());
            room.setCapacity(dto.capacity());
            room.setBaseRate(dto.baseRate());
            room.setStatus(dto.status());
            room.setUnit(unit);
            room.setLastMaintained(dto.lastMaintained());

            Room savedRoom = roomRepository.save(room);

            if (oldUnit != null && !oldUnit.equals(unit)) {
                unitRepository.updateTotalRooms(oldUnit.getId());
            }
            if (unit != null) {
                unitRepository.updateTotalRooms(unit.getId());
            }
            propertyRepository.updateTotalRooms(propertyId);

            return roomMapper.toDto(savedRoom);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update room: " + e.getMessage());
        }
    }

    @Transactional
    public RoomDto partialUpdateRoom(UUID propertyId, UUID roomId, RoomUpdateDto dto) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (roomId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + roomId));

        if (!room.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the specified property");
        }

        Unit oldUnit = room.getUnit();
        boolean unitChanged = false;

        try {
            // Partial update (PATCH semantics - only update provided fields)
            if (dto.number() != null && !dto.number().isBlank()) {
                String cleanNumber = dto.number().trim();
                if (!cleanNumber.equals(room.getNumber()) &&
                        roomRepository.existsByPropertyIdAndNumber(propertyId, cleanNumber)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Room with number '" + cleanNumber + "' already exists in this property");
                }
                room.setNumber(cleanNumber);
            }

            if (dto.type() != null && !dto.type().isBlank()) {
                room.setType(dto.type().trim());
            }

            if (dto.capacity() != null) {
                room.setCapacity(dto.capacity());
            }

            if (dto.baseRate() != null) {
                room.setBaseRate(dto.baseRate());
            }

            if (dto.status() != null) {
                room.setStatus(dto.status());
            }

            if (dto.unitId() != null) {
                Unit unit = unitRepository.findById(dto.unitId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found"));

                if (!unit.getProperty().getId().equals(propertyId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Unit does not belong to the specified property");
                }

                if (oldUnit == null || !oldUnit.getId().equals(unit.getId())) {
                    unitChanged = true;
                }

                room.setUnit(unit);
            }

            if (dto.lastMaintained() != null) {
                room.setLastMaintained(dto.lastMaintained());
            }

            Room savedRoom = roomRepository.save(room);

            if (unitChanged) {
                if (oldUnit != null) {
                    unitRepository.updateTotalRooms(oldUnit.getId());
                }
                if (room.getUnit() != null) {
                    unitRepository.updateTotalRooms(room.getUnit().getId());
                }
            }

            propertyRepository.updateTotalRooms(propertyId);

            return roomMapper.toDto(savedRoom);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to partially update room: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteRoom(UUID propertyId, UUID roomId) {
        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }
        if (roomId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room ID is required");
        }

        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found: " + propertyId);
        }

        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found: " + roomId));

        if (!room.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Room does not belong to the specified property");
        }

        Unit unit = room.getUnit();

        try {
            roomRepository.delete(room);
            if (unit != null) {
                unitRepository.updateTotalRooms(unit.getId());
            }
            propertyRepository.updateTotalRooms(propertyId);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to delete room: " + e.getMessage());
        }
    }
}
