package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import com.adith.os.HMS.billing.bills.dto.GroupBillDto;
import com.adith.os.HMS.billing.payment.PaymentRepository;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.reservation.Reservation;
import com.adith.os.HMS.reservation.ReservationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class GroupBillService {

    private final BookingRepository bookingRepository;
    private final PropertyRepository propertyRepository;
    private final ReservationRepository reservationRepository;
    private final PaymentRepository paymentRepository;

    public GroupBillService(
            BookingRepository bookingRepository,
            PropertyRepository propertyRepository,
            ReservationRepository reservationRepository,
            PaymentRepository paymentRepository) {
        this.bookingRepository = bookingRepository;
        this.propertyRepository = propertyRepository;
        this.reservationRepository = reservationRepository;
        this.paymentRepository = paymentRepository;
    }

    /**
     * Returns the full itemized billing view for a reservation.
     * Each member booking gets its own RoomBillSection with all its charge line-items.
     * Group-level totals aggregate across all bookings.
     */
    public GroupBillDto getGroupBillView(UUID propertyId, UUID reservationId) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Reservation not found"));

        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation does not belong to this property");
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);

        if (bookings.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "No bookings found for this reservation");
        }

        String billingMode = reservation.isDefaultRouteToMaster() ? "CONSOLIDATED" : "SEPARATE";

        List<GroupBillDto.RoomBillSection> roomSections = new ArrayList<>();
        BigDecimal groupSubtotal       = BigDecimal.ZERO;
        BigDecimal groupTaxAmount      = BigDecimal.ZERO;
        BigDecimal groupDiscountAmount = BigDecimal.ZERO;
        BigDecimal groupTotalAmount    = BigDecimal.ZERO;
        BigDecimal groupPaidAmount     = BigDecimal.ZERO;

        for (Booking booking : bookings) {
            Folio folio = booking.getFolio();

            if (folio == null) {
                roomSections.add(new GroupBillDto.RoomBillSection(
                        booking.getId(),
                        null, null,
                        booking.getGuest().getId(),
                        booking.getGuest().getFullName(),
                        booking.getRoom() != null ? booking.getRoom().getNumber() : null,
                        booking.getUnit() != null ? booking.getUnit().getName() : null,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        BigDecimal.ZERO, BigDecimal.ZERO,
                        List.of()
                ));
                continue;
            }

            List<ChargeDto> chargeDtos = buildChargeDtos(folio);

            BigDecimal roomSubtotal       = folio.getSubtotal();
            BigDecimal roomTaxAmount      = folio.getTaxAmount();
            BigDecimal roomDiscountAmount = folio.getDiscountAmount();
            BigDecimal roomTotalAmount    = folio.getTotalAmount();
            BigDecimal roomPaidAmount     = folio.getPaidAmount();
            BigDecimal roomBalanceDue     = folio.getBalanceDue();

            roomSections.add(new GroupBillDto.RoomBillSection(
                    booking.getId(),
                    folio.getId(),
                    folio.getFolioNumber(),
                    booking.getGuest().getId(),
                    booking.getGuest().getFullName(),
                    booking.getRoom() != null ? booking.getRoom().getNumber() : null,
                    booking.getUnit() != null ? booking.getUnit().getName() : null,
                    roomSubtotal,
                    roomTaxAmount,
                    roomDiscountAmount,
                    roomTotalAmount,
                    roomPaidAmount,
                    roomBalanceDue,
                    chargeDtos
            ));

            groupSubtotal       = groupSubtotal.add(roomSubtotal);
            groupTaxAmount      = groupTaxAmount.add(roomTaxAmount);
            groupDiscountAmount = groupDiscountAmount.add(roomDiscountAmount);
            groupTotalAmount    = groupTotalAmount.add(roomTotalAmount);
            groupPaidAmount     = groupPaidAmount.add(roomPaidAmount);
        }

        BigDecimal reservationPayments = paymentRepository.sumCompletedByReservationId(reservationId);
        if (reservationPayments != null) {
            groupPaidAmount = groupPaidAmount.add(reservationPayments);
        }

        BigDecimal groupBalanceDue = groupTotalAmount.subtract(groupPaidAmount)
                .max(BigDecimal.ZERO);

        return new GroupBillDto(
                reservation.getId(),
                reservation.getGroupReference(),
                reservation.getOrganizerGuest().getFullName(),
                reservation.getCheckIn(),
                reservation.getCheckOut(),
                reservation.getCurrency(),
                billingMode,
                OffsetDateTime.now(),
                groupSubtotal,
                groupTaxAmount,
                groupDiscountAmount,
                groupTotalAmount,
                groupPaidAmount,
                groupBalanceDue,
                roomSections
        );
    }

    private List<ChargeDto> buildChargeDtos(Folio folio) {
        if (folio.getCharges() == null || folio.getCharges().isEmpty()) {
            return List.of();
        }

        return folio.getCharges().stream()
                .filter(c -> !c.isVoided())
                .map(this::toChargeDto)
                .collect(Collectors.toList());
    }

    private ChargeDto toChargeDto(FolioCharge charge) {
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
}
