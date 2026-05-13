package com.adith.os.HMS.billing.pos;

import com.adith.os.HMS.billing.pos.dto.CloseTicketDto;
import com.adith.os.HMS.billing.pos.dto.OrderSummaryDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosOrderDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketCreationDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketDto;
import com.adith.os.HMS.billing.pos.dto.PosTicketHistoryDto;
import com.adith.os.HMS.security.UserPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
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
            @RequestBody(required = false) CloseTicketDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(ticketService.closeTicket(ticketId, dto, principal.getUsername()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER', 'POS', 'FRONTDESK')")
    public ResponseEntity<List<PosTicketDto>> getOpenTickets(@RequestParam UUID locationId) {
        return ResponseEntity.ok(ticketService.getOpenTickets(locationId));
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<List<PosTicketHistoryDto>> getTicketHistory(
            @RequestParam UUID locationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime fromDt = from.atStartOfDay(ist).toOffsetDateTime();
        OffsetDateTime toDt   = to.plusDays(1).atStartOfDay(ist).toOffsetDateTime();
        return ResponseEntity.ok(ticketService.getTicketHistory(locationId, fromDt, toDt));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('MANAGER', 'POS')")
    public ResponseEntity<OrderSummaryDto> getTicketSummary(
            @RequestParam UUID locationId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime fromDt = from.atStartOfDay(ist).toOffsetDateTime();
        OffsetDateTime toDt   = to.plusDays(1).atStartOfDay(ist).toOffsetDateTime();
        return ResponseEntity.ok(ticketService.getTicketSummary(locationId, fromDt, toDt));
    }
}
