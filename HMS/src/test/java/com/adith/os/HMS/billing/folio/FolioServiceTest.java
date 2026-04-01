package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioCreationDto;
import com.adith.os.HMS.billing.folio.dto.FolioDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.guest.GuestRepository;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FolioServiceTest {

    @Mock private FolioRepository folioRepository;
    @Mock private FolioChargeRepository folioChargeRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private FolioMapper folioMapper;

    @InjectMocks
    private FolioService folioService;

    // --- Fixture builders ---

    private Property buildProperty(UUID id) {
        Property p = new Property();
        p.setId(id);
        p.setCode("TST");
        p.setName("Test Hotel");
        return p;
    }

    private Guest buildGuest(UUID id) {
        Guest g = new Guest();
        g.setId(id);
        g.setFirstName("John");
        g.setLastName("Doe");
        return g;
    }

    private Folio buildOpenFolio(UUID folioId, Property property, Guest guest) {
        Folio folio = new Folio();
        folio.setId(folioId);
        folio.setFolioNumber("FO-TST-20260401-00001");
        folio.setProperty(property);
        folio.setGuest(guest);
        folio.setStatus(FolioStatus.OPEN);
        folio.setFolioType(FolioType.MASTER);
        return folio;
    }

    private FolioCharge buildNonBilledCharge(UUID chargeId, Folio folio) {
        FolioCharge charge = new FolioCharge();
        charge.setId(chargeId);
        charge.setFolio(folio);
        charge.setChargeCode(ChargeCode.RESTAURANT);
        charge.setDescription("Dinner");
        charge.setChargeDate(LocalDate.now());
        charge.setUnitPrice(new BigDecimal("500"));
        charge.setQuantity(BigDecimal.ONE);
        charge.setTaxRate(BigDecimal.ZERO);
        charge.setDiscountRate(BigDecimal.ZERO);
        charge.calculateAmounts();
        // bill and groupBill are null → not finalized
        return charge;
    }

    // =========================================================================
    // createFolio
    // =========================================================================

    @Test
    void createFolio_success_savesAndReturnsDto() {
        UUID propertyId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(guestId);

        FolioCreationDto dto = new FolioCreationDto(null, guestId, null, null, "user", null);

        Folio newFolio = new Folio();
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(guest));
        when(folioRepository.count()).thenReturn(0L);
        when(folioRepository.existsByFolioNumber(any())).thenReturn(false);
        when(folioMapper.toEntity(any(), eq(property), eq(guest), isNull())).thenReturn(newFolio);
        when(folioRepository.save(newFolio)).thenReturn(newFolio);
        when(folioMapper.toDto(newFolio)).thenReturn(mock(FolioDto.class));

        FolioDto result = folioService.createFolio(propertyId, dto);

        assertThat(result).isNotNull();
        verify(folioRepository).save(newFolio);
        verify(folioMapper).toDto(newFolio);
    }

    @Test
    void createFolio_propertyNotFound_throws404() {
        UUID propertyId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        FolioCreationDto dto = new FolioCreationDto(null, guestId, null, null, "user", null);

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> folioService.createFolio(propertyId, dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Property not found");
    }

    @Test
    void createFolio_guestNotFound_throws404() {
        UUID propertyId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        FolioCreationDto dto = new FolioCreationDto(null, guestId, null, null, "user", null);

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(guestRepository.findById(guestId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> folioService.createFolio(propertyId, dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Guest not found");
    }

    @Test
    void createFolio_bookingBelongsToDifferentProperty_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        UUID bookingId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(guestId);

        // Booking belongs to a different property
        Property otherProperty = buildProperty(UUID.randomUUID());
        Booking booking = new Booking();
        booking.setProperty(otherProperty);

        FolioCreationDto dto = new FolioCreationDto(bookingId, guestId, null, null, "user", null);

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(guest));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> folioService.createFolio(propertyId, dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Booking does not belong");
    }

    @Test
    void createFolio_routingToChainedFolio_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID guestId = UUID.randomUUID();
        UUID routeTargetId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(guestId);

        // Target folio is itself already routed (i.e., a chain would form)
        Folio grandparent = new Folio();
        Folio routeTarget = buildOpenFolio(routeTargetId, property, guest);
        routeTarget.setRoutedToFolio(grandparent); // it's already routed

        FolioCreationDto dto = new FolioCreationDto(null, guestId, null, null, "user", routeTargetId);

        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(guestRepository.findById(guestId)).thenReturn(Optional.of(guest));
        when(folioRepository.findById(routeTargetId)).thenReturn(Optional.of(routeTarget));

        assertThatThrownBy(() -> folioService.createFolio(propertyId, dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("routing chains are not supported");
    }

    // =========================================================================
    // addCharge
    // =========================================================================

    @Test
    void addCharge_success_savesChargeAndRecalculates() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);

        ChargeCreationDto dto = new ChargeCreationDto(
                LocalDate.now(), ChargeCode.RESTAURANT, "Dinner",
                new BigDecimal("500"), null, null, null,
                null, null, null, "user");

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        // Simulate @PrePersist: calculateAmounts() fires when JPA saves the charge
        when(folioChargeRepository.save(any(FolioCharge.class))).thenAnswer(inv -> {
            FolioCharge c = inv.getArgument(0);
            c.calculateAmounts();
            return c;
        });
        when(folioRepository.save(folio)).thenReturn(folio);
        when(folioMapper.toDto(folio)).thenReturn(mock(FolioDto.class));

        folioService.addCharge(propertyId, folioId, dto);

        verify(folioChargeRepository).save(any(FolioCharge.class));
        verify(folioRepository).save(folio);
    }

    @Test
    void addCharge_closedFolio_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        folio.close(); // now CLOSED

        ChargeCreationDto dto = new ChargeCreationDto(
                LocalDate.now(), ChargeCode.RESTAURANT, "Dinner",
                new BigDecimal("500"), null, null, null,
                null, null, null, "user");

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));

        assertThatThrownBy(() -> folioService.addCharge(propertyId, folioId, dto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("closed or posted folio");
    }

    @Test
    void addCharge_bubblesUpToParentFolio() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());

        Folio parentFolio = buildOpenFolio(UUID.randomUUID(), property, guest);
        Folio childFolio = buildOpenFolio(folioId, property, guest);
        childFolio.setRoutedToFolio(parentFolio);

        ChargeCreationDto dto = new ChargeCreationDto(
                LocalDate.now(), ChargeCode.RESTAURANT, "Snack",
                new BigDecimal("100"), null, null, null,
                null, null, null, "user");

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(childFolio));
        // Simulate @PrePersist: calculateAmounts() fires when JPA saves the charge
        when(folioChargeRepository.save(any(FolioCharge.class))).thenAnswer(inv -> {
            FolioCharge c = inv.getArgument(0);
            c.calculateAmounts();
            return c;
        });
        when(folioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(folioMapper.toDto(childFolio)).thenReturn(mock(FolioDto.class));

        folioService.addCharge(propertyId, folioId, dto);

        // Parent should be saved too (bubbled-up recalculation)
        verify(folioRepository, times(2)).save(any(Folio.class));
    }

    // =========================================================================
    // voidCharge
    // =========================================================================

    @Test
    void voidCharge_success_voidsAndRecalculates() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        FolioCharge charge = buildNonBilledCharge(chargeId, folio);

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));
        when(folioChargeRepository.save(charge)).thenReturn(charge);
        when(folioRepository.save(folio)).thenReturn(folio);
        when(folioMapper.toDto(folio)).thenReturn(mock(FolioDto.class));

        folioService.voidCharge(propertyId, folioId, chargeId, "Wrong charge", "manager");

        assertThat(charge.isVoided()).isTrue();
        verify(folioChargeRepository).save(charge);
    }

    @Test
    void voidCharge_emptyReason_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        assertThatThrownBy(() -> folioService.voidCharge(propertyId, folioId, chargeId, "  ", "user"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Void reason is required");
    }

    @Test
    void voidCharge_alreadyOnBill_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);

        FolioCharge charge = buildNonBilledCharge(chargeId, folio);
        // Simulate charge being finalized on a bill
        com.adith.os.HMS.billing.bills.Bill bill = new com.adith.os.HMS.billing.bills.Bill();
        charge.setBill(bill);

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));

        assertThatThrownBy(() -> folioService.voidCharge(propertyId, folioId, chargeId, "mistake", "manager"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("finalized on a bill");
    }

    // =========================================================================
    // closeFolio
    // =========================================================================

    @Test
    void closeFolio_success_setsStatusClosed() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioRepository.save(folio)).thenReturn(folio);
        when(folioMapper.toDto(folio)).thenReturn(mock(FolioDto.class));

        folioService.closeFolio(propertyId, folioId, "manager");

        assertThat(folio.getStatus()).isEqualTo(FolioStatus.CLOSED);
    }

    @Test
    void closeFolio_hasOpenRoutedChild_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);

        Folio openChild = new Folio();
        openChild.setStatus(FolioStatus.OPEN);
        folio.setRoutedFolios(new ArrayList<>(List.of(openChild)));

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));

        assertThatThrownBy(() -> folioService.closeFolio(propertyId, folioId, "manager"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("routed child folios are still open");
    }

    // =========================================================================
    // postFolio
    // =========================================================================

    @Test
    void postFolio_closedAndFullyPaid_setsStatusPosted() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        folio.close(); // OPEN → CLOSED
        // No charges, no payments → balance is 0 → isFullyPaid() == true

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioRepository.save(folio)).thenReturn(folio);
        when(folioMapper.toDto(folio)).thenReturn(mock(FolioDto.class));

        folioService.postFolio(propertyId, folioId);

        assertThat(folio.getStatus()).isEqualTo(FolioStatus.POSTED);
    }

    @Test
    void postFolio_openFolio_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest); // still OPEN

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));

        assertThatThrownBy(() -> folioService.postFolio(propertyId, folioId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only closed folios can be posted");
    }

    // =========================================================================
    // reopenFolio
    // =========================================================================

    @Test
    void reopenFolio_closedFolio_setsStatusOpen() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        folio.close(); // CLOSED

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioRepository.save(folio)).thenReturn(folio);
        when(folioMapper.toDto(folio)).thenReturn(mock(FolioDto.class));

        folioService.reopenFolio(propertyId, folioId, "manager");

        assertThat(folio.getStatus()).isEqualTo(FolioStatus.OPEN);
        assertThat(folio.getClosedAt()).isNull();
    }

    @Test
    void reopenFolio_postedFolio_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        folio.close();
        folio.post(); // POSTED

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));

        assertThatThrownBy(() -> folioService.reopenFolio(propertyId, folioId, "manager"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Cannot reopen a posted folio");
    }

    // =========================================================================
    // routeCharge
    // =========================================================================

    @Test
    void routeCharge_success_movesChargeToTargetFolio() {
        UUID propertyId = UUID.randomUUID();
        UUID sourceFolioId = UUID.randomUUID();
        UUID targetFolioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());

        Folio sourceFolio = buildOpenFolio(sourceFolioId, property, guest);
        Folio targetFolio = buildOpenFolio(targetFolioId, property, guest);
        // targetFolio is not routed (routedToFolio == null)

        FolioCharge charge = buildNonBilledCharge(chargeId, sourceFolio);
        sourceFolio.getCharges().add(charge);

        when(folioRepository.findById(sourceFolioId)).thenReturn(Optional.of(sourceFolio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));
        when(folioRepository.findById(targetFolioId)).thenReturn(Optional.of(targetFolio));
        when(folioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(folioMapper.toDto(sourceFolio)).thenReturn(mock(FolioDto.class));

        folioService.routeCharge(propertyId, sourceFolioId, chargeId, targetFolioId);

        assertThat(charge.getFolio()).isEqualTo(targetFolio);
        verify(folioChargeRepository).save(charge);
    }

    @Test
    void routeCharge_sameSourceAndTarget_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());
        Folio folio = buildOpenFolio(folioId, property, guest);
        FolioCharge charge = buildNonBilledCharge(chargeId, folio);

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));

        assertThatThrownBy(() -> folioService.routeCharge(propertyId, folioId, chargeId, folioId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("cannot be the same");
    }

    @Test
    void routeCharge_targetFolioIsRouted_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID sourceFolioId = UUID.randomUUID();
        UUID targetFolioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());

        Folio sourceFolio = buildOpenFolio(sourceFolioId, property, guest);
        Folio targetFolio = buildOpenFolio(targetFolioId, property, guest);
        // Target is itself routed to another folio → routing chain
        targetFolio.setRoutedToFolio(new Folio());

        FolioCharge charge = buildNonBilledCharge(chargeId, sourceFolio);

        when(folioRepository.findById(sourceFolioId)).thenReturn(Optional.of(sourceFolio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));
        when(folioRepository.findById(targetFolioId)).thenReturn(Optional.of(targetFolio));

        assertThatThrownBy(() -> folioService.routeCharge(propertyId, sourceFolioId, chargeId, targetFolioId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("routing chains are not supported");
    }

    @Test
    void routeCharge_voidedCharge_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID sourceFolioId = UUID.randomUUID();
        UUID targetFolioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());

        Folio sourceFolio = buildOpenFolio(sourceFolioId, property, guest);
        FolioCharge charge = buildNonBilledCharge(chargeId, sourceFolio);
        charge.voidCharge("user", "error"); // already voided

        when(folioRepository.findById(sourceFolioId)).thenReturn(Optional.of(sourceFolio));
        when(folioChargeRepository.findById(chargeId)).thenReturn(Optional.of(charge));

        assertThatThrownBy(() -> folioService.routeCharge(propertyId, sourceFolioId, chargeId, targetFolioId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("voided charge");
    }

    @Test
    void routeCharge_sourceFolioIsClosed_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID sourceFolioId = UUID.randomUUID();
        UUID targetFolioId = UUID.randomUUID();
        UUID chargeId = UUID.randomUUID();

        Property property = buildProperty(propertyId);
        Guest guest = buildGuest(UUID.randomUUID());

        Folio sourceFolio = buildOpenFolio(sourceFolioId, property, guest);
        sourceFolio.close(); // CLOSED — can't route from closed folio

        when(folioRepository.findById(sourceFolioId)).thenReturn(Optional.of(sourceFolio));

        assertThatThrownBy(() -> folioService.routeCharge(propertyId, sourceFolioId, chargeId, targetFolioId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("closed or posted folio");
    }
}
