package com.adith.os.HMS.guest;

import com.adith.os.HMS.guest.dto.GuestCreationDto;
import com.adith.os.HMS.guest.dto.GuestDto;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GuestMapper {

    public Guest toEntity(@Valid GuestCreationDto guestCreationDto) {
        if (guestCreationDto == null) return null;

        String firstName = guestCreationDto.firstName() != null ? guestCreationDto.firstName().trim() : null;
        if (firstName == null || firstName.isEmpty()) {
            throw new IllegalArgumentException("First name cannot be blank");
        }

        String lastName = guestCreationDto.lastName() != null ? guestCreationDto.lastName().trim() : null;
        if (lastName == null || lastName.isEmpty()) {
            throw new IllegalArgumentException("Last name cannot be blank");
        }

        Guest guest = new Guest();
        guest.setFirstName(firstName);
        guest.setLastName(lastName);

        // Optional fields - trim and lowercase email
        guest.setEmail(guestCreationDto.email() != null && !guestCreationDto.email().isBlank()
                ? guestCreationDto.email().trim().toLowerCase()
                : null);

        guest.setPhone(guestCreationDto.phone() != null && !guestCreationDto.phone().isBlank()
                ? guestCreationDto.phone().trim()
                : null);

        guest.setIdNumber(guestCreationDto.idNumber() != null && !guestCreationDto.idNumber().isBlank()
                ? guestCreationDto.idNumber().trim()
                : null);

        guest.setGuestIdType(guestCreationDto.guestIdType());

        guest.setPreferences(guestCreationDto.preferences() != null && !guestCreationDto.preferences().isBlank()
                ? guestCreationDto.preferences().trim()
                : null);

        return guest;
    }

    public GuestDto toDto(Guest guest) {
        if (guest == null) return null;

        return new GuestDto(
                guest.getId(),
                guest.getFirstName(),
                guest.getLastName(),
                guest.getFullName(),
                guest.getEmail(),
                guest.getPhone(),
                guest.getIdNumber(),
                guest.getGuestIdType(),
                guest.getCreatedAt(),
                guest.getPreferences()
        );
    }

    public List<GuestDto> toDtoList(List<Guest> guests) {
        if (guests == null || guests.isEmpty()) {
            return List.of();
        }

        return guests.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
}
