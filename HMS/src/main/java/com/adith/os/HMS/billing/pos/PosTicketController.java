package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.pos.dto.PosOrderCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketDto;
import com.adith.os.HMS.security.UserPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pos/tickets")
public class PosTicketController {

    private final PosTicketService ticketService;

    public PosTicketController(PosTicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosTicketDto> openTicket(
            @RequestBody PosTicketCreationDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ticketService.openTicket(dto, principal.getUsername()));
    }

    @PostMapping("/{ticketId}/orders")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosOrderDto> addOrder(
            @PathVariable UUID ticketId,
            @RequestBody PosOrderCreationDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ticketService.addOrderToTicket(ticketId, dto, principal.getUsername()));
    }

    @PostMapping("/{ticketId}/close")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<PosTicketDto> closeTicket(
            @PathVariable UUID ticketId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ticketService.closeTicket(ticketId, principal.getUsername()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'POS', 'FRONTDESK')")
    public ResponseEntity<List<PosTicketDto>> getOpenTickets(@RequestParam UUID locationId) {
        return ResponseEntity.ok(ticketService.getOpenTickets(locationId));
    }
}
