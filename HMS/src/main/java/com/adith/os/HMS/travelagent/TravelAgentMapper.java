package com.adith.os.HMS.travelagent;

import com.adith.os.HMS.travelagent.dto.ContactPersonDto;
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
        agent.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        agent.setPhone(dto.phone());
        agent.setGstin(dto.gstin() != null ? dto.gstin().trim().toUpperCase() : null);
        agent.setAddress(dto.address());
        return agent;
    }

    public TravelAgentDto toDto(TravelAgent agent) {
        if (agent == null) return null;
        List<ContactPersonDto> contacts = agent.getContactPersons() == null ? List.of() :
                agent.getContactPersons().stream()
                        .map(this::toContactPersonDto)
                        .collect(Collectors.toList());
        return new TravelAgentDto(
                agent.getId(),
                agent.getName(),
                agent.getEmail(),
                agent.getPhone(),
                agent.getGstin(),
                agent.isActive(),
                agent.getAddress(),
                agent.getCreatedAt(),
                agent.getUpdatedAt(),
                contacts
        );
    }

    public ContactPersonDto toContactPersonDto(ContactPerson cp) {
        if (cp == null) return null;
        return new ContactPersonDto(cp.getId(), cp.getName(), cp.getPhone(), cp.getEmail(), cp.getDesignation());
    }

    public List<TravelAgentDto> toDtoList(List<TravelAgent> agents) {
        if (agents == null || agents.isEmpty()) return List.of();
        return agents.stream().map(this::toDto).collect(Collectors.toList());
    }
}
