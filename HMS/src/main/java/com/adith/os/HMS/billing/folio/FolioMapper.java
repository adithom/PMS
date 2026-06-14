package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioDetailDto;
import com.adith.os.HMS.billing.folio.dto.FolioDto;

import java.math.BigDecimal;
import com.adith.os.HMS.billing.payment.Payment;
import com.adith.os.HMS.billing.payment.PaymentMapper;
import com.adith.os.HMS.billing.payment.PaymentRepository;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.travelagent.TravelAgent;
import jakarta.validation.Valid;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class FolioMapper {

    private final PaymentMapper paymentMapper;
    private final PaymentRepository paymentRepository;

    public FolioMapper(PaymentMapper paymentMapper, PaymentRepository paymentRepository) {
        this.paymentMapper = paymentMapper;
        this.paymentRepository = paymentRepository;
    }

    public Folio toEntity(@Valid FolioCreationDto dto, Property property, Guest guest, Booking booking) {
        if (dto == null) return null;
        if (property == null) throw new IllegalArgumentException("Property is required");
        if (guest == null) throw new IllegalArgumentException("Guest is required");

        Folio folio = new Folio();
        folio.setProperty(property);
        folio.setGuest(guest);
        folio.setBooking(booking);  // Can be null for walk-ins
        folio.setNotes(dto.notes());
        folio.setStatus(FolioStatus.OPEN);

        return folio;
    }

    public FolioDto toDto(Folio folio) {
        if (folio == null) return null;

        Booking booking = folio.getBooking();
        LocalDate checkInDate = booking != null ? booking.getCheckIn() : null;
        LocalDate checkOutDate = booking != null ? booking.getCheckOut() : null;
        String roomNumber = extractRoomNumber(booking);
        TravelAgent agent = (booking != null) ? booking.getTravelAgent() : null;

        BigDecimal roomDiscAmt = FolioDiscountCalculator.computeRoomDiscountAmount(folio);
        BigDecimal ancDiscAmt  = FolioDiscountCalculator.computeAncillaryDiscountAmount(folio);

        return new FolioDto(
                folio.getId(),
                folio.getFolioNumber(),
                booking != null ? booking.getId() : null,
                folio.getGuest().getFullName(),
                folio.getProperty().getCode(),
                folio.getStatus(),
                folio.getSubtotal(),
                folio.getTaxAmount(),
                folio.getDiscountAmount(),
                folio.getTotalAmount(),
                folio.getPaidAmount(),
                folio.getBalanceDue(),
                folio.getCurrency(),
                folio.getNotes(),
                folio.getCreatedAt(),
                folio.getClosedAt(),
                checkInDate,
                checkOutDate,
                roomNumber,
                agent != null ? agent.getId() : null,
                agent != null ? agent.getName() : null,
                folio.getRoomDiscountType(),
                folio.getRoomDiscountValue(),
                roomDiscAmt.compareTo(BigDecimal.ZERO) > 0 ? roomDiscAmt : null,
                folio.getAncillaryDiscountType(),
                folio.getAncillaryDiscountValue(),
                ancDiscAmt.compareTo(BigDecimal.ZERO) > 0 ? ancDiscAmt : null
        );
    }

    private String extractRoomNumber(Booking booking) {
        if (booking == null) return null;
        List<RoomAssignment> assignments = booking.getRoomAssignments();
        if (assignments == null || assignments.isEmpty()) return null;
        var room = assignments.get(0).getRoom();
        return room != null ? room.getNumber() : null;
    }

    public List<FolioDto> toDtoList(List<Folio> folios) {
        if (folios == null || folios.isEmpty()) return List.of();
        return folios.stream().map(this::toDto).collect(Collectors.toList());
    }

    public FolioDetailDto toDetailDto(Folio folio) {
        if (folio == null) return null;

        List<ChargeDto> chargeDtos = folio.getCharges() != null
                ? folio.getCharges().stream().map(this::toChargeDto).toList()
                : List.of();

        Booking booking = folio.getBooking();
        List<PaymentDto> paymentDtos = booking != null
                ? paymentRepository.findByBookingId(booking.getId()).stream().map(this::toPaymentDto).toList()
                : List.of();
        LocalDate checkInDate = booking != null ? booking.getCheckIn() : null;
        LocalDate checkOutDate = booking != null ? booking.getCheckOut() : null;
        String roomNumber = extractRoomNumber(booking);
        TravelAgent agent = (booking != null) ? booking.getTravelAgent() : null;

        BigDecimal roomDiscAmt = FolioDiscountCalculator.computeRoomDiscountAmount(folio);
        BigDecimal ancDiscAmt  = FolioDiscountCalculator.computeAncillaryDiscountAmount(folio);

        return new FolioDetailDto(
                folio.getId(),
                folio.getFolioNumber(),
                booking != null ? booking.getId() : null,
                folio.getGuest().getFullName(),
                folio.getProperty().getCode(),
                folio.getStatus(),
                folio.getSubtotal(),
                folio.getTaxAmount(),
                folio.getDiscountAmount(),
                folio.getTotalAmount(),
                folio.getPaidAmount(),
                folio.getBalanceDue(),
                folio.getCurrency(),
                folio.getCreatedAt(),
                folio.getClosedAt(),
                checkInDate,
                checkOutDate,
                roomNumber,
                chargeDtos,
                paymentDtos,
                agent != null ? agent.getId() : null,
                agent != null ? agent.getName() : null,
                folio.getRoomDiscountType(),
                folio.getRoomDiscountValue(),
                roomDiscAmt.compareTo(BigDecimal.ZERO) > 0 ? roomDiscAmt : null,
                folio.getAncillaryDiscountType(),
                folio.getAncillaryDiscountValue(),
                ancDiscAmt.compareTo(BigDecimal.ZERO) > 0 ? ancDiscAmt : null
        );
    }

    private ChargeDto toChargeDto(FolioCharge charge) {
        if (charge == null) return null;

        return new ChargeDto(
                charge.getId(),
                charge.getChargeDate(),
                charge.getPostingDate(),
                charge.getChargeCode(),
                charge.getDescription(),
                charge.getReferenceType(),
                charge.getQuantity(),
                charge.getUnitPrice(),
                charge.getSubtotal(),
                charge.getTaxRate(),
                charge.getTaxAmount(),
                charge.getDiscountAmount(),
                charge.getTotalAmount(),
                charge.isVoided(),
                charge.getVoidReason(),
                charge.getNotes()
        );
    }

    private PaymentDto toPaymentDto(Payment payment) {
        if (payment == null) return null;
        return paymentMapper.toDto(payment);
    }
}
