package com.adith.os.HMS.travelagent;

import com.adith.os.HMS.booking.dto.BookingDto;
import com.adith.os.HMS.travelagent.dto.ContactPersonCreationDto;
import com.adith.os.HMS.travelagent.dto.ContactPersonDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentCreationDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentDto;
import com.adith.os.HMS.travelagent.dto.TravelAgentUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/travel-agents")
public class TravelAgentController {

    private final TravelAgentService travelAgentService;

    public TravelAgentController(TravelAgentService travelAgentService) {
        this.travelAgentService = travelAgentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> create(@Valid @RequestBody TravelAgentCreationDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(travelAgentService.createTravelAgent(dto));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<TravelAgentDto>> list(
            @RequestParam(defaultValue = "false") boolean activeOnly,
            @RequestParam(required = false) String search) {
        if (search != null && !search.isBlank()) {
            return ResponseEntity.ok(travelAgentService.searchTravelAgents(search));
        }
        return ResponseEntity.ok(travelAgentService.getAllTravelAgents(activeOnly));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(travelAgentService.getTravelAgentById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> update(@PathVariable UUID id,
                                                  @Valid @RequestBody TravelAgentUpdateDto dto) {
        return ResponseEntity.ok(travelAgentService.updateTravelAgent(id, dto));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> partialUpdate(@PathVariable UUID id,
                                                         @RequestBody TravelAgentUpdateDto dto) {
        return ResponseEntity.ok(travelAgentService.partialUpdateTravelAgent(id, dto));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> deactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(travelAgentService.deactivateTravelAgent(id));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TravelAgentDto> activate(@PathVariable UUID id) {
        return ResponseEntity.ok(travelAgentService.activateTravelAgent(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        travelAgentService.deleteTravelAgent(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/bookings")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<List<BookingDto>> getBookings(@PathVariable UUID id) {
        return ResponseEntity.ok(travelAgentService.getBookingsForAgent(id));
    }

    @PostMapping("/{id}/contacts")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ContactPersonDto> addContact(@PathVariable UUID id,
                                                        @Valid @RequestBody ContactPersonCreationDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(travelAgentService.addContactPerson(id, dto));
    }

    @PutMapping("/{id}/contacts/{contactId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ContactPersonDto> updateContact(@PathVariable UUID id,
                                                           @PathVariable UUID contactId,
                                                           @Valid @RequestBody ContactPersonCreationDto dto) {
        return ResponseEntity.ok(travelAgentService.updateContactPerson(id, contactId, dto));
    }

    @DeleteMapping("/{id}/contacts/{contactId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteContact(@PathVariable UUID id, @PathVariable UUID contactId) {
        travelAgentService.deleteContactPerson(id, contactId);
        return ResponseEntity.noContent().build();
    }
}
