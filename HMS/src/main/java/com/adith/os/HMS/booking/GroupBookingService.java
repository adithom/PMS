package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.booking.dto.*;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
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
    private final FolioRepository folioRepository;
    private final FolioService folioService;

    public GroupBookingService(
            PropertyRepository propertyRepository,
            GuestRepository guestRepository,
            UnitRepository unitRepository,
            RoomRepository roomRepository,
            BookingRepository bookingRepository,
            FolioRepository folioRepository,
            FolioService folioService) {
        this.propertyRepository = propertyRepository;
        this.guestRepository = guestRepository;
        this.unitRepository = unitRepository;
        this.roomRepository = roomRepository;
        this.bookingRepository = bookingRepository;
        this.folioRepository = folioRepository;
        this.folioService = folioService;
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    /**
     * Creates a complete group booking in a single transaction.
     *
     * What happens here:
     * 1. Validate all inputs upfront (fail fast before touching the DB)
     * 2. Create the parent (master) booking — no unit/room, isGroupMaster=true
     * 3. For each room request, create a child booking linked to the parent
     * 4. Auto-create a master folio for each child booking
     * 5. If billingMode is CONSOLIDATED, route all child folios to the
     *    organizer's folio (created on the parent booking)
     */
    @Transactional
    public GroupBookingSummaryDto createGroupBooking(UUID propertyId,
                                                     @Valid GroupBookingCreationDto dto) {
        // --- Validate property ---
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));

        // --- Validate dates ---
        if (dto.checkOut() == null || !dto.checkOut().isAfter(dto.checkIn())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Check-out date must be after check-in date");
        }

        // --- Validate organizer guest ---
        Guest organizer = guestRepository.findById(dto.organizerGuestId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Organizer guest not found"));

        // --- Validate all room requests upfront (fail before any DB writes) ---
        List<ValidatedRoomRequest> validated = validateAndResolveRoomRequests(
                propertyId, dto, organizer);

        // ---- 1. Create the parent booking ----
        Booking parent = new Booking();
        parent.setProperty(property);
        parent.setGuest(organizer);
        parent.setUnit(null);   // master booking has no unit
        parent.setRoom(null);
        parent.setCheckIn(dto.checkIn());
        parent.setCheckOut(dto.checkOut());
        parent.setAdults(0);    // headcount lives on children
        parent.setChildren(0);
        parent.setCurrency(dto.currency());
        parent.setTotalPrice(BigDecimal.ZERO); // will be set after children are summed
        parent.setPaidAmount(BigDecimal.ZERO);
        parent.setSpecialRequests(dto.specialRequests());
        parent.setStatus(BookingStatus.CONFIRMED);
        parent.setGroupMaster(true);
        if (dto.groupReference() != null) {
            parent.setGroupReference(dto.groupReference());
        }
        Booking savedParent = bookingRepository.save(parent);

        // ---- 2. Create a folio on the parent (used for consolidated billing) ----
        FolioCreationDto parentFolioDto = new FolioCreationDto(
                savedParent.getId(),
                organizer.getId(),
                FolioType.MASTER,
                "Group organizer folio" + (dto.groupReference() != null ? " - " + dto.groupReference() : ""),
                "SYSTEM",
                null    // no routing on the parent folio itself
        );
        var parentFolioDto2 = folioService.createFolio(propertyId, parentFolioDto);
        UUID parentFolioId = parentFolioDto2.id();

        // ---- 3. Create child bookings ----
        List<Booking> savedChildren = new ArrayList<>();
        BigDecimal totalGroupPrice = BigDecimal.ZERO;

        for (ValidatedRoomRequest vr : validated) {
            Booking child = new Booking();
            child.setProperty(property);
            child.setGuest(vr.guest());
            child.setUnit(vr.unit());
            child.setRoom(vr.room()); // may be null — assigned at check-in
            child.setCheckIn(dto.checkIn());
            child.setCheckOut(dto.checkOut());
            child.setAdults(vr.request().adults());
            child.setChildren(vr.request().children());
            child.setCurrency(dto.currency());
            child.setTotalPrice(vr.request().totalPrice());
            child.setPaidAmount(BigDecimal.ZERO);
            child.setSpecialRequests(vr.request().specialRequests());
            child.setStatus(BookingStatus.CONFIRMED);
            child.setGroupMaster(false);
            child.setParentBooking(savedParent);

            Booking savedChild = bookingRepository.save(child);
            savedChildren.add(savedChild);
            totalGroupPrice = totalGroupPrice.add(vr.request().totalPrice());

            // ---- 4. Create master folio for this child booking ----
            UUID routedTo = dto.billingMode() == GroupBookingCreationDto.GroupBillingMode.CONSOLIDATED
                    ? parentFolioId
                    : null;

            FolioCreationDto childFolioDto = new FolioCreationDto(
                    savedChild.getId(),
                    vr.guest().getId(),
                    FolioType.MASTER,
                    vr.request().specialRequests(),
                    "SYSTEM",
                    routedTo
            );
            folioService.createFolio(propertyId, childFolioDto);
        }

        // ---- 5. Update parent total price ----
        savedParent.setTotalPrice(totalGroupPrice);
        bookingRepository.save(savedParent);

        // ---- 6. Build and return summary ----
        return buildGroupSummary(savedParent, savedChildren, parentFolioId,
                dto.billingMode().name(), property);
    }

    // =========================================================================
    // READ
    // =========================================================================

    /**
     * Fetch a complete group booking summary by parent booking ID.
     */
    public GroupBookingSummaryDto getGroupBookingSummary(UUID propertyId, UUID parentBookingId) {
        Booking parent = bookingRepository.findById(parentBookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found"));

        if (!parent.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to this property");
        }

        if (!parent.isGroupMaster()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking " + parentBookingId + " is not a group master booking");
        }

        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);

        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;

        // Infer billing mode from whether children are routed
        String billingMode = inferBillingMode(children, parentFolioId);

        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    /**
     * Get all group bookings for a property (returns only the parent bookings).
     */
    public List<GroupBookingSummaryDto> getGroupBookingsByProperty(UUID propertyId) {
        if (!propertyRepository.existsById(propertyId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found");
        }

        List<Booking> groupMasters = bookingRepository.findGroupMastersByPropertyId(propertyId);

        return groupMasters.stream()
                .map(parent -> {
                    List<Booking> children = bookingRepository.findByParentBookingId(parent.getId());
                    Folio parentFolio = parent.getMasterFolio();
                    UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
                    String billingMode = inferBillingMode(children, parentFolioId);
                    return buildGroupSummary(parent, children, parentFolioId, billingMode,
                            parent.getProperty());
                })
                .collect(Collectors.toList());
    }

    // =========================================================================
    // BILLING OPERATIONS
    // =========================================================================

    /**
     * Route a child folio to the parent/organizer folio (consolidated billing).
     * Can also be used to un-route (pass null as targetFolioId) for separate billing.
     */
    @Transactional
    public GroupBookingSummaryDto routeChildFolio(UUID propertyId,
                                                  UUID parentBookingId,
                                                  UUID childBookingId,
                                                  UUID targetFolioId) {
        Booking parent = getValidatedGroupMaster(propertyId, parentBookingId);
        Booking child = getValidatedChildBooking(propertyId, childBookingId, parentBookingId);

        Folio childFolio = child.getMasterFolio();
        if (childFolio == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Child booking has no master folio");
        }

        // 1. Capture the previous target before making any changes
        Folio previousTargetFolio = childFolio.getRoutedToFolio();

        if (targetFolioId != null) {
            Folio targetFolio = folioRepository.findById(targetFolioId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Target folio not found"));
            if (!targetFolio.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Target folio does not belong to this property");
            }

            // FIX: Actually apply the routing (this was missing in the original code)
            childFolio.setRoutedToFolio(targetFolio);

            childFolio.recalculateTotals();
            targetFolio.recalculateTotals();
            folioRepository.save(targetFolio);

            // Edge case: If the room was routed to Folio A and is now being routed to Folio B,
            // we must recalculate Folio A so it drops the charges.
            if (previousTargetFolio != null && !previousTargetFolio.getId().equals(targetFolioId)) {
                previousTargetFolio.recalculateTotals();
                folioRepository.save(previousTargetFolio);
            }

        } else {
            // Un-route — child pays independently
            childFolio.setRoutedToFolio(null);
            childFolio.recalculateTotals();

            // FIX: Recalculate and save the previous target folio so it drops the child's balance
            if (previousTargetFolio != null) {
                previousTargetFolio.recalculateTotals();
                folioRepository.save(previousTargetFolio);
            }
        }

        folioRepository.save(childFolio);

        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);

        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    /**
     * Route ALL child folios to the organizer's master folio (switch to consolidated).
     */
    @Transactional
    public GroupBookingSummaryDto consolidateBilling(UUID propertyId, UUID parentBookingId) {
        Booking parent = getValidatedGroupMaster(propertyId, parentBookingId);
        Folio parentFolio = parent.getMasterFolio();
        if (parentFolio == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Parent booking has no master folio");
        }

        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        for (Booking child : children) {
            Folio childFolio = child.getMasterFolio();
            if (childFolio != null && !childFolio.getId().equals(parentFolio.getId())) {
                childFolio.setRoutedToFolio(parentFolio);
                folioRepository.save(childFolio);
            }
        }

        String billingMode = inferBillingMode(children, parentFolio.getId());
        return buildGroupSummary(parent, children, parentFolio.getId(), billingMode,
                parent.getProperty());
    }

    /**
     * Un-route ALL child folios — each room settles independently (switch to separate).
     */
    @Transactional
    public GroupBookingSummaryDto separateBilling(UUID propertyId, UUID parentBookingId) {
        Booking parent = getValidatedGroupMaster(propertyId, parentBookingId);

        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        for (Booking child : children) {
            Folio childFolio = child.getMasterFolio();
            if (childFolio != null && childFolio.isRouted()) {
                childFolio.setRoutedToFolio(null);
                folioRepository.save(childFolio);
            }
        }

        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);
        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    // =========================================================================
    // CHECK-IN / CHECK-OUT
    // =========================================================================

    /**
     * Check in a single child booking within the group.
     * Delegates to BookingService logic by updating status directly
     * (room auto-assignment is handled by BookingService.checkInBooking).
     */
    @Transactional
    public GroupBookingSummaryDto checkInChild(UUID propertyId,
                                               UUID parentBookingId,
                                               UUID childBookingId) {
        getValidatedGroupMaster(propertyId, parentBookingId);
        Booking child = getValidatedChildBooking(propertyId, childBookingId, parentBookingId);

        if (child.getStatus() != BookingStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Child booking must be in CONFIRMED status to check in");
        }

        // Auto-assign room if not yet assigned
        if (child.getRoom() == null) {
            Room available = findAvailableRoomInUnit(
                    child.getUnit().getId(), child.getCheckIn(), child.getCheckOut());
            if (available == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "No available rooms in unit for this child booking. Assign a room manually first.");
            }
            child.setRoom(available);
        }

        child.setStatus(BookingStatus.CHECKED_IN);
        bookingRepository.save(child);

        Booking parent = bookingRepository.findById(parentBookingId).orElseThrow();
        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);
        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    /**
     * Check in ALL confirmed children at once.
     */
    @Transactional
    public GroupBookingSummaryDto checkInAllChildren(UUID propertyId, UUID parentBookingId) {
        Booking parent = getValidatedGroupMaster(propertyId, parentBookingId);
        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);

        for (Booking child : children) {
            if (child.getStatus() == BookingStatus.CONFIRMED) {
                if (child.getRoom() == null) {
                    Room available = findAvailableRoomInUnit(
                            child.getUnit().getId(), child.getCheckIn(), child.getCheckOut());
                    if (available == null) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "No available room for unit " + child.getUnit().getName()
                                        + ". Assign rooms manually before bulk check-in.");
                    }
                    child.setRoom(available);
                }
                child.setStatus(BookingStatus.CHECKED_IN);
                bookingRepository.save(child);
            }
        }

        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        // Reload children after saves
        List<Booking> updatedChildren = bookingRepository.findByParentBookingId(parentBookingId);
        String billingMode = inferBillingMode(updatedChildren, parentFolioId);
        return buildGroupSummary(parent, updatedChildren, parentFolioId, billingMode,
                parent.getProperty());
    }

    /**
     * Check out a single child booking.
     * Enforces that the child's folio is settled before checkout
     * (unless it's routed — in that case the parent folio holds the balance).
     */
    @Transactional
    public GroupBookingSummaryDto checkOutChild(UUID propertyId,
                                                UUID parentBookingId,
                                                UUID childBookingId) {
        getValidatedGroupMaster(propertyId, parentBookingId);
        Booking child = getValidatedChildBooking(propertyId, childBookingId, parentBookingId);

        if (child.getStatus() != BookingStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Child booking must be CHECKED_IN to check out");
        }

        Folio childFolio = child.getMasterFolio();
        if (childFolio != null && !childFolio.isRouted() && !childFolio.isFullyPaid()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot check out: folio has an outstanding balance of "
                            + childFolio.getBalanceDue()
                            + ". Settle the folio or route it to the group master folio first.");
        }

        child.setStatus(BookingStatus.CHECKED_OUT);
        bookingRepository.save(child);

        Booking parent = bookingRepository.findById(parentBookingId).orElseThrow();
        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);
        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);
        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    /**
     * Cancel the entire group booking — cancels parent and all children.
     */
    @Transactional
    public GroupBookingSummaryDto cancelGroupBooking(UUID propertyId, UUID parentBookingId) {
        Booking parent = getValidatedGroupMaster(propertyId, parentBookingId);
        List<Booking> children = bookingRepository.findByParentBookingId(parentBookingId);

        for (Booking child : children) {
            if (child.getStatus() == BookingStatus.CHECKED_IN) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot cancel group: booking " + child.getId()
                                + " is already checked in. Check out individual rooms first.");
            }
            child.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(child);
        }

        parent.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(parent);

        Folio parentFolio = parent.getMasterFolio();
        UUID parentFolioId = parentFolio != null ? parentFolio.getId() : null;
        String billingMode = inferBillingMode(children, parentFolioId);
        return buildGroupSummary(parent, children, parentFolioId, billingMode,
                parent.getProperty());
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    /**
     * Validates all room requests before any DB writes.
     * Returns a list of resolved entities ready for booking creation.
     */
    private List<ValidatedRoomRequest> validateAndResolveRoomRequests(
            UUID propertyId,
            GroupBookingCreationDto dto,
            Guest organizer) {

        List<ValidatedRoomRequest> results = new ArrayList<>();

        for (int i = 0; i < dto.roomRequests().size(); i++) {
            GroupRoomRequestDto req = dto.roomRequests().get(i);
            String context = "Room request #" + (i + 1);

            // Resolve unit
            Unit unit = unitRepository.findById(req.unitId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            context + ": Unit not found"));

            if (!unit.getProperty().getId().equals(propertyId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        context + ": Unit does not belong to this property");
            }

            // Resolve room (optional)
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

                // 1. Check availability in Database
                if (bookingRepository.existsOverlappingBooking(
                        room.getId(), dto.checkIn(), dto.checkOut())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            context + ": Room " + room.getNumber()
                                    + " is not available for the selected dates");
                }

                // 2. NEW: Check if this specific room was ALREADY requested in this JSON batch
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
                // Unit-level capacity check
                long totalRooms = bookingRepository.countRoomsInUnit(unit.getId());
                long overlapping = bookingRepository.countOverlappingUnitBookings(
                        unit.getId(), dto.checkIn(), dto.checkOut());

                // Also count how many rooms in THIS request batch are targeting the same unit
                // to prevent double-booking within the same group creation
                long alreadyAllocatedInThisBatch = results.stream()
                        .filter(vr -> vr.unit().getId().equals(unit.getId()))
                        .count();

                if (overlapping + alreadyAllocatedInThisBatch >= totalRooms) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            context + ": Unit '" + unit.getName()
                                    + "' has no remaining capacity for these dates");
                }
            }

            // Resolve guest for this room
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

    private GroupBookingSummaryDto buildGroupSummary(
            Booking parent,
            List<Booking> children,
            UUID parentFolioId,
            String billingMode,
            Property property) {

        BigDecimal totalGroupPrice = children.stream()
                .map(Booking::getTotalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BookingStatus overallStatus = deriveOverallStatus(children);

        List<GroupBookingSummaryDto.ChildBookingSummaryDto> childDtos = children.stream()
                .map(child -> {
                    Folio childFolio = child.getMasterFolio();
                    return new GroupBookingSummaryDto.ChildBookingSummaryDto(
                            child.getId(),
                            child.getGuest().getId(),
                            child.getGuest().getFullName(),
                            child.getUnit() != null ? child.getUnit().getId() : null,
                            child.getUnit() != null ? child.getUnit().getName() : null,
                            child.getRoom() != null ? child.getRoom().getNumber() : null,
                            child.getStatus(),
                            child.getTotalPrice(),
                            child.getBalanceDue(),
                            childFolio != null ? childFolio.getId() : null,
                            childFolio != null ? childFolio.getFolioNumber() : null,
                            childFolio != null && childFolio.isRouted(),
                            child.getSpecialRequests()
                    );
                })
                .collect(Collectors.toList());


        return new GroupBookingSummaryDto(
                parent.getId(),
                parent.getGroupReference(),
                parent.getGuest().getId(),
                parent.getGuest().getFullName(),
                parent.getCheckIn(),
                parent.getCheckOut(),
                overallStatus,
                children.size(),
                totalGroupPrice,
                parent.getCurrency(),
                parent.getCreatedAt(),
                billingMode,
                parentFolioId,
                childDtos
        );
    }

    /**
     * Derives a single status for the group from child statuses.
     * Priority: CHECKED_IN > CONFIRMED > CHECKED_OUT > CANCELLED
     */
    private BookingStatus deriveOverallStatus(List<Booking> children) {
        if (children.isEmpty()) return BookingStatus.CONFIRMED;

        boolean anyCheckedIn = children.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.CHECKED_IN);
        if (anyCheckedIn) return BookingStatus.CHECKED_IN;

        boolean anyConfirmed = children.stream()
                .anyMatch(b -> b.getStatus() == BookingStatus.CONFIRMED);
        if (anyConfirmed) return BookingStatus.CONFIRMED;

        boolean allCheckedOut = children.stream()
                .allMatch(b -> b.getStatus() == BookingStatus.CHECKED_OUT);
        if (allCheckedOut) return BookingStatus.CHECKED_OUT;

        boolean allCancelled = children.stream()
                .allMatch(b -> b.getStatus() == BookingStatus.CANCELLED);
        if (allCancelled) return BookingStatus.CANCELLED;

        return BookingStatus.CONFIRMED;
    }

    private String inferBillingMode(List<Booking> children, UUID parentFolioId) {
        if (parentFolioId == null || children.isEmpty()) return "SEPARATE";

        boolean allRouted = children.stream().allMatch(child -> {
            Folio f = child.getMasterFolio();
            return f != null && f.isRouted()
                    && f.getRoutedToFolio().getId().equals(parentFolioId);
        });

        return allRouted ? "CONSOLIDATED" : "SEPARATE";
    }

    private Booking getValidatedGroupMaster(UUID propertyId, UUID parentBookingId) {
        Booking parent = bookingRepository.findById(parentBookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Group booking not found"));
        if (!parent.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking does not belong to this property");
        }
        if (!parent.isGroupMaster()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking is not a group master");
        }
        return parent;
    }

    private Booking getValidatedChildBooking(UUID propertyId, UUID childBookingId,
                                             UUID expectedParentId) {
        Booking child = bookingRepository.findById(childBookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Child booking not found"));
        if (!child.getProperty().getId().equals(propertyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Child booking does not belong to this property");
        }
        if (child.getParentBooking() == null
                || !child.getParentBooking().getId().equals(expectedParentId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Booking " + childBookingId + " is not a child of group " + expectedParentId);
        }
        return child;
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
