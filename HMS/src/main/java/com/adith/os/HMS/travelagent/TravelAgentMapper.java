package com.adith.os.HMS.travelagent;

import com.adith.os.HMS.travelagent.dto.TravelAgentCreationDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentDto;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class TravelAgentMapper {

    public TravelAgent toEntity(TravelAgentCreationDto dto) {
        if (dto == null) return null;
        TravelAgent agent = new TravelAgent();
        agent.setName(dto.name().trim());
        agent.setContactPerson(dto.contactPerson() != null ? dto.contactPerson().trim() : null);
        agent.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        agent.setPhone(dto.phone());
        agent.setIataCode(dto.iataCode() != null ? dto.iataCode().trim().toUpperCase() : null);
        agent.setCommissionRate(dto.commissionRate());
        agent.setAddress(dto.address());
        return agent;
    }

    public TravelAgentDto toDto(TravelAgent agent) {
        if (agent == null) return null;
        return new TravelAgentDto(
                agent.getId(),
                agent.getName(),
                agent.getContactPerson(),
                agent.getEmail(),
                agent.getPhone(),
                agent.getIataCode(),
                agent.getCommissionRate(),
                agent.isActive(),
                agent.getAddress(),
                agent.getCreatedAt(),
                agent.getUpdatedAt()
        );
    }

    public List<TravelAgentDto> toDtoList(List<TravelAgent> agents) {
        if (agents == null || agents.isEmpty()) return List.of();
        return agents.stream().map(this::toDto).collect(Collectors.toList());
    }
}
