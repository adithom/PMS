package com.adith.os.HMS.guest;

import com.adith.os.HMS.guest.dto.GuestCreationDto;
import com.adith.os.HMS.guest.dto.GuestDto;
import com.adith.os.HMS.guest.dto.GuestUpdateDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/guests")
public class GuestController {
    private final GuestService guestService;

    public GuestController(GuestService guestService) {
        this.guestService = guestService;
    }

    // CREATE
    @PostMapping()
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> createGuest(@Valid @RequestBody GuestCreationDto guestCreationDto) {
        try {
            GuestDto createdGuest = guestService.createGuest(guestCreationDto);
            return new ResponseEntity<>(createdGuest, HttpStatus.CREATED);
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage());
        }
    }

    // READ
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> getGuestById(@PathVariable UUID id) {
        GuestDto guestDto = guestService.getGuestById(id);
        return ResponseEntity.ok(guestDto);
    }

    @GetMapping("/email/{email}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> getGuestByEmail(@PathVariable String email) {
        GuestDto guestDto = guestService.getGuestByEmail(email);
        return ResponseEntity.ok(guestDto);
    }

    @GetMapping("/phone/{phone}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> getGuestByPhone(@PathVariable String phone) {
        GuestDto guestDto = guestService.getGuestByPhone(phone);
        return ResponseEntity.ok(guestDto);
    }

    @GetMapping("/doc/{docId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> getGuestByDocId(@PathVariable String docId) {
        GuestDto guestDto = guestService.getGuestByDocId(docId);
        return ResponseEntity.ok(guestDto);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<List<GuestDto>> getAllGuests(
            @RequestParam(required = false) String search) {
        List<GuestDto> guests;

        if (search != null && !search.isBlank()) {
            guests = guestService.searchGuests(search);
        } else {
            guests = guestService.getAllGuests();
        }

        return ResponseEntity.ok(guests);
    }

    // UPDATE
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> updateGuest(
            @PathVariable UUID id,
            @Valid @RequestBody GuestUpdateDto guestUpdateDto) {
        GuestDto updatedGuest = guestService.updateGuest(id, guestUpdateDto);
        return ResponseEntity.ok(updatedGuest);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<GuestDto> partialUpdateGuest(
            @PathVariable UUID id,
            @RequestBody GuestUpdateDto guestUpdateDto) {
        GuestDto updatedGuest = guestService.partialUpdateGuest(id, guestUpdateDto);
        return ResponseEntity.ok(updatedGuest);
    }

    // DELETE
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteGuest(@PathVariable UUID id) {
        guestService.deleteGuest(id);
        return ResponseEntity.noContent().build();
    }
}