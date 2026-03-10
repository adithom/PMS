package com.adith.os.HMS.room;

import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.room.dto.RoomCreationDto;
import com.adith.os.HMS.room.dto.RoomDto;
import com.adith.os.HMS.unit.Unit;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class RoomMapper {

    public Room toEntity(@Valid RoomCreationDto roomCreationDto, Property property, Unit unit) {
        if (roomCreationDto == null) return null;
        if (property == null) throw new IllegalArgumentException("Property is required");

        String number = roomCreationDto.number() != null ? roomCreationDto.number().trim() : null;
        if (number == null || number.isEmpty()) {
            throw new IllegalArgumentException("Room number cannot be blank");
        }

        String type = roomCreationDto.type() != null ? roomCreationDto.type().trim() : null;

        Room room = new Room();
        room.setProperty(property);
        room.setUnit(unit);
        room.setNumber(number);
        room.setType(type);
        room.setCapacity(roomCreationDto.capacity());
        room.setBaseRate(roomCreationDto.baseRate());
        room.setStatus(roomCreationDto.status());
        room.setLastMaintained(roomCreationDto.lastMaintained());

        return room;
    }

    public RoomDto toDto(Room room) {
        if (room == null) return null;

        return new RoomDto(
                room.getId(),
                room.getProperty().getCode(),
                room.getUnit() != null ? room.getUnit().getName() : null,
                room.getNumber(),
                room.getType(),
                room.getCapacity(),
                room.getBaseRate(),
                room.getStatus(),
                room.getLastMaintained()
        );
    }

    public List<RoomDto> toDtoList(List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }

        return rooms.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}
