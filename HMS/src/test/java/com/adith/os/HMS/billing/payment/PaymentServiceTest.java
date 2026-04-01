package com.adith.os.HMS.billing.payment;

import com.adith.os.HMS.billing.folio.*;
import com.adith.os.HMS.billing.payment.dto.PaymentCreationDto;
import com.adith.os.HMS.billing.payment.dto.PaymentDto;
import com.adith.os.HMS.billing.payment.dto.RefundDto;
import com.adith.os.HMS.guest.Guest;
import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private FolioRepository folioRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PaymentMapper paymentMapper;

    @InjectMocks
    private PaymentService paymentService;

    // --- Fixture builders ---

    private Property buildProperty(UUID id) {
        Property p = new Property();
        p.setId(id);
        p.setCode("TST");
        p.setName("Test Hotel");
        return p;
    }

    private Folio buildOpenFolio(UUID folioId, Property property, FolioType type) {
        Guest guest = new Guest();
        guest.setId(UUID.randomUUID());
        guest.setFirstName("Jane");
        guest.setLastName("Smith");

        Folio folio = new Folio();
        folio.setId(folioId);
        folio.setFolioNumber("FO-TST-20260401-00001");
        folio.setProperty(property);
        folio.setGuest(guest);
        folio.setStatus(FolioStatus.OPEN);
        folio.setFolioType(type);
        return folio;
    }

    private Payment buildCompletedPayment(UUID paymentId, Folio folio, BigDecimal amount) {
        Payment payment = new Payment();
        payment.setId(paymentId);
        payment.setFolio(folio);
        payment.setAmount(amount);
        payment.setPaymentMethod(PaymentMethod.CASH);
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);
        payment.setPaymentNumber("PAY-TST-20260401-00001");
        return payment;
    }

    private PaymentCreationDto buildPaymentDto(BigDecimal amount) {
        return new PaymentCreationDto(amount, PaymentMethod.CASH, ChargeCategory.ANCILLARY,
                null, null, null, null, null, null, null, null, "user");
    }

    // =========================================================================
    // recordPayment
    // =========================================================================

    @Test
    void recordPayment_success_savesAndReturnsDto() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.MASTER);

        // Charge of 1000, no payment yet → balance = 1000
        FolioCharge charge = new FolioCharge();
        charge.setId(UUID.randomUUID());
        charge.setUnitPrice(new BigDecimal("1000"));
        charge.setQuantity(BigDecimal.ONE);
        charge.setTaxRate(BigDecimal.ZERO);
        charge.setDiscountRate(BigDecimal.ZERO);
        charge.calculateAmounts();
        folio.getCharges().add(charge);
        folio.recalculateTotals(); // balance = 1000

        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("500"));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);

        PaymentCreationDto dto = buildPaymentDto(new BigDecimal("500"));

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(paymentMapper.toEntity(dto, folio)).thenReturn(payment);
        when(paymentRepository.count()).thenReturn(0L);
        when(paymentRepository.existsByPaymentNumber(any())).thenReturn(false);
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(folioRepository.save(folio)).thenReturn(folio);
        when(paymentMapper.toDto(payment)).thenReturn(mock(PaymentDto.class));

        PaymentDto result = paymentService.recordPayment(propertyId, folioId, dto, "frontdesk");

        assertThat(result).isNotNull();
        verify(paymentRepository).save(payment);
        verify(folioRepository).save(folio);
    }

    @Test
    void recordPayment_autoClosesWhenFullyPaid() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.MASTER);
        // No charges → total = 0 → fully paid after any payment

        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("500"));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);

        PaymentCreationDto dto = buildPaymentDto(new BigDecimal("500"));

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(paymentMapper.toEntity(dto, folio)).thenReturn(payment);
        when(paymentRepository.count()).thenReturn(0L);
        when(paymentRepository.existsByPaymentNumber(any())).thenReturn(false);
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(folioRepository.save(folio)).thenReturn(folio);
        when(paymentMapper.toDto(payment)).thenReturn(mock(PaymentDto.class));

        paymentService.recordPayment(propertyId, folioId, dto, "frontdesk");

        // Folio should have been auto-closed since it's fully paid, not routed, not WALK_IN
        assertThat(folio.getStatus()).isEqualTo(FolioStatus.CLOSED);
    }

    @Test
    void recordPayment_walkInFolio_doesNotAutoClose() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.WALK_IN); // WALK_IN type

        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("500"));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);

        PaymentCreationDto dto = buildPaymentDto(new BigDecimal("500"));

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(paymentMapper.toEntity(dto, folio)).thenReturn(payment);
        when(paymentRepository.count()).thenReturn(0L);
        when(paymentRepository.existsByPaymentNumber(any())).thenReturn(false);
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(folioRepository.save(folio)).thenReturn(folio);
        when(paymentMapper.toDto(payment)).thenReturn(mock(PaymentDto.class));

        paymentService.recordPayment(propertyId, folioId, dto, "frontdesk");

        // WALK_IN folios are never auto-closed — they're posted manually
        assertThat(folio.getStatus()).isEqualTo(FolioStatus.OPEN);
    }

    @Test
    void recordPayment_routedFolio_doesNotAutoClose() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.MASTER);

        // Make folio routed to a parent
        Folio parentFolio = buildOpenFolio(UUID.randomUUID(), property, FolioType.MASTER);
        folio.setRoutedToFolio(parentFolio);

        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("500"));
        payment.setPaymentStatus(PaymentStatus.COMPLETED);
        payment.setRefundedAmount(BigDecimal.ZERO);

        PaymentCreationDto dto = buildPaymentDto(new BigDecimal("500"));

        when(folioRepository.findById(folioId)).thenReturn(Optional.of(folio));
        when(paymentMapper.toEntity(dto, folio)).thenReturn(payment);
        when(paymentRepository.count()).thenReturn(0L);
        when(paymentRepository.existsByPaymentNumber(any())).thenReturn(false);
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(folioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toDto(payment)).thenReturn(mock(PaymentDto.class));

        paymentService.recordPayment(propertyId, folioId, dto, "frontdesk");

        // Routed folios must not be auto-closed; parent recalculation should happen instead
        assertThat(folio.getStatus()).isEqualTo(FolioStatus.OPEN);
        // Verify parent was also saved (bubbled-up recalculation)
        verify(folioRepository, times(2)).save(any(Folio.class));
    }

    @Test
    void recordPayment_folioNotFound_throws404() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();

        when(folioRepository.findById(folioId)).thenReturn(Optional.empty());

        PaymentCreationDto dto = buildPaymentDto(new BigDecimal("100"));
        assertThatThrownBy(() -> paymentService.recordPayment(propertyId, folioId, dto, "user"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Folio not found");
    }

    // =========================================================================
    // refundPayment
    // =========================================================================

    @Test
    void refundPayment_success_processesRefundAndRecalculatesFolio() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.MASTER);
        Payment payment = buildCompletedPayment(paymentId, folio, new BigDecimal("500"));
        folio.getPayments().add(payment);

        RefundDto refundDto = new RefundDto(new BigDecimal("200"), "duplicate charge", "manager");

        when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(folioRepository.save(folio)).thenReturn(folio);
        when(paymentMapper.toDto(payment)).thenReturn(mock(PaymentDto.class));

        PaymentDto result = paymentService.refundPayment(propertyId, folioId, paymentId, refundDto);

        assertThat(result).isNotNull();
        assertThat(payment.getRefundedAmount()).isEqualByComparingTo("200");
    }

    @Test
    void refundPayment_exceedsOriginalAmount_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        Property property = buildProperty(propertyId);
        Folio folio = buildOpenFolio(folioId, property, FolioType.MASTER);
        Payment payment = buildCompletedPayment(paymentId, folio, new BigDecimal("100"));

        RefundDto refundDto = new RefundDto(new BigDecimal("999"), "over-refund", "manager");

        when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));

        assertThatThrownBy(() -> paymentService.refundPayment(propertyId, folioId, paymentId, refundDto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("exceeds");
    }

    @Test
    void refundPayment_paymentBelongsToDifferentFolio_throws400() {
        UUID propertyId = UUID.randomUUID();
        UUID folioId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        Property property = buildProperty(propertyId);

        // Payment belongs to a different folio
        Folio differentFolio = buildOpenFolio(UUID.randomUUID(), property, FolioType.MASTER);
        Payment payment = buildCompletedPayment(paymentId, differentFolio, new BigDecimal("200"));

        RefundDto refundDto = new RefundDto(new BigDecimal("100"), "reason", "manager");

        when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));

        assertThatThrownBy(() -> paymentService.refundPayment(propertyId, folioId, paymentId, refundDto))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("does not belong");
    }
}
