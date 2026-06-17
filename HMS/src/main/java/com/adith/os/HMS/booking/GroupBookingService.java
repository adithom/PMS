package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.billing.payment.PaymentService;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.booking.dto.*;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.reservation.Reservation;
import com.adith.os.HMS.reservation.ReservationRepository;
import com.adith.os.HMS.reservation.ReservationSequence;
import com.adith.os.HMS.reservation.ReservationSequenceRepository;
import com.adith.os.HMS.reservation.ReservationStatus;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.travelagent.TravelAgent;
import com.adith.os.HMS.travelagent.TravelAgentService;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GroupBookingService {

    private final PropertyRepository propertyRepository;
    private final GuestRepository guestRepository;
    private final UnitRepository unitRepository;
    private final RoomRepository roomRepository;
    private final BookingRepository bookingRepository;
    private final FolioService folioService;
    private final PaymentService paymentService;
    private final TravelAgentService travelAgentService;
    private final ReservationRepository reservationRepository;
    private final FolioChargeRepository folioChargeRepository;
    private final RoomAssignmentRepository roomAssignmentRepository;
    private final ReservationSequenceRepository reservationSequenceRepository;

    public GroupBookingService(
            PropertyRepository propertyRepository,
            GuestRepository guestRepository,
            UnitRepository unitRepository,
            RoomRepository roomRepository,
            BookingRepository bookingRepository,
            FolioService folioService,
            PaymentService paymentService,
            TravelAgentService travelAgentService,
            ReservationRepository reservationRepository,
            FolioChargeRepository folioChargeRepository,
            RoomAssignmentRepository roomAssignmentRepository,
            ReservationSequenceRepository reservationSequenceRepository) {
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
        this.unitRepository = unitRepository;
        this.roomRepository = roomRepository;
        this.bookingRepository = bookingRepository;
        this.folioService = folioService;
        this.paymentService = paymentService;
        this.travelAgentService = travelAgentService;
        this.reservationRepository = reservationRepository;
        this.folioChargeRepository = folioChargeRepository;
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.reservationSequenceRepository = reservationSequenceRepository;
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    /**
     * Creates a group reservation in a single transaction.
     *
     *  1. Validate inputs upfront (fail before any DB writes)
     *  2. Create the Reservation (the group container)
     *  3. For each room request, create a Booking under the reservation + a folio for it
     *
     * The reservation's `defaultRouteToMaster` flag is set from the requested billing mode;
     * the night audit reads it to decide where new charges land.
     */
    @Transactional
    public GroupBookingSummaryDto createGroupBooking(UUID propertyId,
                                                     @Valid GroupBookingCreationDto dto) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        if (dto.checkIn().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-in date cannot be in the past");
        }
        if (dto.checkOut() == null || !dto.checkOut().isAfter(dto.checkIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out date must be after check-in date");
        }

        Guest organizer = guestRepository.findById(dto.organizerGuestId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Organizer guest not found"));

        List<ValidatedRoomRequest> validated = validateAndResolveRoomRequests(
                propertyId, dto, organizer);

        TravelAgent travelAgent = travelAgentService.resolveOrCreate(dto.travelAgentId(), null);

        // ---- Create the Reservation ----
        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        reservation.setOrganizerGuest(organizer);
        reservation.setCheckIn(dto.checkIn());
        reservation.setCheckOut(dto.checkOut());
        reservation.setCurrency(dto.currency());
        reservation.setSpecialRequests(dto.specialRequests());
        reservation.setGroupReference(dto.groupReference());
        reservation.setStatus(ReservationStatus.PENDING);
        // Consolidated billing only makes sense with multiple rooms — a single-room
        // reservation has no separate "master" to route charges to.
        reservation.setDefaultRouteToMaster(
                dto.billingMode() == GroupBookingCreationDto.GroupBillingMode.CONSOLIDATED
                        && validated.size() > 1);
        if (travelAgent != null) {
            reservation.setTravelAgent(travelAgent);
        }
        reservation.setReservationNumber(
                generateReservationNumber(property, LocalDate.now(ZoneId.of("Asia/Kolkata"))));
        Reservation savedReservation = reservationRepository.save(reservation);

        // ---- Create one Booking per room request, plus a folio for each ----
        List<Booking> savedBookings = new ArrayList<>();
        BigDecimal totalGroupPrice = BigDecimal.ZERO;
        UUID organizerFolioId = null;

        for (ValidatedRoomRequest vr : validated) {
            Booking booking = new Booking();
            booking.setProperty(property);
            booking.setReservation(savedReservation);
            booking.setGuest(vr.guest());
            booking.setUnit(vr.unit());
            booking.setRoom(vr.room()); // may be null — assigned at check-in
            booking.setCheckIn(dto.checkIn());
            booking.setCheckOut(dto.checkOut());
            booking.setAdults(vr.request().adults());
            booking.setChildren(vr.request().children());
            booking.setCurrency(dto.currency());
            long nights = ChronoUnit.DAYS.between(dto.checkIn(), dto.checkOut());

            // Meal plan (applied uniformly to all rooms)
            int adults = vr.request().adults() != null ? vr.request().adults() : 1;
            int children = vr.request().children() != null ? vr.request().children() : 0;
            BigDecimal mealNightly = BigDecimal.ZERO;
            if (dto.mealPlanType() != null) {
                booking.setMealPlanType(dto.mealPlanType());
                BigDecimal adultPrice = dto.mealPlanPricePerNight() != null ? dto.mealPlanPricePerNight() : BigDecimal.ZERO;
                BigDecimal childPrice = dto.mealPlanChildrenPricePerNight() != null ? dto.mealPlanChildrenPricePerNight() : BigDecimal.ZERO;
                booking.setMealPlanPricePerNight(adultPrice);
                booking.setMealPlanChildrenPricePerNight(childPrice);
                mealNightly = adultPrice.multiply(BigDecimal.valueOf(adults))
                        .add(childPrice.multiply(BigDecimal.valueOf(children)));
            }

            BigDecimal roomNightly = vr.request().nightlyRate() != null ? vr.request().nightlyRate() : BigDecimal.ZERO;
            BigDecimal totalNightly = roomNightly.add(mealNightly);
            BigDecimal bookingTotal = nights > 0 ? totalNightly.multiply(BigDecimal.valueOf(nights)) : BigDecimal.ZERO;
            booking.setTotalPrice(bookingTotal);
            booking.setPaidAmount(BigDecimal.ZERO);

            // Stash the inclusive room nightly rate so assignRoomToBooking can apply it to the room assignment.
            if (roomNightly.compareTo(BigDecimal.ZERO) > 0) {
                booking.setExpectedNightlyRate(roomNightly);
            }
            booking.setSpecialRequests(vr.request().specialRequests());
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setTwinBed(vr.request().isTwinBed() != null ? vr.request().isTwinBed() : false);
            if (dto.bookingSource() != null && !dto.bookingSource().isBlank()) {
                booking.setBookingSource(dto.bookingSource());
            }
            if (travelAgent != null) {
                booking.setTravelAgent(travelAgent);
            }

            Booking saved = bookingRepository.save(booking);
            savedBookings.add(saved);
            totalGroupPrice = totalGroupPrice.add(bookingTotal);

            // Auto-create the booking's folio
            FolioCreationDto folioDto = new FolioCreationDto(
                    saved.getId(),
                    vr.guest().getId(),
                    vr.request().specialRequests(),
                    "SYSTEM"
            );
            var createdFolio = folioService.createFolio(propertyId, folioDto);
            // Track organizer's folio for advance payment
            if (organizerFolioId == null && vr.guest().getId().equals(organizer.getId())) {
                organizerFolioId = createdFolio.id();
            }
        }

        // Record advance payment on organizer's folio if provided
        if (organizerFolioId != null
                && dto.advancePaymentAmount() != null
                && dto.advancePaymentAmount().compareTo(BigDecimal.ZERO) > 0) {
            PaymentMethod method = dto.advancePaymentMethod() != null
                    ? dto.advancePaymentMethod()
                    : PaymentMethod.CASH;
            paymentService.recordPayment(propertyId, organizerFolioId,
                    new PaymentCreationDto(
                            dto.advancePaymentAmount(), method,
                            null, null, null,
                            null, null, null,
                            null,
                            "Advance payment at reservation creation",
                            "SYSTEM",
                            null),
                    "SYSTEM");
        }

        return buildReservationSummary(savedReservation, savedBookings);
    }

    // =========================================================================
    // READ
    // =========================================================================

    public GroupBookingSummaryDto getGroupReservationSummary(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    public List<GroupBookingSummaryDto> getGroupReservationsByProperty(UUID propertyId) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        return reservationRepository.findByPropertyIdOrderByCheckInDesc(propertyId).stream()
                .map(reservation -> {
                    List<Booking> bookings = bookingRepository.findByReservationId(reservation.getId());
                    return buildReservationSummary(reservation, bookings);
                })
                .collect(Collectors.toList());
    }

    // =========================================================================
    // BILLING OPERATIONS
    // =========================================================================

    /**
     * Switch the reservation to CONSOLIDATED billing.
     *  - Set reservation.defaultRouteToMaster = true (drives night-audit default for new charges).
     *  - Bulk-flip all unbilled, non-voided charges in the reservation to routeToMaster = true.
     *  - No payment movement: reservation-level payments stay put.
     */
    @Transactional
    public GroupBookingSummaryDto consolidateBilling(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        if (bookingRepository.countByReservationId(reservationId) <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Consolidated billing requires more than one room in the reservation");
        }
        reservation.setDefaultRouteToMaster(true);
        reservationRepository.save(reservation);

        List<FolioCharge> unbilled = folioChargeRepository
                .findActiveChargesByReservationId(reservationId)
                .stream()
                .filter(c -> c.getBill() == null && c.getGroupBill() == null)
                .toList();
        for (FolioCharge c : unbilled) {
            c.setRouteToMaster(true);
        }
        folioChargeRepository.saveAll(unbilled);

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    /**
     * Switch the reservation to SEPARATE billing.
     *  - Set reservation.defaultRouteToMaster = false (new charges land on the booking's own bill).
     *  - Bulk-flip all unbilled, non-voided charges in the reservation to routeToMaster = false.
     *  - No payment movement: reservation-level payments stay put. Booking bills generated next will
     *    include their equal share of those payments as an applied master credit.
     */
    @Transactional
    public GroupBookingSummaryDto separateBilling(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        reservation.setDefaultRouteToMaster(false);
        reservationRepository.save(reservation);

        List<FolioCharge> unbilled = folioChargeRepository
                .findActiveChargesByReservationId(reservationId)
                .stream()
                .filter(c -> c.getBill() == null && c.getGroupBill() == null)
                .toList();
        for (FolioCharge c : unbilled) {
            c.setRouteToMaster(false);
        }
        folioChargeRepository.saveAll(unbilled);

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    // =========================================================================
    // METADATA UPDATE
    // =========================================================================

    /**
     * Updates reservation-level metadata (organizer guest, group reference, special requests)
     * and the "important" per-booking fields (guest, occupancy) for member bookings.
     */
    @Transactional
    public GroupBookingSummaryDto updateReservation(UUID propertyId, UUID reservationId, ReservationUpdateDto dto) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);

        if (dto.organizerGuestId() != null) {
            Guest organizer = guestRepository.findById(dto.organizerGuestId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organizer guest not found"));
            reservation.setOrganizerGuest(organizer);
        }
        reservation.setGroupReference(dto.groupReference());
        reservation.setSpecialRequests(dto.specialRequests());
        reservationRepository.save(reservation);

        if (dto.bookingUpdates() != null) {
            for (BookingOccupancyUpdateDto bu : dto.bookingUpdates()) {
                Booking booking = getValidatedBooking(propertyId, bu.bookingId(), reservationId);

                if (bu.guestId() != null && !bu.guestId().equals(booking.getGuest().getId())) {
                    Guest guest = guestRepository.findById(bu.guestId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                    "Guest not found for booking " + bu.bookingId()));
                    booking.setGuest(guest);
                }
                if (bu.adults() != null) {
                    booking.setAdults(bu.adults());
                }
                if (bu.children() != null) {
                    booking.setChildren(bu.children());
                }
                if (bu.nightlyRate() != null) {
                    long nights = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
                    booking.setTotalPrice(bu.nightlyRate().multiply(BigDecimal.valueOf(Math.max(nights, 0))));

                    List<RoomAssignment> activeAssignments = roomAssignmentRepository.findByBookingId(booking.getId())
                            .stream()
                            .filter(a -> a.getStatus() == RoomAssignmentStatus.SCHEDULED || a.getStatus() == RoomAssignmentStatus.ACTIVE)
                            .toList();
                    BigDecimal exTaxRate = ChargeCode.computeExTaxFromInclusive(bu.nightlyRate());
                    if (!activeAssignments.isEmpty()) {
                        for (RoomAssignment a : activeAssignments) {
                            a.setNightlyRate(bu.nightlyRate());
                            a.setNightlyRateExTax(exTaxRate);
                        }
                        roomAssignmentRepository.saveAll(activeAssignments);
                        booking.setExpectedNightlyRate(null);
                    } else {
                        // Room not yet assigned — stash the rate to apply once a room is assigned.
                        booking.setExpectedNightlyRate(bu.nightlyRate());
                    }
                }
                bookingRepository.save(booking);
            }
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    // =========================================================================
    // CHECK-IN / CHECK-OUT
    // =========================================================================

    @Transactional
    public GroupBookingSummaryDto checkInBooking(UUID propertyId,
                                                 UUID reservationId,
                                                 UUID bookingId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        Booking booking = getValidatedBooking(propertyId, bookingId, reservationId);

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking must be in CONFIRMED status to check in");
        }

        if (booking.getRoom() == null) {
            Room available = findAvailableRoomInUnit(
                    booking.getUnit().getId(), booking.getCheckIn(), booking.getCheckOut());
            if (available == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No available rooms in unit for this booking. Assign a room manually first.");
            }
            booking.setRoom(available);
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(booking);

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    @Transactional
    public GroupBookingSummaryDto checkInAllBookings(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);

        for (Booking booking : bookings) {
            if (booking.getStatus() == BookingStatus.CONFIRMED) {
                if (booking.getRoom() == null) {
                    Room available = findAvailableRoomInUnit(
                            booking.getUnit().getId(), booking.getCheckIn(), booking.getCheckOut());
                    if (available == null) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "No available room for unit " + booking.getUnit().getName()
                                        + ". Assign rooms manually before bulk check-in.");
                    }
                    booking.setRoom(available);
                }
                booking.setStatus(BookingStatus.CHECKED_IN);
                bookingRepository.save(booking);
            }
        }

        List<Booking> updated = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, updated);
    }

    /**
     * Check out a single booking. Enforces folio settlement before checkout.
     */
    @Transactional
    public GroupBookingSummaryDto checkOutBooking(UUID propertyId,
                                                  UUID reservationId,
                                                  UUID bookingId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        Booking booking = getValidatedBooking(propertyId, bookingId, reservationId);

        if (booking.getStatus() != BookingStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking must be CHECKED_IN to check out");
        }

        Folio folio = booking.getFolio();
        if (folio != null && !folio.isFullyPaid()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot check out: folio has an outstanding balance of "
                            + folio.getBalanceDue()
                            + ". Settle the folio first.");
        }

        booking.setStatus(BookingStatus.CHECKED_OUT);
        bookingRepository.save(booking);

        folioService.closeOpenFoliosForBooking(bookingId);

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    /**
     * Cancel the entire reservation — cancels all member bookings.
     */
    @Transactional
    public GroupBookingSummaryDto cancelReservation(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);

        for (Booking booking : bookings) {
            if (booking.getStatus() == BookingStatus.CHECKED_IN) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot cancel reservation: booking " + booking.getId()
                                + " is already checked in. Check out first.");
            }
            booking.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(booking);
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservationRepository.save(reservation);

        return buildReservationSummary(reservation, bookings);
    }

    // =========================================================================
    // RESCHEDULE
    // =========================================================================

    @Transactional
    public GroupBookingSummaryDto rescheduleReservation(UUID propertyId,
                                                        UUID reservationId,
                                                        RescheduleReservationDto dto) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);

        for (Booking b : bookings) {
            if (b.getStatus() == BookingStatus.CHECKED_IN
                    || b.getStatus() == BookingStatus.CHECKED_OUT
                    || b.getStatus() == BookingStatus.CANCELLED
                    || b.getStatus() == BookingStatus.NO_SHOW) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot reschedule: booking " + b.getId() + " has status " + b.getStatus());
            }
        }

        if (dto.newCheckIn().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "New check-in cannot be in the past");
        }
        if (!dto.newCheckOut().isAfter(dto.newCheckIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out must be after check-in");
        }

        long newNights = ChronoUnit.DAYS.between(dto.newCheckIn(), dto.newCheckOut());

        reservation.setCheckIn(dto.newCheckIn());
        reservation.setCheckOut(dto.newCheckOut());
        reservationRepository.save(reservation);

        for (Booking booking : bookings) {
            if (booking.getOriginalCheckIn() == null) {
                booking.setOriginalCheckIn(booking.getCheckIn());
                booking.setOriginalCheckOut(booking.getCheckOut());
            }
            booking.setCheckIn(dto.newCheckIn());
            booking.setCheckOut(dto.newCheckOut());
            if (dto.reason() != null && !dto.reason().isBlank()) {
                booking.setRescheduleReason(dto.reason());
            }
            booking.setRoom(null);

            BigDecimal newTotal = BigDecimal.ZERO;
            if (booking.getUnit() != null) {
                List<Room> activeRooms = roomRepository.findByUnitIdAndStatus(
                        booking.getUnit().getId(), RoomStatus.ACTIVE);
                if (!activeRooms.isEmpty()) {
                    newTotal = activeRooms.get(0).getBaseRate().multiply(BigDecimal.valueOf(newNights));
                }
            }
            if (booking.getMealPlanPricePerNight() != null) {
                newTotal = newTotal.add(
                        booking.getMealPlanPricePerNight().multiply(BigDecimal.valueOf(newNights)));
            }
            booking.setTotalPrice(newTotal);

            List<RoomAssignment> scheduled = roomAssignmentRepository
                    .findByBookingId(booking.getId()).stream()
                    .filter(ra -> ra.getStatus() == RoomAssignmentStatus.SCHEDULED)
                    .toList();
            for (RoomAssignment ra : scheduled) {
                ra.setStatus(RoomAssignmentStatus.CANCELLED);
            }
            roomAssignmentRepository.saveAll(scheduled);

            bookingRepository.save(booking);
        }

        List<Booking> updated = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, updated);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private String generateReservationNumber(Property property, LocalDate date) {
        LocalDate monthStart = date.withDayOfMonth(1);
        ReservationSequence seq = reservationSequenceRepository
                .findByPropertyAndMonthWithLock(property.getId(), monthStart)
                .orElse(new ReservationSequence(property, monthStart, 1));
        int current = seq.getNextVal();
        seq.setNextVal(current + 1);
        reservationSequenceRepository.save(seq);
        return date.format(DateTimeFormatter.ofPattern("yyyyMM")) + String.format("%04d", current);
    }

    private List<ValidatedRoomRequest> validateAndResolveRoomRequests(
            UUID propertyId,
            GroupBookingCreationDto dto,
            Guest organizer) {

        List<ValidatedRoomRequest> results = new ArrayList<>();

        for (int i = 0; i < dto.roomRequests().size(); i++) {
            GroupRoomRequestDto req = dto.roomRequests().get(i);
            String context = "Room request #" + (i + 1);

            Unit unit = unitRepository.findById(req.unitId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            context + ": Unit not found"));

            if (!unit.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        context + ": Unit does not belong to this property");
            }

            Room room = null;
            if (req.roomId() != null) {
                room = roomRepository.findById(req.roomId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                context + ": Room not found"));

                if (!room.getUnit().getId().equals(unit.getId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            context + ": Room does not belong to the specified unit");
                }

                if (room.getStatus() == RoomStatus.INACTIVE) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            context + ": Room is inactive");
                }

                if (bookingRepository.existsOverlappingBooking(
                        room.getId(), dto.checkIn(), dto.checkOut())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            context + ": Room " + room.getNumber()
                                    + " is not available for the selected dates");
                }

                final UUID finalRoomId = room.getId();
                boolean roomAlreadyRequestedInBatch = results.stream()
                        .filter(vr -> vr.room() != null)
                        .anyMatch(vr -> vr.room().getId().equals(finalRoomId));

                if (roomAlreadyRequestedInBatch) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            context + ": Room " + room.getNumber()
                                    + " is requested multiple times in this group booking");
                }
            } else {
                long totalRooms = bookingRepository.countRoomsInUnit(unit.getId());
                long overlapping = bookingRepository.countOverlappingUnitBookings(
                        unit.getId(), dto.checkIn(), dto.checkOut());

                long alreadyAllocatedInThisBatch = results.stream()
                        .filter(vr -> vr.unit().getId().equals(unit.getId()))
                        .count();

                if (overlapping + alreadyAllocatedInThisBatch >= totalRooms) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            context + ": Unit '" + unit.getName()
                                    + "' has no remaining capacity for these dates");
                }
            }

            Guest guest = organizer;
            if (req.childGuestId() != null) {
                guest = guestRepository.findById(req.childGuestId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                context + ": Child guest not found"));
            }

            results.add(new ValidatedRoomRequest(req, unit, room, guest));
        }

        return results;
    }

    private GroupBookingSummaryDto buildReservationSummary(
            Reservation reservation,
            List<Booking> bookings) {

        BigDecimal totalGroupPrice = bookings.stream()
                .map(Booking::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BookingStatus overallStatus = deriveOverallStatus(bookings);

        List<GroupBookingSummaryDto.BookingSummaryDto> bookingDtos = bookings.stream()
                .map(b -> {
                    Folio folio = b.getFolio();
                    BigDecimal unitBaseRate = null;
                    if (b.getUnit() != null) {
                        List<Room> activeRooms = roomRepository.findByUnitIdAndStatus(
                                b.getUnit().getId(), RoomStatus.ACTIVE);
                        if (!activeRooms.isEmpty()) {
                            unitBaseRate = activeRooms.get(0).getBaseRate();
                        }
                    }
                    return new GroupBookingSummaryDto.BookingSummaryDto(
                            b.getId(),
                            b.getGuest().getId(),
                            b.getGuest().getFullName(),
                            b.getUnit() != null ? b.getUnit().getId() : null,
                            b.getUnit() != null ? b.getUnit().getName() : null,
                            b.getRoom() != null ? b.getRoom().getNumber() : null,
                            b.getStatus(),
                            b.getAdults(),
                            b.getChildren(),
                            b.getTotalPrice(),
                            b.getBalanceDue(),
                            folio != null ? folio.getId() : null,
                            folio != null ? folio.getFolioNumber() : null,
                            b.getSpecialRequests(),
                            b.isTwinBed(),
                            unitBaseRate,
                            b.getMealPlanPricePerNight()
                    );
                })
                .collect(Collectors.toList());

        String billingMode = reservation.isDefaultRouteToMaster() ? "CONSOLIDATED" : "SEPARATE";

        List<Booking> activeBookings = bookings.stream()
                .filter(b -> b.getStatus() != BookingStatus.CANCELLED)
                .toList();
        List<Booking> bookingsForDates = activeBookings.isEmpty() ? bookings : activeBookings;

        LocalDate derivedCheckIn = bookingsForDates.stream()
                .map(Booking::getCheckIn)
                .min(Comparator.naturalOrder())
                .orElse(reservation.getCheckIn());
        LocalDate derivedCheckOut = bookingsForDates.stream()
                .map(Booking::getCheckOut)
                .max(Comparator.naturalOrder())
                .orElse(reservation.getCheckOut());

        return new GroupBookingSummaryDto(
                reservation.getId(),
                reservation.getReservationNumber(),
                reservation.getGroupReference(),
                reservation.getOrganizerGuest().getId(),
                reservation.getOrganizerGuest().getFullName(),
                derivedCheckIn,
                derivedCheckOut,
                reservation.getSpecialRequests(),
                overallStatus,
                bookings.size(),
                totalGroupPrice,
                reservation.getCurrency(),
                reservation.getCreatedAt(),
                billingMode,
                bookingDtos
        );
    }

    /**
     * Derives a single status for the reservation from member booking statuses.
     */
    private BookingStatus deriveOverallStatus(List<Booking> bookings) {
        if (bookings.isEmpty()) return BookingStatus.CONFIRMED;

        boolean anyCheckedIn = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.CHECKED_IN);
        if (anyCheckedIn) return BookingStatus.CHECKED_IN;

        boolean anyConfirmed = bookings.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.CONFIRMED);
        if (anyConfirmed) return BookingStatus.CONFIRMED;

        boolean allCheckedOut = bookings.stream()
                .allMatch(b -> b.getStatus() == BookingStatus.CHECKED_OUT);
        if (allCheckedOut) return BookingStatus.CHECKED_OUT;

        boolean allCancelled = bookings.stream()
                .allMatch(b -> b.getStatus() == BookingStatus.CANCELLED);
        if (allCancelled) return BookingStatus.CANCELLED;

        return BookingStatus.CONFIRMED;
    }

    private Reservation getValidatedReservation(UUID propertyId, UUID reservationId) {
        Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Reservation not found"));
        if (!reservation.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation does not belong to this property");
        }
        return reservation;
    }

    private Booking getValidatedBooking(UUID propertyId, UUID bookingId, UUID expectedReservationId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found"));
        if (!booking.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to this property");
        }
        if (booking.getReservation() == null
                || !booking.getReservation().getId().equals(expectedReservationId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking " + bookingId + " is not part of reservation " + expectedReservationId);
        }
        return booking;
    }

    private Room findAvailableRoomInUnit(UUID unitId,
                                         java.time.LocalDate checkIn,
                                         java.time.LocalDate checkOut) {
        List<Room> activeRooms = roomRepository.findByUnitIdAndStatus(unitId, RoomStatus.ACTIVE);

        List<Booking> conflicts = bookingRepository.findConflictingBookingsForUnit(
                unitId, checkIn, checkOut,
                List.of(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN));

        Set<UUID> bookedRoomIds = conflicts.stream()
                .filter(b -> b.getRoom() != null)
                .map(b -> b.getRoom().getId())
                .collect(Collectors.toSet());

        return activeRooms.stream()
                .filter(r -> !bookedRoomIds.contains(r.getId()))
                .findFirst()
                .orElse(null);
    }

    /** Internal value object — validated entities for one room request */
    private record ValidatedRoomRequest(
            GroupRoomRequestDto request,
            Unit unit,
            Room room,      // null if unit-level booking
            Guest guest
    ) {}
}
