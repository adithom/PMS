package com.adith.os.HMS.guest;

import com.adith.os.HMS.billing.pos.PosOrderRepository;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.guest.dto.*;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class GuestService {

    private final GuestRepository guestRepository;
    private final GuestMapper guestMapper;
    private final BookingRepository bookingRepository;
    private final PosOrderRepository posOrderRepository;

    public GuestService(GuestRepository guestRepository, GuestMapper guestMapper,
                        BookingRepository bookingRepository, PosOrderRepository posOrderRepository) {
        this.guestRepository = guestRepository;
        this.guestMapper = guestMapper;
        this.bookingRepository = bookingRepository;
        this.posOrderRepository = posOrderRepository;
    }

    @Transactional
    public GuestDto createGuest(@Valid GuestCreationDto guestCreationDto) {
        if (guestCreationDto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest creation data is required");
        }

        // Check for duplicate email if provided
        if (guestCreationDto.email() != null && !guestCreationDto.email().isBlank()) {
            if (guestRepository.existsByEmail(guestCreationDto.email())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with email " + guestCreationDto.email() + " already exists");
            }
        }

        // Check for duplicate phone if provided
        if (guestCreationDto.phone() != null && !guestCreationDto.phone().isBlank()) {
            if (guestRepository.existsByPhone(guestCreationDto.phone())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with phone " + guestCreationDto.phone() + " already exists");
            }
        }

        // Check for duplicate docId if provided
        if (guestCreationDto.idNumber() != null && !guestCreationDto.idNumber().isBlank()) {
            if (guestRepository.existsByIdNumber(guestCreationDto.idNumber())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with document ID " + guestCreationDto.idNumber() + " already exists");
            }
        }

        try {
            Guest guest = guestMapper.toEntity(guestCreationDto);
            Guest savedGuest = guestRepository.save(guest);
            return guestMapper.toDto(savedGuest);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to create guest: " + e.getMessage());
        }
    }

    public GuestDto getGuestById(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest id is required");
        }

        Guest guest = guestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + id));

        return guestMapper.toDto(guest);
    }

    public GuestDto getGuestByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        String cleanEmail = email.trim().toLowerCase();
        Guest guest = guestRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Guest not found with email: " + cleanEmail));

        return guestMapper.toDto(guest);
    }

    public GuestDto getGuestByPhone(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone is required");
        }

        String cleanPhone = phone.trim();
        Guest guest = guestRepository.findByPhone(cleanPhone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Guest not found with phone: " + cleanPhone));

        return guestMapper.toDto(guest);
    }

    public GuestDto getGuestByDocId(String idNumber) {
        if (idNumber == null || idNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document ID is required");
        }

        String cleanDocId = idNumber.trim();
        Guest guest = guestRepository.findByIdNumber(cleanDocId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Guest not found with document ID: " + cleanDocId));

        return guestMapper.toDto(guest);
    }

    public List<GuestDto> getAllGuests() {
        try {
            List<Guest> guests = guestRepository.findAllByOrderByLastNameAscFirstNameAsc();
            return guestMapper.toDtoList(guests);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to fetch guests: " + e.getMessage());
        }
    }

    public List<GuestDto> searchGuests(String search) {
        if (search == null || search.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search term is required");
        }

        try {
            String searchTerm = search.trim();
            List<Guest> guests = guestRepository.searchGuests(searchTerm);
            return guestMapper.toDtoList(guests);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to search guests: " + e.getMessage());
        }
    }

    @Transactional
    public GuestDto updateGuest(UUID id, @Valid GuestUpdateDto dto) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        Guest guest = guestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + id));

        // Validate required fields for full update
        if (dto.firstName() == null || dto.firstName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "First name is required for full update");
        }
        if (dto.lastName() == null || dto.lastName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Last name is required for full update");
        }

        // Check for duplicate email (excluding current guest)
        if (dto.email() != null && !dto.email().isBlank()) {
            String cleanEmail = dto.email().trim().toLowerCase();
            if (!cleanEmail.equals(guest.getEmail()) && guestRepository.existsByEmail(cleanEmail)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with email '" + cleanEmail + "' already exists");
            }
        }

        // Check for duplicate phone (excluding current guest)
        if (dto.phone() != null && !dto.phone().isBlank()) {
            String cleanPhone = dto.phone().trim();
            if (!cleanPhone.equals(guest.getPhone()) && guestRepository.existsByPhone(cleanPhone)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with phone '" + cleanPhone + "' already exists");
            }
        }

        // Check for duplicate docId (excluding current guest)
        if (dto.idNumber() != null && !dto.idNumber().isBlank()) {
            String cleanDocId = dto.idNumber().trim();
            if (!cleanDocId.equals(guest.getIdNumber()) && guestRepository.existsByIdNumber(cleanDocId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Guest with document ID '" + cleanDocId + "' already exists");
            }
        }

        try {
            guest.setFirstName(dto.firstName().trim());
            guest.setLastName(dto.lastName().trim());
            guest.setEmail(dto.email() != null && !dto.email().isBlank() ? dto.email().trim().toLowerCase() : null);
            guest.setPhone(dto.phone() != null && !dto.phone().isBlank() ? dto.phone().trim() : null);
            guest.setIdNumber(dto.idNumber() != null && !dto.idNumber().isBlank() ? dto.idNumber().trim() : null);
            guest.setPreferences(dto.preferences() != null && !dto.preferences().isBlank() ? dto.preferences().trim() : null);
            guest.setDateOfBirth(dto.dateOfBirth());

            Guest savedGuest = guestRepository.save(guest);
            return guestMapper.toDto(savedGuest);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to update guest: " + e.getMessage());
        }
    }

    @Transactional
    public GuestDto partialUpdateGuest(UUID id, GuestUpdateDto dto) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest ID is required");
        }
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Update data is required");
        }

        Guest guest = guestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + id));

        try {
            // Partial update (PATCH semantics - only update provided fields)
            if (dto.firstName() != null && !dto.firstName().isBlank()) {
                guest.setFirstName(dto.firstName().trim());
            }

            if (dto.lastName() != null && !dto.lastName().isBlank()) {
                guest.setLastName(dto.lastName().trim());
            }

            if (dto.email() != null) {
                if (dto.email().isBlank()) {
                    guest.setEmail(null);
                } else {
                    String cleanEmail = dto.email().trim().toLowerCase();
                    if (!cleanEmail.equals(guest.getEmail()) && guestRepository.existsByEmail(cleanEmail)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Guest with email '" + cleanEmail + "' already exists");
                    }
                    guest.setEmail(cleanEmail);
                }
            }

            if (dto.phone() != null) {
                if (dto.phone().isBlank()) {
                    guest.setPhone(null);
                } else {
                    String cleanPhone = dto.phone().trim();
                    if (!cleanPhone.equals(guest.getPhone()) && guestRepository.existsByPhone(cleanPhone)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Guest with phone '" + cleanPhone + "' already exists");
                    }
                    guest.setPhone(cleanPhone);
                }
            }

            if (dto.idNumber() != null) {
                if (dto.idNumber().isBlank()) {
                    guest.setIdNumber(null);
                } else {
                    String cleanDocId = dto.idNumber().trim();
                    if (!cleanDocId.equals(guest.getIdNumber()) && guestRepository.existsByIdNumber(cleanDocId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "Guest with document ID '" + cleanDocId + "' already exists");
                    }
                    guest.setIdNumber(cleanDocId);
                }
            }

            if (dto.preferences() != null && !dto.preferences().isBlank()) {
                guest.setPreferences(dto.preferences().trim());
            }

            if (dto.dateOfBirth() != null) {
                guest.setDateOfBirth(dto.dateOfBirth());
            }

            Guest savedGuest = guestRepository.save(guest);
            return guestMapper.toDto(savedGuest);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to partially update guest: " + e.getMessage());
        }
    }

    @Transactional
    public GuestProfileDto getGuestProfile(UUID guestId) {
        Guest guest = guestRepository.findById(guestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + guestId));

        GuestDto guestDto = guestMapper.toDto(guest);

        List<Booking> bookings = bookingRepository.findAllBookingsForGuest(guestId);
        List<GuestBookingSummaryDto> bookingHistory = new ArrayList<>();
        for (Booking b : bookings) {
            String role = b.getGuest().getId().equals(guestId) ? "PRIMARY" : "ADDITIONAL";
            String propertyName = b.getProperty() != null ? b.getProperty().getName() : null;
            String roomNumber = b.getRoom() != null ? b.getRoom().getNumber() : null;
            String unitName = b.getUnit() != null ? b.getUnit().getName() : null;
            String groupRef = b.getReservation() != null ? b.getReservation().getGroupReference() : null;
            UUID reservationId = b.getReservation() != null ? b.getReservation().getId() : null;
            bookingHistory.add(new GuestBookingSummaryDto(
                    b.getId(), reservationId, groupRef, propertyName, roomNumber, unitName,
                    b.getCheckIn(), b.getCheckOut(), b.getStatus(), b.getMealPlanType(), role
            ));
        }

        List<Object[]> rows = posOrderRepository.findTopItemsByGuest(guestId);
        List<GuestPosPreferenceDto> posPreferences = new ArrayList<>();
        int limit = 0;
        for (Object[] row : rows) {
            if (limit++ >= 5) break;
            posPreferences.add(new GuestPosPreferenceDto(
                    (UUID) row[0],
                    (String) row[1],
                    (String) row[2],
                    ((Number) row[3]).longValue(),
                    ((Number) row[4]).longValue()
            ));
        }

        return new GuestProfileDto(guestDto, bookingHistory, posPreferences);
    }

    @Transactional
    public void deleteGuest(UUID id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest ID is required");
        }

        Guest guest = guestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found: " + id));

        try {
            guestRepository.delete(guest);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to delete guest: " + e.getMessage());
        }
    }
}
