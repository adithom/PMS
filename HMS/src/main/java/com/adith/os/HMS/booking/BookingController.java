package com.adith.os.HMS.booking;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.adith.os.HMS.booking.dto.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/properties/{propertyId}/bookings")
public class BookingController {
    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    // CREATE
    @PostMapping()
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> createBooking(
            @PathVariable UUID propertyId,
            @Valid @RequestBody BookingCreationDto bookingCreationDto) {
        BookingDto createdBooking = bookingService.createBooking(bookingCreationDto, propertyId);
        return new ResponseEntity<>(createdBooking, HttpStatus.CREATED);
    }

    // READ
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<BookingDto> getBookingById(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        BookingDto bookingDto = bookingService.getBookingById(propertyId, id);
        return ResponseEntity.ok(bookingDto);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY', 'POS')")
    public ResponseEntity<List<BookingDto>> getAllBookingsForProperty(
            @PathVariable UUID propertyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkInTo) {

        if (propertyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Property ID is required");
        }

        List<BookingDto> bookings;

        if (status != null && !status.isBlank()) {
            bookings = bookingService.getBookingsByPropertyAndStatus(propertyId, status);
        } else if (checkInFrom != null && checkInTo != null) {
            bookings = bookingService.getBookingsByPropertyAndCheckInRange(propertyId, checkInFrom, checkInTo);
        } else {
            bookings = bookingService.getBookingsByProperty(propertyId);
        }

        return ResponseEntity.ok(bookings);
    }

    @GetMapping("/guest/{guestId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<BookingDto>> getBookingsByGuest(
            @PathVariable UUID propertyId,
            @PathVariable UUID guestId) {
        List<BookingDto> bookings = bookingService.getBookingsByGuest(propertyId, guestId);
        return ResponseEntity.ok(bookings);
    }

    @GetMapping("/room/{roomId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<BookingDto>> getBookingsByRoom(
            @PathVariable UUID propertyId,
            @PathVariable UUID roomId) {
        List<BookingDto> bookings = bookingService.getBookingsByRoom(propertyId, roomId);
        return ResponseEntity.ok(bookings);
    }

    @GetMapping("/unit/{unitId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<BookingDto>> getBookingsByUnit(
            @PathVariable UUID propertyId,
            @PathVariable UUID unitId) {
        List<BookingDto> bookings = bookingService.getBookingsByUnit(propertyId, unitId);
        return ResponseEntity.ok(bookings);
    }

    /**
     * Get all bookings active on a specific date
     * GET /api/properties/{propertyId}/bookings/date?date=2025-12-15&includeAll=false
     */
    @GetMapping("/date")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<BookingDto>> getBookingsByDate(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "false") boolean includeAll) {

        List<BookingDto> bookings = bookingService.getBookingsByPropertyAndDate(
                propertyId,
                date,
                includeAll
        );

        return ResponseEntity.ok(bookings);
    }

    /**
     * Get all bookings overlapping with a specific date range (for Gantt/Tape charts)
     * GET /api/properties/{propertyId}/bookings/range?from=2026-03-01&to=2026-03-15
     */
    @GetMapping("/range")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY')")
    public ResponseEntity<List<BookingDto>> getBookingsByDateRange(
            @PathVariable UUID propertyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        List<BookingDto> bookings = bookingService.getBookingsByDateRangeOverlap(propertyId, from, to);
        return ResponseEntity.ok(bookings);
    }

    // UPDATE
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> updateBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @Valid @RequestBody BookingUpdateDto bookingUpdateDto) {
        BookingDto updatedBooking = bookingService.updateBooking(propertyId, id, bookingUpdateDto);
        return ResponseEntity.ok(updatedBooking);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> partialUpdateBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestBody BookingUpdateDto bookingUpdateDto) {
        BookingDto updatedBooking = bookingService.partialUpdateBooking(propertyId, id, bookingUpdateDto);
        return ResponseEntity.ok(updatedBooking);
    }

    @PatchMapping("/{id}/status/{status}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> updateBookingStatus(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @PathVariable BookingStatus status,
            @RequestParam(required = false) String reason) {
        BookingDto updatedBooking = bookingService.updateBookingStatus(propertyId, id, status, reason);
        return ResponseEntity.ok(updatedBooking);
    }

    // DELETE
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<Void> deleteBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        bookingService.deleteBooking(propertyId, id);
        return ResponseEntity.noContent().build();
    }

    // SPECIAL OPERATIONS

    @PostMapping("/{id}/assign-room")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> assignRoomToBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID id,
            @RequestParam UUID roomId) {
        BookingDto booking = bookingService.assignRoomToBooking(propertyId, id, roomId);
        return ResponseEntity.ok(booking);
    }

    @PostMapping("/{id}/check-in")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> checkInBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID id) {
        BookingDto booking = bookingService.checkInBooking(propertyId, id);
        return ResponseEntity.ok(booking);
    }

    @PostMapping("/{bookingId}/extend")
    public ResponseEntity<BookingDto> extendBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId,
            @Valid @RequestBody ExtendBookingRequestDto requestDto) {

        BookingDto updatedBooking = bookingService.extendBooking(propertyId, bookingId, requestDto);

        return ResponseEntity.ok(updatedBooking);
    }

    // Check-out endpoint
    @PostMapping("/{bookingId}/checkout")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> checkoutBooking(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId) {

        // Assuming you have a standard checkout method in BookingService
        // This method would normally just update the status to CHECKED_OUT and verify the folio is paid
        BookingDto updatedBooking = bookingService.checkOutBooking(propertyId, bookingId);

        return ResponseEntity.ok(updatedBooking);
    }

    // Early check-out endpoint
    @PostMapping("/{bookingId}/checkout-early")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'FRONTDESK')")
    public ResponseEntity<BookingDto> checkoutEarly(
            @PathVariable UUID propertyId,
            @PathVariable UUID bookingId,
            @Valid @RequestBody EarlyCheckoutRequestDto requestDto) {

        BookingDto updatedBooking = bookingService.checkoutEarly(
                propertyId,
                bookingId,
                requestDto.newCheckOutDate(),
                requestDto.policy(),
                requestDto.customRoomCharge()
        );

        return ResponseEntity.ok(updatedBooking);
    }

    //
}
