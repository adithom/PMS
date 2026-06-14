package com.adith.os.HMS.travelagent;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingMapper;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.travelagent.dto.ContactPersonCreationDto;
import com.adith.os.HMS.travelagent.dto.ContactPersonDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentCreationDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentUpdateDto;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class TravelAgentService {

    private final TravelAgentRepository travelAgentRepository;
    private final TravelAgentMapper travelAgentMapper;
    private final BookingRepository bookingRepository;
    private final BookingMapper bookingMapper;
    private final ContactPersonRepository contactPersonRepository;

    public TravelAgentService(TravelAgentRepository travelAgentRepository,
                              TravelAgentMapper travelAgentMapper,
                              BookingRepository bookingRepository,
                              BookingMapper bookingMapper,
                              ContactPersonRepository contactPersonRepository) {
        this.travelAgentRepository = travelAgentRepository;
        this.travelAgentMapper = travelAgentMapper;
        this.bookingRepository = bookingRepository;
        this.bookingMapper = bookingMapper;
        this.contactPersonRepository = contactPersonRepository;
    }

    /**
     * Resolve an existing travel agent by ID, or create a new one inline.
     * Returns null if both arguments are null (booking has no travel agent).
     * Used by BookingService and GroupBookingService.
     */
    @Transactional
    public TravelAgent resolveOrCreate(UUID travelAgentId, TravelAgentCreationDto newAgent) {
        if (travelAgentId != null && newAgent != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide either travelAgentId OR newTravelAgent, not both");
        }
        if (travelAgentId != null) {
            return travelAgentRepository.findById(travelAgentId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Travel agent not found: " + travelAgentId));
        }
        if (newAgent != null) {
            if (newAgent.email() != null && travelAgentRepository.existsByEmail(newAgent.email().trim().toLowerCase())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Travel agent with email " + newAgent.email() + " already exists. Use travelAgentId to reference the existing agent.");
            }
            TravelAgent agent = travelAgentMapper.toEntity(newAgent);
            return travelAgentRepository.save(agent);
        }
        return null;
    }

    @Transactional
    public TravelAgentDto createTravelAgent(@Valid TravelAgentCreationDto dto) {
        if (dto.email() != null && travelAgentRepository.existsByEmail(dto.email().trim().toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Travel agent with email " + dto.email() + " already exists");
        }
        TravelAgent agent = travelAgentMapper.toEntity(dto);
        return travelAgentMapper.toDto(travelAgentRepository.save(agent));
    }

    public TravelAgentDto getTravelAgentById(UUID id) {
        return travelAgentMapper.toDto(findOrThrow(id));
    }

    public List<TravelAgentDto> getAllTravelAgents(boolean activeOnly) {
        List<TravelAgent> agents = activeOnly
                ? travelAgentRepository.findAllByActiveOrderByNameAsc(true)
                : travelAgentRepository.findAllByOrderByNameAsc();
        return travelAgentMapper.toDtoList(agents);
    }

    public List<TravelAgentDto> searchTravelAgents(String search) {
        return travelAgentMapper.toDtoList(travelAgentRepository.searchTravelAgents(search));
    }

    @Transactional
    public TravelAgentDto updateTravelAgent(UUID id, @Valid TravelAgentUpdateDto dto) {
        TravelAgent agent = findOrThrow(id);
        if (dto.name() == null || dto.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agent name is required");
        }
        if (dto.email() != null && travelAgentRepository.existsByEmailAndIdNot(dto.email().trim().toLowerCase(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Another travel agent with email " + dto.email() + " already exists");
        }
        applyUpdate(agent, dto);
        return travelAgentMapper.toDto(travelAgentRepository.save(agent));
    }

    @Transactional
    public TravelAgentDto partialUpdateTravelAgent(UUID id, TravelAgentUpdateDto dto) {
        TravelAgent agent = findOrThrow(id);
        if (dto.email() != null && travelAgentRepository.existsByEmailAndIdNot(dto.email().trim().toLowerCase(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Another travel agent with email " + dto.email() + " already exists");
        }
        if (dto.name() != null && !dto.name().isBlank()) agent.setName(dto.name().trim());
        if (dto.email() != null) agent.setEmail(dto.email().trim().toLowerCase());
        if (dto.phone() != null) agent.setPhone(dto.phone());
        if (dto.gstin() != null) agent.setGstin(dto.gstin().trim().toUpperCase());
        if (dto.active() != null) agent.setActive(dto.active());
        if (dto.address() != null) agent.setAddress(dto.address());
        return travelAgentMapper.toDto(travelAgentRepository.save(agent));
    }

    @Transactional
    public TravelAgentDto deactivateTravelAgent(UUID id) {
        TravelAgent agent = findOrThrow(id);
        agent.setActive(false);
        return travelAgentMapper.toDto(travelAgentRepository.save(agent));
    }

    @Transactional
    public TravelAgentDto activateTravelAgent(UUID id) {
        TravelAgent agent = findOrThrow(id);
        agent.setActive(true);
        return travelAgentMapper.toDto(travelAgentRepository.save(agent));
    }

    @Transactional
    public void deleteTravelAgent(UUID id) {
        findOrThrow(id);
        if (bookingRepository.existsByTravelAgentId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete travel agent: they have associated bookings. Deactivate instead.");
        }
        travelAgentRepository.deleteById(id);
    }

    public List<BookingDto> getBookingsForAgent(UUID id) {
        findOrThrow(id);
        List<Booking> bookings = bookingRepository.findByTravelAgentIdOrderByCheckInDesc(id);
        return bookingMapper.toDtoList(bookings);
    }

    @Transactional
    public ContactPersonDto addContactPerson(UUID agentId, @Valid ContactPersonCreationDto dto) {
        TravelAgent agent = findOrThrow(agentId);
        ContactPerson cp = new ContactPerson();
        cp.setName(dto.name().trim());
        cp.setPhone(dto.phone());
        cp.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        cp.setDesignation(dto.designation());
        cp.setTravelAgent(agent);
        return travelAgentMapper.toContactPersonDto(contactPersonRepository.save(cp));
    }

    @Transactional
    public ContactPersonDto updateContactPerson(UUID agentId, UUID contactId, @Valid ContactPersonCreationDto dto) {
        findOrThrow(agentId);
        ContactPerson cp = contactPersonRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Contact person not found: " + contactId));
        if (!cp.getTravelAgent().getId().equals(agentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contact does not belong to this agent");
        }
        cp.setName(dto.name().trim());
        cp.setPhone(dto.phone());
        cp.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        cp.setDesignation(dto.designation());
        return travelAgentMapper.toContactPersonDto(contactPersonRepository.save(cp));
    }

    @Transactional
    public void deleteContactPerson(UUID agentId, UUID contactId) {
        findOrThrow(agentId);
        ContactPerson cp = contactPersonRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Contact person not found: " + contactId));
        if (!cp.getTravelAgent().getId().equals(agentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contact does not belong to this agent");
        }
        contactPersonRepository.deleteById(contactId);
    }

    private TravelAgent findOrThrow(UUID id) {
        return travelAgentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Travel agent not found: " + id));
    }

    private void applyUpdate(TravelAgent agent, TravelAgentUpdateDto dto) {
        agent.setName(dto.name().trim());
        agent.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        agent.setPhone(dto.phone());
        agent.setGstin(dto.gstin() != null ? dto.gstin().trim().toUpperCase() : null);
        agent.setAddress(dto.address());
        if (dto.active() != null) agent.setActive(dto.active());
    }
}
