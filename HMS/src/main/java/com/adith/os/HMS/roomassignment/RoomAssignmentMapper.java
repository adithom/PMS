package com.adith.os.HMS.roomassignment;

import com.adith.os.HMS.roomassignment.dto.RoomAssignmentDto;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class RoomAssignmentMapper {

    public RoomAssignmentDto toDto(RoomAssignment assignment) {
        if (assignment == null) return null;

        return new RoomAssignmentDto(
                assignment.getId(),
                assignment.getBooking().getId(),
                assignment.getRoom().getId(),
                assignment.getRoom().getNumber(),
                assignment.getRoom().getUnit() != null ? assignment.getRoom().getUnit().getName() : "N/A",
                assignment.getStartDate(),
                assignment.getEndDate(),
                assignment.getStatus(),
                assignment.getCreatedAt(),
                assignment.getNotes()
        );
    }

    public List<RoomAssignmentDto> toDtoList(List<RoomAssignment> assignments) {
        if (assignments == null || assignments.isEmpty()) {
            return List.of();
        }
        return assignments.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}
