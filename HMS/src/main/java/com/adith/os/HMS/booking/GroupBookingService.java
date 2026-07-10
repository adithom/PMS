package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.payment.PaymentMethod;
import com.adith.os.HMS.billing.payment.PaymentService;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.booking.dto.*;
import com.adith.os.HMS.config.SystemConstants;
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
import com.adith.os.HMS.roomassignment.RoomAssignmentService;
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
    private final RoomAssignmentService roomAssignmentService;
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
            RoomAssignmentService roomAssignmentService,
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
        this.roomAssignmentService = roomAssignmentService;
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
        reservation.setStatus(ReservationStatus.CONFIRMED);
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
            booking.setTwinBed(vr.request().isTwinBed() != null ? vr.request().isTwinBed() : false);
            if (dto.bookingSource() != null && !dto.bookingSource().isBlank()) {
                booking.setBookingSource(dto.bookingSource());
            }
            if (travelAgent != null) {
                booking.setTravelAgent(travelAgent);
            }

            Booking saved = bookingRepository.save(booking);
            roomAssignmentService.applyExpectedNightlyRate(saved);
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
                            dto.advanceTransactionId(),
                            dto.advanceCardLastFour(),
                            dto.advanceCardType(),
                            dto.advanceBankName(),
                            dto.advanceAccountNumber(),
                            dto.advanceReferenceNumber(),
                            dto.advanceUpiId(),
                            dto.advanceNotes() != null ? dto.advanceNotes() : "Advance payment at reservation creation",
                            "SYSTEM",
                            null),
                    "SYSTEM");
        }

        return buildReservationSummary(savedReservation, savedBookings);
    }

    // =========================================================================
    // QUICK HOLD
    // =========================================================================

    /**
     * Creates a shell PENDING reservation with no guest or room details filled in.
     * All bookings are assigned to the Temporary Guest placeholder.
     * Staff fill in the real details later via the reservation detail view.
     */
    @Transactional
    public GroupBookingSummaryDto createQuickHold(UUID propertyId, @Valid QuickHoldDto dto) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        if (dto.checkOut() == null || !dto.checkOut().isAfter(dto.checkIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out date must be after check-in date");
        }

        Guest tempGuest = guestRepository.findById(SystemConstants.TEMP_GUEST_ID)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "System configuration error: Temporary Guest not found"));

        Reservation reservation = new Reservation();
        reservation.setProperty(property);
        reservation.setOrganizerGuest(tempGuest);
        reservation.setCheckIn(dto.checkIn());
        reservation.setCheckOut(dto.checkOut());
        reservation.setCurrency("INR");
        reservation.setGroupReference(dto.notes());
        reservation.setStatus(ReservationStatus.PENDING);
        reservation.setDefaultRouteToMaster(false);
        reservation.setReservationNumber(
                generateReservationNumber(property, LocalDate.now(ZoneId.of("Asia/Kolkata"))));
        Reservation savedReservation = reservationRepository.save(reservation);

        List<Booking> savedBookings = new ArrayList<>();
        long nights = ChronoUnit.DAYS.between(dto.checkIn(), dto.checkOut());

        for (QuickHoldRoomRequestDto req : dto.roomRequests()) {
            Unit unit = unitRepository.findById(req.unitId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Unit not found: " + req.unitId()));
            if (!unit.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unit does not belong to this property");
            }

            // Default rate: base rate of the first active room in the unit — staged so it's
            // visible immediately and inherited by the RoomAssignment once a room is assigned.
            BigDecimal defaultRate = roomRepository.findByUnitIdAndStatus(unit.getId(), RoomStatus.ACTIVE)
                    .stream()
                    .findFirst()
                    .map(Room::getBaseRate)
                    .orElse(null);

            for (int i = 0; i < req.count(); i++) {
                Booking booking = new Booking();
                booking.setProperty(property);
                booking.setReservation(savedReservation);
                booking.setGuest(tempGuest);
                booking.setUnit(unit);
                booking.setCheckIn(dto.checkIn());
                booking.setCheckOut(dto.checkOut());
                booking.setAdults(1);
                booking.setChildren(0);
                booking.setCurrency("INR");
                booking.setPaidAmount(BigDecimal.ZERO);
                booking.setTwinBed(false);
                if (defaultRate != null) {
                    booking.setExpectedNightlyRate(defaultRate);
                    booking.setTotalPrice(defaultRate.multiply(BigDecimal.valueOf(Math.max(nights, 0))));
                } else {
                    booking.setTotalPrice(BigDecimal.ZERO);
                }
                Booking saved = bookingRepository.save(booking);
                savedBookings.add(saved);

                FolioCreationDto folioDto = new FolioCreationDto(
                        saved.getId(), tempGuest.getId(), null, "SYSTEM");
                folioService.createFolio(propertyId, folioDto);
            }
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

        Guest newOrganizer = null;
        if (dto.organizerGuestId() != null) {
            newOrganizer = guestRepository.findById(dto.organizerGuestId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organizer guest not found"));
            reservation.setOrganizerGuest(newOrganizer);
        }
        reservation.setGroupReference(dto.groupReference());
        reservation.setSpecialRequests(dto.specialRequests());

        // Auto-assign the new organizer to any booking still holding the Temporary Guest placeholder.
        // Bookings that already have a real guest are left untouched.
        if (newOrganizer != null) {
            final Guest finalOrganizer = newOrganizer;
            List<Booking> tempGuestBookings = bookingRepository.findByReservationId(reservationId)
                    .stream()
                    .filter(b -> SystemConstants.TEMP_GUEST_ID.equals(b.getGuest().getId()))
                    .toList();
            if (!tempGuestBookings.isEmpty()) {
                tempGuestBookings.forEach(b -> b.setGuest(finalOrganizer));
                bookingRepository.saveAll(tempGuestBookings);
            }
        }

        // Travel agent — resolves by ID or creates a new one
        if (dto.travelAgentId() != null) {
            TravelAgent ta = travelAgentService.resolveOrCreate(dto.travelAgentId(), null);
            reservation.setTravelAgent(ta);
        }
        reservationRepository.save(reservation);

        // Reservation-level meal plan + booking source — applied uniformly to all bookings
        boolean hasMealPlanUpdate = dto.mealPlanType() != null;
        boolean hasBookingSourceUpdate = dto.bookingSource() != null;
        if (hasMealPlanUpdate || hasBookingSourceUpdate) {
            List<Booking> allBookings = bookingRepository.findByReservationId(reservationId);
            for (Booking b : allBookings) {
                if (hasMealPlanUpdate) {
                    b.setMealPlanType(dto.mealPlanType());
                    if (dto.mealPlanPricePerNight() != null) {
                        b.setMealPlanPricePerNight(dto.mealPlanPricePerNight());
                    }
                    if (dto.mealPlanChildrenPricePerNight() != null) {
                        b.setMealPlanChildrenPricePerNight(dto.mealPlanChildrenPricePerNight());
                    }
                }
                if (hasBookingSourceUpdate) {
                    b.setBookingSource(dto.bookingSource());
                }
            }
            bookingRepository.saveAll(allBookings);
        }

        if (dto.bookingUpdates() != null) {
            for (BookingOccupancyUpdateDto bu : dto.bookingUpdates()) {
                Booking booking = getValidatedBooking(propertyId, bu.bookingId(), reservationId);

                if (bu.guestId() != null && !bu.guestId().equals(booking.getGuest().getId())) {
                    Guest guest = guestRepository.findById(bu.guestId())
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                    "Guest not found for booking " + bu.bookingId()));
                    booking.setGuest(guest);
                }
                if (bu.adults() != null) booking.setAdults(bu.adults());
                if (bu.children() != null) booking.setChildren(bu.children());
                if (bu.isTwinBed() != null) booking.setTwinBed(bu.isTwinBed());
                if (bu.extraBeds() != null) {
                    booking.setExtraBeds(bu.extraBeds());
                    if (bu.extraBedRatePerNight() != null) {
                        booking.setExtraBedRatePerNight(bu.extraBedRatePerNight());
                    }
                }

                // Per-booking meal plan (legacy path — new UI sends at reservation level)
                if (bu.mealPlanType() != null) {
                    booking.setMealPlanType(bu.mealPlanType());
                    if (bu.mealPlanPricePerNight() != null) {
                        booking.setMealPlanPricePerNight(bu.mealPlanPricePerNight());
                    }
                    if (bu.mealPlanChildrenPricePerNight() != null) {
                        booking.setMealPlanChildrenPricePerNight(bu.mealPlanChildrenPricePerNight());
                    }
                }

                if (bu.nightlyRate() != null) {
                    long nights = ChronoUnit.DAYS.between(booking.getCheckIn(), booking.getCheckOut());
                    int adults = booking.getAdults() != null ? booking.getAdults() : 1;
                    int children = booking.getChildren() != null ? booking.getChildren() : 0;
                    int extraBeds = booking.getExtraBeds() != null ? booking.getExtraBeds() : 0;

                    BigDecimal mealNightly = BigDecimal.ZERO;
                    if (booking.getMealPlanType() != null) {
                        BigDecimal adultRate = booking.getMealPlanPricePerNight() != null ? booking.getMealPlanPricePerNight() : BigDecimal.ZERO;
                        BigDecimal childRate = booking.getMealPlanChildrenPricePerNight() != null ? booking.getMealPlanChildrenPricePerNight() : BigDecimal.ZERO;
                        mealNightly = adultRate.multiply(BigDecimal.valueOf(adults))
                                .add(childRate.multiply(BigDecimal.valueOf(children)));
                    }
                    BigDecimal extraBedNightly = BigDecimal.ZERO;
                    if (extraBeds > 0 && booking.getExtraBedRatePerNight() != null) {
                        extraBedNightly = booking.getExtraBedRatePerNight().multiply(BigDecimal.valueOf(extraBeds));
                    }

                    BigDecimal totalNightly = bu.nightlyRate().add(mealNightly).add(extraBedNightly);
                    booking.setTotalPrice(totalNightly.multiply(BigDecimal.valueOf(Math.max(nights, 0))));
                    booking.setExpectedNightlyRate(bu.nightlyRate());
                }
                bookingRepository.save(booking);
                roomAssignmentService.applyExpectedNightlyRate(booking);
            }
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, bookings);
    }

    // =========================================================================
    // CHECK-IN / CHECK-OUT
    // =========================================================================

    /**
     * Check in an entire reservation. Auto-assigns rooms where needed.
     * bookingId param is accepted for API compatibility but check-in is reservation-wide.
     */
    @Transactional
    public GroupBookingSummaryDto checkInBooking(UUID propertyId,
                                                 UUID reservationId,
                                                 UUID bookingId) {
        return checkInAllBookings(propertyId, reservationId);
    }

    @Transactional
    public GroupBookingSummaryDto checkInAllBookings(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);

        if (reservation.getStatus() != ReservationStatus.CONFIRMED
                && reservation.getStatus() != ReservationStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation must be CONFIRMED or PENDING to check in");
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);

        for (Booking booking : bookings) {
            if (booking.isCancelled()) continue;
            if (booking.getRoom() == null) {
                Room available = findAvailableRoomInUnit(
                        booking.getUnit().getId(), booking.getCheckIn(), booking.getCheckOut());
                if (available == null) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "No available room for unit " + booking.getUnit().getName()
                                    + ". Assign rooms manually before check-in.");
                }
                booking.setRoom(available);
            }
            bookingRepository.save(booking);
            // Ensure a RoomAssignment exists (applying any staged rate, or falling back to
            // the room's base rate) so Night Audit and POS can find/bill this booking.
            roomAssignmentService.applyExpectedNightlyRate(booking);
            roomAssignmentService.forceActivateAssignments(booking.getId());
        }

        reservation.setStatus(ReservationStatus.CHECKED_IN);
        reservationRepository.save(reservation);

        List<Booking> updated = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, updated);
    }

    /**
     * Check out a reservation. Enforces folio settlement before checkout.
     * bookingId param accepted for API compatibility but checkout is reservation-wide.
     */
    @Transactional
    public GroupBookingSummaryDto checkOutBooking(UUID propertyId,
                                                  UUID reservationId,
                                                  UUID bookingId) {
        return checkOutAllBookings(propertyId, reservationId);
    }

    @Transactional
    public GroupBookingSummaryDto checkOutAllBookings(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);

        if (reservation.getStatus() != ReservationStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Reservation must be CHECKED_IN to check out");
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        for (Booking booking : bookings) {
            if (booking.isCancelled()) continue;
            Folio folio = booking.getFolio();
            if (folio != null && !folio.isFullyPaid()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot check out: folio for booking " + booking.getId()
                                + " has an outstanding balance of " + folio.getBalanceDue()
                                + ". Settle the folio first.");
            }
            folioService.closeOpenFoliosForBooking(booking.getId());
        }

        reservation.setStatus(ReservationStatus.CHECKED_OUT);
        reservationRepository.save(reservation);

        List<Booking> updated = bookingRepository.findByReservationId(reservationId);
        return buildReservationSummary(reservation, updated);
    }

    /**
     * Cancel an individual booking (room) within the reservation.
     * If all bookings in the reservation are now cancelled, cancels the reservation too.
     */
    @Transactional
    public GroupBookingSummaryDto cancelBooking(UUID propertyId, UUID reservationId, UUID bookingId, String reason) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);
        Booking booking = getValidatedBooking(propertyId, bookingId, reservationId);

        if (reservation.getStatus() == ReservationStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot cancel a booking while the reservation is checked in. Check out first.");
        }

        booking.setCancelled(true);
        if (reason != null && !reason.isBlank()) {
            booking.setCancellationReason(reason.trim());
        }
        bookingRepository.save(booking);

        List<Booking> allBookings = bookingRepository.findByReservationId(reservationId);
        boolean allCancelled = allBookings.stream().allMatch(Booking::isCancelled);
        if (allCancelled) {
            reservation.setStatus(ReservationStatus.CANCELLED);
            reservationRepository.save(reservation);
        }

        return buildReservationSummary(reservation, allBookings);
    }

    /**
     * Cancel the entire reservation — marks all member bookings as cancelled.
     */
    @Transactional
    public GroupBookingSummaryDto cancelReservation(UUID propertyId, UUID reservationId) {
        Reservation reservation = getValidatedReservation(propertyId, reservationId);

        if (reservation.getStatus() == ReservationStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot cancel reservation: guests are already checked in. Check out first.");
        }

        List<Booking> bookings = bookingRepository.findByReservationId(reservationId);
        for (Booking booking : bookings) {
            if (!booking.isCancelled()) {
                booking.setCancelled(true);
                bookingRepository.save(booking);
            }
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

        if (reservation.getStatus() == ReservationStatus.CHECKED_IN
                || reservation.getStatus() == ReservationStatus.CHECKED_OUT
                || reservation.getStatus() == ReservationStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot reschedule: reservation has status " + reservation.getStatus());
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
                    // Prefer the committed rate on the active RoomAssignment; fall back to the
                    // staged expectedNightlyRate when no room is assigned yet.
                    RoomAssignment activeAssignment = roomAssignmentRepository.findByBookingId(b.getId())
                            .stream()
                            .filter(a -> a.getStatus() == RoomAssignmentStatus.SCHEDULED || a.getStatus() == RoomAssignmentStatus.ACTIVE)
                            .min(Comparator.comparing(RoomAssignment::getStartDate))
                            .orElse(null);
                    BigDecimal displayNightlyRate = activeAssignment != null
                            ? activeAssignment.getNightlyRate()
                            : b.getExpectedNightlyRate();
                    return new GroupBookingSummaryDto.BookingSummaryDto(
                            b.getId(),
                            b.getGuest().getId(),
                            b.getGuest().getFullName(),
                            b.getUnit() != null ? b.getUnit().getId() : null,
                            b.getUnit() != null ? b.getUnit().getName() : null,
                            b.getRoom() != null ? b.getRoom().getNumber() : null,
                            b.isCancelled(),
                            b.getAdults(),
                            b.getChildren(),
                            b.getTotalPrice(),
                            folio != null ? folio.getBalanceDue() : b.getBalanceDue(),
                            folio != null ? folio.getId() : null,
                            folio != null ? folio.getFolioNumber() : null,
                            b.getSpecialRequests(),
                            b.isTwinBed(),
                            unitBaseRate,
                            b.getMealPlanPricePerNight(),
                            b.getMealPlanType(),
                            b.getExtraBeds(),
                            displayNightlyRate
                    );
                })
                .collect(Collectors.toList());

        String billingMode = reservation.isDefaultRouteToMaster() ? "CONSOLIDATED" : "SEPARATE";

        List<Booking> activeBookings = bookings.stream()
                .filter(b -> !b.isCancelled())
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

        // Travel agent details from reservation
        TravelAgent ta = reservation.getTravelAgent();

        // Booking source — read from the first non-cancelled booking (uniform across all)
        String bookingSource = bookings.stream()
                .filter(b -> !b.isCancelled() && b.getBookingSource() != null)
                .map(Booking::getBookingSource)
                .findFirst()
                .orElse(null);

        return new GroupBookingSummaryDto(
                reservation.getId(),
                reservation.getReservationNumber(),
                reservation.getGroupReference(),
                reservation.getOrganizerGuest().getId(),
                reservation.getOrganizerGuest().getFullName(),
                derivedCheckIn,
                derivedCheckOut,
                reservation.getSpecialRequests(),
                reservation.getStatus(),
                bookings.size(),
                totalGroupPrice,
                reservation.getCurrency(),
                reservation.getCreatedAt(),
                billingMode,
                ta != null ? ta.getId() : null,
                ta != null ? ta.getName() : null,
                bookingSource,
                paymentService.getReservationLevelPaidAmount(reservation.getId()),
                bookingDtos
        );
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
                unitId, checkIn, checkOut);

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
