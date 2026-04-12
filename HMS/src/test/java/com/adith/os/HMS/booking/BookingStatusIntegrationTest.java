package com.adith.os.HMS.booking;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioRepository;
import com.adith.os.HMS.billing.folio.FolioType;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import com.adith.os.HMS.security.JwtService;
import com.adith.os.HMS.security.Role;
import com.adith.os.HMS.security.User;
import com.adith.os.HMS.security.UserPrincipal;
import com.adith.os.HMS.security.UserRepository;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BookingStatusIntegrationTest {

    @Autowired TestRestTemplate restTemplate;
    @Autowired JwtService jwtService;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired PropertyRepository propertyRepository;
    @Autowired UnitRepository unitRepository;
    @Autowired RoomRepository roomRepository;
    @Autowired GuestRepository guestRepository;
    @Autowired UserRepository userRepository;
    @Autowired BookingRepository bookingRepository;
    @Autowired FolioRepository folioRepository;
    @Autowired RoomAssignmentRepository roomAssignmentRepository;

    UUID propertyId;
    UUID unitId;
    UUID roomId;
    UUID guestId;
    UUID testUserId;
    UUID hkUserId;
    String jwtToken;
    String housekeepingJwt;
    UUID bookingId;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    // -----------------------------------------------------------------------
    // One-time setup
    // -----------------------------------------------------------------------

    @BeforeAll
    void setUpSharedFixtures() {
        Property property = new Property(
                "Integration Test Hotel", "INT_TEST_HTL",
                "1 Test Lane", "Test Region", "IN", "000000", "0000000000", 1, null);
        propertyId = propertyRepository.save(property).getId();

        Unit unit = new Unit("Test Unit", property, 0, 1);
        unit = unitRepository.save(unit);
        unitId = unit.getId();

        Room room = new Room(property, unit, "T101");
        room.setCapacity(2);
        room.setBaseRate(new BigDecimal("1000.00"));
        room.setStatus(RoomStatus.ACTIVE);
        roomId = roomRepository.save(room).getId();

        Guest guest = new Guest("Jane", "TestGuest", "jane.inttest@example.com",
                "9000000001", null, null, null);
        guestId = guestRepository.save(guest).getId();

        User fdUser = new User("int_test_frontdesk", passwordEncoder.encode("pass"),
                "inttest.fd@example.com", Role.FRONTDESK);
        fdUser = userRepository.save(fdUser);
        testUserId = fdUser.getId();
        jwtToken = jwtService.generateToken(new UserPrincipal(fdUser));

        User hkUser = new User("int_test_hk", passwordEncoder.encode("pass"),
                "inttest.hk@example.com", Role.HOUSEKEEPING);
        hkUser = userRepository.save(hkUser);
        hkUserId = hkUser.getId();
        housekeepingJwt = jwtService.generateToken(new UserPrincipal(hkUser));
    }

    @AfterAll
    void tearDownSharedFixtures() {
        userRepository.deleteById(testUserId);
        userRepository.deleteById(hkUserId);
        guestRepository.deleteById(guestId);
        propertyRepository.deleteById(propertyId); // cascades room + unit
    }

    // -----------------------------------------------------------------------
    // Per-test booking lifecycle
    // -----------------------------------------------------------------------

    @BeforeEach
    void createFreshBooking() {
        bookingId = createBookingViaApi(roomId, null, "2027-09-01", "2027-09-05");
    }

    @AfterEach
    void deleteBooking() {
        bookingRepository.deleteById(bookingId);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private ResponseEntity<Map<String, Object>> attemptCreateBooking(UUID forRoomId, UUID forUnitId, String checkIn, String checkOut) {
        return attemptCreateBookingWithJwt(forRoomId, forUnitId, checkIn, checkOut, jwtToken);
    }

    private ResponseEntity<Map<String, Object>> attemptCreateBookingWithJwt(
            UUID forRoomId, UUID forUnitId, String checkIn, String checkOut, String jwt) {
        HttpHeaders headers = new HttpHeaders();
        if (jwt != null) headers.set("Authorization", "Bearer " + jwt);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        if (forRoomId != null) body.put("roomId", forRoomId.toString());
        if (forUnitId != null) body.put("unitId", forUnitId.toString());
        body.put("guestId", guestId.toString());
        body.put("checkIn", checkIn);
        body.put("checkOut", checkOut);
        body.put("adults", 2);

        return restTemplate.exchange(
                "/api/properties/" + propertyId + "/bookings",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                MAP_TYPE);
    }

    private UUID createBookingViaApi(UUID forRoomId, UUID forUnitId, String checkIn, String checkOut) {
        ResponseEntity<Map<String, Object>> response = attemptCreateBooking(forRoomId, forUnitId, checkIn, checkOut);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return UUID.fromString((String) response.getBody().get("id"));
    }

    private HttpEntity<Void> withAuth() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + jwtToken);
        return new HttpEntity<>(headers);
    }

    private String bookingUrl(String suffix) {
        return "/api/properties/" + propertyId + "/bookings/" + bookingId + suffix;
    }

    private void confirm(UUID id) {
        restTemplate.exchange(
                "/api/properties/" + propertyId + "/bookings/" + id + "/status/CONFIRMED",
                HttpMethod.PATCH, withAuth(), MAP_TYPE);
    }

    private void checkIn(UUID id) {
        restTemplate.exchange(
                "/api/properties/" + propertyId + "/bookings/" + id + "/check-in",
                HttpMethod.POST, withAuth(), MAP_TYPE);
    }

    private UUID getFolioId(UUID bId) {
        return folioRepository.findByBookingAndType(bId, FolioType.MASTER)
                .orElseThrow().getId();
    }

    private RoomAssignmentStatus getAssignmentStatus(UUID bId) {
        List<com.adith.os.HMS.roomassignment.RoomAssignment> assignments =
                roomAssignmentRepository.findByBookingId(bId);
        assertThat(assignments).isNotEmpty();
        return assignments.get(0).getStatus();
    }

    // -----------------------------------------------------------------------
    // Status transition tests
    // -----------------------------------------------------------------------

    @Test
    void confirmBooking_shouldTransitionFromPendingToConfirmed() {
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/status/CONFIRMED"), HttpMethod.PATCH, withAuth(), MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("CONFIRMED");
    }

    @Test
    void checkIn_shouldTransitionFromConfirmedToCheckedIn() {
        confirm(bookingId);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/check-in"), HttpMethod.POST, withAuth(), MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("CHECKED_IN");
    }

    @Test
    void checkOut_shouldTransitionFromCheckedInToCheckedOut() {
        confirm(bookingId);
        checkIn(bookingId);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/checkout"), HttpMethod.POST, withAuth(), MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("CHECKED_OUT");
    }

    // -----------------------------------------------------------------------
    // Folio auto-creation
    // -----------------------------------------------------------------------

    @Test
    void createBooking_shouldAutoCreateMasterFolio() {
        Optional<Folio> masterFolio = folioRepository.findByBookingAndType(bookingId, FolioType.MASTER);

        assertThat(masterFolio).isPresent();
        assertThat(masterFolio.get().getFolioType()).isEqualTo(FolioType.MASTER);
    }

    // -----------------------------------------------------------------------
    // High priority: financial guard
    // -----------------------------------------------------------------------

    /**
     * Checkout must be blocked when the master folio has an outstanding balance.
     * A RESTAURANT charge is posted to the folio before the checkout attempt.
     */
    @Test
    void checkOut_shouldFail_whenFolioHasOutstandingBalance() {
        confirm(bookingId);
        checkIn(bookingId);

        // Post a charge to the folio
        UUID folioId = getFolioId(bookingId);
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + jwtToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> charge = new HashMap<>();
        charge.put("chargeDate", LocalDate.now().toString());
        charge.put("chargeCode", "RESTAURANT");
        charge.put("description", "Restaurant charge");
        charge.put("unitPrice", 5000);
        charge.put("quantity", 1);

        restTemplate.exchange(
                "/api/properties/" + propertyId + "/folios/" + folioId + "/charges",
                HttpMethod.POST,
                new HttpEntity<>(charge, headers),
                MAP_TYPE);

        // Checkout with unpaid balance must fail
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/checkout"), HttpMethod.POST, withAuth(), MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // -----------------------------------------------------------------------
    // High priority: cancellation frees the room
    // -----------------------------------------------------------------------

    /**
     * After a booking is cancelled, its room assignment is cancelled too.
     * The same room and dates must become available for a new booking.
     */
    @Test
    void cancel_shouldFreeRoomForRebooking() {
        confirm(bookingId);
        ResponseEntity<Map<String, Object>> cancelResponse = restTemplate.exchange(
                bookingUrl("/status/CANCELLED"), HttpMethod.PATCH, withAuth(), MAP_TYPE);

        assertThat(cancelResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(cancelResponse.getBody().get("status")).isEqualTo("CANCELLED");

        // Same room and dates should now be bookable again
        UUID rebookedId = null;
        try {
            rebookedId = createBookingViaApi(roomId, null, "2027-09-01", "2027-09-05");
        } finally {
            if (rebookedId != null) bookingRepository.deleteById(rebookedId);
        }
    }

    // -----------------------------------------------------------------------
    // High priority: no-show
    // -----------------------------------------------------------------------

    @Test
    void noShow_shouldTransitionStatus_andCancelRoomAssignment() {
        confirm(bookingId);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/status/NO_SHOW"), HttpMethod.PATCH, withAuth(), MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("NO_SHOW");
        assertThat(getAssignmentStatus(bookingId)).isEqualTo(RoomAssignmentStatus.CANCELLED);
    }

    // -----------------------------------------------------------------------
    // High priority: date validation
    // -----------------------------------------------------------------------

    @Test
    void createBooking_shouldFail_whenCheckInIsInPast() {
        ResponseEntity<Map<String, Object>> response = attemptCreateBooking(roomId, null, "2020-01-01", "2020-01-05");

        assertThat(response.getStatusCode().is4xxClientError()).isTrue();
    }

    @Test
    void createBooking_shouldFail_whenCheckOutIsNotAfterCheckIn() {
        ResponseEntity<Map<String, Object>> response = attemptCreateBooking(roomId, null, "2027-09-05", "2027-09-01");

        assertThat(response.getStatusCode().is4xxClientError()).isTrue();
    }

    // -----------------------------------------------------------------------
    // High priority: authorization
    // -----------------------------------------------------------------------

    @Test
    void createBooking_shouldReturn403_forUnauthorizedRole() {
        ResponseEntity<Map<String, Object>> response = attemptCreateBookingWithJwt(
                roomId, null, "2028-06-01", "2028-06-05", housekeepingJwt);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void bookingEndpoint_shouldDeny_requestWithoutJwt() {
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/api/properties/" + propertyId + "/bookings",
                HttpMethod.GET,
                new HttpEntity<>(new HttpHeaders()),
                MAP_TYPE);

        assertThat(response.getStatusCode().is4xxClientError()).isTrue();
    }

    // -----------------------------------------------------------------------
    // Check-in without room (failure and success paths)
    // -----------------------------------------------------------------------

    @Test
    void checkIn_shouldFail_whenNoRoomAvailableInUnit() {
        UUID noRoomBookingId = createBookingViaApi(null, unitId, "2027-10-01", "2027-10-05");
        UUID roomBlockerId = createBookingViaApi(roomId, null, "2027-10-01", "2027-10-05");

        try {
            confirm(noRoomBookingId);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    "/api/properties/" + propertyId + "/bookings/" + noRoomBookingId + "/check-in",
                    HttpMethod.POST, withAuth(), MAP_TYPE);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        } finally {
            bookingRepository.deleteById(noRoomBookingId);
            bookingRepository.deleteById(roomBlockerId);
        }
    }

    /**
     * When a unit-only booking (no pre-assigned room) checks in and the unit
     * has a free room, the service must auto-assign it and complete the check-in.
     */
    @Test
    void checkIn_shouldSucceed_andAutoAssignRoom_whenRoomIsAvailable() {
        UUID noRoomBookingId = createBookingViaApi(null, unitId, "2028-01-01", "2028-01-05");

        try {
            confirm(noRoomBookingId);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    "/api/properties/" + propertyId + "/bookings/" + noRoomBookingId + "/check-in",
                    HttpMethod.POST, withAuth(), MAP_TYPE);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().get("status")).isEqualTo("CHECKED_IN");
        } finally {
            bookingRepository.deleteById(noRoomBookingId);
        }
    }

    // -----------------------------------------------------------------------
    // Medium priority: room assignment lifecycle
    // -----------------------------------------------------------------------

    @Test
    void checkIn_shouldActivateRoomAssignment() {
        assertThat(getAssignmentStatus(bookingId)).isEqualTo(RoomAssignmentStatus.SCHEDULED);

        confirm(bookingId);
        checkIn(bookingId);

        assertThat(getAssignmentStatus(bookingId)).isEqualTo(RoomAssignmentStatus.ACTIVE);
    }

    @Test
    void checkOut_shouldCompleteRoomAssignment() {
        confirm(bookingId);
        checkIn(bookingId);

        restTemplate.exchange(bookingUrl("/checkout"), HttpMethod.POST, withAuth(), MAP_TYPE);

        assertThat(getAssignmentStatus(bookingId)).isEqualTo(RoomAssignmentStatus.COMPLETED);
    }

    @Test
    void cancel_shouldCancelRoomAssignment() {
        confirm(bookingId);

        restTemplate.exchange(bookingUrl("/status/CANCELLED"), HttpMethod.PATCH, withAuth(), MAP_TYPE);

        assertThat(getAssignmentStatus(bookingId)).isEqualTo(RoomAssignmentStatus.CANCELLED);
    }

    // -----------------------------------------------------------------------
    // Medium priority: early checkout
    // -----------------------------------------------------------------------

    /**
     * NO_CHANGE policy: checkout date is updated, status becomes CHECKED_OUT,
     * and no folio charges are modified.
     */
    @Test
    void checkoutEarly_noChange_shouldUpdateCheckoutDate() {
        confirm(bookingId);
        checkIn(bookingId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + jwtToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("newCheckOutDate", "2027-09-03");
        body.put("policy", "NO_CHANGE");

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/checkout-early"),
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status")).isEqualTo("CHECKED_OUT");
        assertThat(response.getBody().get("checkOut")).isEqualTo("2027-09-03");
    }

    /**
     * CUSTOM policy rejects a negative customRoomCharge with 400.
     */
    @Test
    void checkoutEarly_customPolicy_shouldRejectNegativeCharge() {
        confirm(bookingId);
        checkIn(bookingId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + jwtToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("newCheckOutDate", "2027-09-03");
        body.put("policy", "CUSTOM");
        body.put("customRoomCharge", -500);

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                bookingUrl("/checkout-early"),
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                MAP_TYPE);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // -----------------------------------------------------------------------
    // Overbooking tests
    // -----------------------------------------------------------------------

    @Test
    void createBooking_shouldFail_whenRoomAlreadyBookedForOverlappingDates() {
        UUID firstBookingId = createBookingViaApi(roomId, null, "2027-11-01", "2027-11-05");

        try {
            ResponseEntity<Map<String, Object>> response = attemptCreateBooking(roomId, null, "2027-11-03", "2027-11-07");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        } finally {
            bookingRepository.deleteById(firstBookingId);
        }
    }

    @Test
    void createBooking_shouldFail_whenUnitAtFullCapacity() {
        Property property = propertyRepository.findById(propertyId).orElseThrow();

        Unit fullUnit = unitRepository.save(new Unit("Full Unit", property, 9, 2));
        Room r1 = new Room(property, fullUnit, "T201");
        r1.setCapacity(2); r1.setBaseRate(new BigDecimal("1000.00")); r1.setStatus(RoomStatus.ACTIVE);
        r1 = roomRepository.save(r1);
        Room r2 = new Room(property, fullUnit, "T202");
        r2.setCapacity(2); r2.setBaseRate(new BigDecimal("1000.00")); r2.setStatus(RoomStatus.ACTIVE);
        r2 = roomRepository.save(r2);

        UUID b1 = null, b2 = null;
        try {
            b1 = createBookingViaApi(r1.getId(), null, "2027-11-01", "2027-11-05");
            b2 = createBookingViaApi(r2.getId(), null, "2027-11-01", "2027-11-05");

            ResponseEntity<Map<String, Object>> response = attemptCreateBooking(null, fullUnit.getId(), "2027-11-01", "2027-11-05");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        } finally {
            if (b1 != null) bookingRepository.deleteById(b1);
            if (b2 != null) bookingRepository.deleteById(b2);
            roomRepository.deleteById(r1.getId());
            roomRepository.deleteById(r2.getId());
            unitRepository.deleteById(fullUnit.getId());
        }
    }

    @Test
    void createBooking_shouldFail_whenRoomBlockedByPendingBooking() {
        UUID pendingBookingId = createBookingViaApi(roomId, null, "2027-12-01", "2027-12-05");

        try {
            ResponseEntity<Map<String, Object>> response = attemptCreateBooking(roomId, null, "2027-12-01", "2027-12-05");

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        } finally {
            bookingRepository.deleteById(pendingBookingId);
        }
    }
}
