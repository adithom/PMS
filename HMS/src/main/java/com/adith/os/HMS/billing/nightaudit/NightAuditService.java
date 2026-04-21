package com.adith.os.HMS.billing.nightaudit;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioChargeRepository;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.property.mealplan.MealPlanType;
import com.adith.os.HMS.property.mealplan.PropertyMealPlanRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class NightAuditService {

    private static final Logger log = LoggerFactory.getLogger(NightAuditService.class);
    private static final List<RoomAssignmentStatus> CHARGEABLE_ASSIGNMENT_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.COMPLETED);
    private static final List<RoomAssignmentStatus> COMPLETABLE_ASSIGNMENT_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE);
    private static final int CATCH_UP_LOOKBACK_DAYS = 7;
    private static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Kolkata");

    private final RoomAssignmentRepository roomAssignmentRepository;
    private final FolioService folioService;
    private final FolioChargeRepository folioChargeRepository;
    private final BookingRepository bookingRepository;
    private final NightAuditLogRepository nightAuditLogRepository;
    private final PropertyMealPlanRepository mealPlanRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);

    public NightAuditService(RoomAssignmentRepository roomAssignmentRepository,
                             FolioService folioService,
                             FolioChargeRepository folioChargeRepository,
                             BookingRepository bookingRepository,
                             NightAuditLogRepository nightAuditLogRepository,
                             PropertyMealPlanRepository mealPlanRepository,
                             ApplicationEventPublisher eventPublisher) {
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.folioService = folioService;
        this.folioChargeRepository = folioChargeRepository;
        this.bookingRepository = bookingRepository;
        this.nightAuditLogRepository = nightAuditLogRepository;
        this.mealPlanRepository = mealPlanRepository;
        this.eventPublisher = eventPublisher;
    }

    public boolean isAuditRunning() {
        return isRunning.get();
    }

    @Scheduled(cron = "${hms.night-audit.cron:0 0 2 * * *}", zone = "Asia/Kolkata")
    public void runFullNightAudit() {
        runFullNightAuditForDate(LocalDate.now(HOTEL_ZONE).minusDays(1), "AUTO");
    }

    public NightAuditResultDto runNightAuditForDate(LocalDate chargeDate) {
        log.info("Night Audit (Manual): Running for date {}", chargeDate);
        AtomicReference<String> firstError = new AtomicReference<>();
        NightAuditResultDto result = runNightAuditInternal(chargeDate, true, firstError);
        log.info("Night Audit (Manual): Completed for {}. Posted: {}, Skipped: {}, Errors: {}",
                chargeDate, result.chargesPosted(),
                result.skippedAlreadyPosted() + result.skippedFolioNotOpen() + result.skippedNoFolio(),
                result.errors());
        eventPublisher.publishEvent(new NightAuditCompletedEvent(chargeDate, "MANUAL", result, firstError.get()));
        return result;
    }

    public NightAuditResultDto runFullNightAuditForDate(LocalDate auditDate, String runType) {
        if (!isRunning.compareAndSet(false, true)) {
            throw new IllegalStateException("Night audit is already in progress. Try again shortly.");
        }
        try {
            LocalDate businessDate = auditDate.plusDays(1);

            log.info("--- STARTING FULL NIGHT AUDIT FOR {} ({}) ---", auditDate, runType);

            AtomicReference<String> firstError = new AtomicReference<>();
            boolean manualRun = "MANUAL".equals(runType);
            NightAuditResultDto result = runNightAuditInternal(auditDate, manualRun, firstError);
            performInventoryRollover(businessDate);

            log.info("--- COMPLETED FULL NIGHT AUDIT FOR {} ({}). Posted: {}, Skipped: {}, Errors: {} ---",
                    auditDate, runType, result.chargesPosted(),
                    result.skippedAlreadyPosted() + result.skippedFolioNotOpen() + result.skippedNoFolio(),
                    result.errors());

            eventPublisher.publishEvent(new NightAuditCompletedEvent(auditDate, runType, result, firstError.get()));
            return result;
        } finally {
            isRunning.set(false);
        }
    }

    private NightAuditResultDto runNightAuditInternal(LocalDate chargeDate, boolean manualRun,
                                                      AtomicReference<String> firstError) {
        List<RoomAssignment> assignments = roomAssignmentRepository.findAssignmentsForDate(
                chargeDate, CHARGEABLE_ASSIGNMENT_STATUSES);

        log.info("Night Audit{}: Found {} chargeable room assignments for {}",
                manualRun ? " (Manual)" : "", assignments.size(), chargeDate);

        int chargesPosted = 0;
        int skippedNoFolio = 0;
        int skippedFolioNotOpen = 0;
        int skippedAlreadyPosted = 0;
        int errors = 0;
        int mealPlanChargesPosted = 0;
        int mealPlanChargesSkipped = 0;
        int extraBedChargesPosted = 0;
        int extraBedChargesSkipped = 0;

        for (RoomAssignment assignment : assignments) {
            try {
                Booking booking = assignment.getBooking();
                Room room = assignment.getRoom();
                Folio masterFolio = booking.getMasterFolio();

                if (masterFolio == null) {
                    log.warn("Night Audit: No master folio found for booking {}. Skipping.", booking.getId());
                    skippedNoFolio++;
                    continue;
                }

                if (masterFolio.getStatus() != com.adith.os.HMS.billing.folio.FolioStatus.OPEN) {
                    log.warn("Night Audit: Folio {} for booking {} is {} (not OPEN). Skipping.",
                            masterFolio.getId(), booking.getId(), masterFolio.getStatus());
                    skippedFolioNotOpen++;
                    continue;
                }

                boolean chargeExists = folioChargeRepository
                        .existsByFolioIdAndChargeCodeAndChargeDateAndIsVoidedFalse(
                                masterFolio.getId(), ChargeCode.ROOM_RENT, chargeDate);

                if (chargeExists) {
                    log.debug("Night Audit: Room rent charge already exists for booking {} on {}. Skipping.",
                            booking.getId(), chargeDate);
                    skippedAlreadyPosted++;
                    continue;
                }

                BigDecimal nightlyRate = assignment.getNightlyRate() != null
                        ? assignment.getNightlyRate()
                        : room.getBaseRate();

                BigDecimal roomRentTaxRate = nightlyRate.compareTo(new BigDecimal("7500")) < 0
                        ? new BigDecimal("5.00")
                        : new BigDecimal("18.00");

                ChargeCreationDto chargeDto = new ChargeCreationDto(
                        chargeDate,
                        ChargeCode.ROOM_RENT,
                        "Room " + room.getNumber() + " - Nightly Rate",
                        nightlyRate,
                        BigDecimal.ONE,
                        roomRentTaxRate,
                        BigDecimal.ZERO,
                        "ROOM_ASSIGNMENT",
                        assignment.getId(),
                        manualRun ? "Night Audit - Manual run for " + chargeDate : "Night Audit - Auto-posted",
                        "NIGHT_AUDIT"
                );

                folioService.addCharge(
                        booking.getProperty().getId(),
                        masterFolio.getId(),
                        chargeDto
                );

                chargesPosted++;
                log.info("Night Audit{}: Posted room rent charge for booking {} room {} on {}",
                        manualRun ? " (Manual)" : "", booking.getId(), room.getNumber(), chargeDate);

                // Post meal plan charge if the booking has one
                MealPlanType mealPlanType = booking.getMealPlanType();
                if (mealPlanType != null) {
                    boolean mealPlanChargeExists = folioChargeRepository
                            .existsByFolioIdAndChargeCodeAndChargeDateAndIsVoidedFalse(
                                    masterFolio.getId(), ChargeCode.MEAL_PLAN, chargeDate);

                    if (!mealPlanChargeExists) {
                        var planOpt = mealPlanRepository
                                .findByPropertyIdAndMealPlanType(booking.getProperty().getId(), mealPlanType);
                        if (planOpt.isPresent() && planOpt.get().isActive()) {
                            var plan = planOpt.get();
                            var effectivePrice = booking.getMealPlanPricePerNight() != null
                                    ? booking.getMealPlanPricePerNight()
                                    : plan.getPricePerNight();
                            ChargeCreationDto mealPlanCharge = new ChargeCreationDto(
                                    chargeDate,
                                    ChargeCode.MEAL_PLAN,
                                    mealPlanType.name() + " - " + mealPlanType.getDisplayName(),
                                    effectivePrice,
                                    BigDecimal.ONE,
                                    null,
                                    BigDecimal.ZERO,
                                    "BOOKING",
                                    booking.getId(),
                                    manualRun ? "Night Audit - Manual run for " + chargeDate : "Night Audit - Auto-posted",
                                    "NIGHT_AUDIT"
                            );
                            folioService.addCharge(booking.getProperty().getId(), masterFolio.getId(), mealPlanCharge);
                            mealPlanChargesPosted++;
                            log.info("Night Audit{}: Posted meal plan charge ({}) for booking {} on {}",
                                    manualRun ? " (Manual)" : "", mealPlanType, booking.getId(), chargeDate);
                        } else {
                            log.warn("Night Audit: Meal plan {} has no active config for property {}. Skipping meal plan charge for booking {}.",
                                    mealPlanType, booking.getProperty().getId(), booking.getId());
                            mealPlanChargesSkipped++;
                            firstError.compareAndSet(null, "Meal plan " + mealPlanType
                                    + " has no active config for property " + booking.getProperty().getId());
                        }
                    } else {
                        mealPlanChargesSkipped++;
                    }
                }

                // Post extra bed charge if applicable
                Integer extraBeds = booking.getExtraBeds();
                if (extraBeds != null && extraBeds > 0) {
                    boolean extraBedChargeExists = folioChargeRepository
                            .existsByFolioIdAndReferenceTypeAndChargeDateAndIsVoidedFalse(
                                    masterFolio.getId(), "EXTRA_BED", chargeDate);

                    if (!extraBedChargeExists) {
                        BigDecimal effectiveRate = booking.getExtraBedRatePerNight() != null
                                ? booking.getExtraBedRatePerNight()
                                : (booking.getProperty().getExtraBedRatePerNight() != null
                                        ? booking.getProperty().getExtraBedRatePerNight()
                                        : BigDecimal.ZERO);

                        if (effectiveRate.compareTo(BigDecimal.ZERO) > 0) {
                            ChargeCode extraBedCode = booking.getExtraBedChargeCode() != null
                                    ? booking.getExtraBedChargeCode()
                                    : ChargeCode.MISC;

                            ChargeCreationDto extraBedCharge = new ChargeCreationDto(
                                    chargeDate,
                                    extraBedCode,
                                    "Extra Bed (" + extraBeds + ") - Nightly Charge",
                                    effectiveRate,
                                    BigDecimal.ONE,
                                    null,
                                    BigDecimal.ZERO,
                                    "EXTRA_BED",
                                    booking.getId(),
                                    manualRun ? "Night Audit - Manual run for " + chargeDate : "Night Audit - Auto-posted",
                                    "NIGHT_AUDIT"
                            );
                            folioService.addCharge(booking.getProperty().getId(), masterFolio.getId(), extraBedCharge);
                            extraBedChargesPosted++;
                            log.info("Night Audit{}: Posted extra bed charge ({} beds, {}) for booking {} on {}",
                                    manualRun ? " (Manual)" : "", extraBeds, extraBedCode, booking.getId(), chargeDate);
                        } else {
                            log.warn("Night Audit: Extra bed rate is zero for booking {} (beds={}). Skipping extra bed charge.",
                                    booking.getId(), extraBeds);
                            extraBedChargesSkipped++;
                        }
                    } else {
                        extraBedChargesSkipped++;
                    }
                }

            } catch (Exception e) {
                errors++;
                firstError.compareAndSet(null, e.getMessage());
                log.error("Night Audit{}: Error posting charge for assignment {}: {}",
                        manualRun ? " (Manual)" : "",
                        assignment.getId(), e.getMessage(), e);
            }
        }

        return new NightAuditResultDto(chargeDate, assignments.size(), chargesPosted,
                skippedAlreadyPosted, skippedFolioNotOpen, skippedNoFolio,
                errors, mealPlanChargesPosted, mealPlanChargesSkipped,
                extraBedChargesPosted, extraBedChargesSkipped);
    }

    @Scheduled(cron = "${hms.night-audit.catchup-cron:0 0 3 * * *}", zone = "Asia/Kolkata")
    public void runCatchUpAudit() {
        if (!isRunning.compareAndSet(false, true)) {
            log.warn("Catch-Up Audit: skipped — another audit run is in progress.");
            return;
        }
        try {
            LocalDate today = LocalDate.now(HOTEL_ZONE);
            log.info("--- STARTING CATCH-UP NIGHT AUDIT (lookback {} days) ---", CATCH_UP_LOOKBACK_DAYS);
            int rerunCount = 0;

            for (int i = 1; i <= CATCH_UP_LOOKBACK_DAYS; i++) {
                LocalDate date = today.minusDays(i);
                Optional<NightAuditLog> lastLog =
                        nightAuditLogRepository.findTopByAuditDateOrderByRanAtDesc(date);

                boolean needsRerun = lastLog.isEmpty() || lastLog.get().getErrors() > 0;
                if (needsRerun) {
                    log.info("Catch-Up Audit: {} — {} — re-running charges.", date,
                            lastLog.isEmpty() ? "no audit found"
                                    : "previous run had " + lastLog.get().getErrors() + " errors");
                    AtomicReference<String> firstError = new AtomicReference<>();
                    NightAuditResultDto result = runNightAuditInternal(date, false, firstError);
                    eventPublisher.publishEvent(new NightAuditCompletedEvent(date, "CATCH_UP", result, firstError.get()));
                    rerunCount++;
                }
            }
            log.info("--- COMPLETED CATCH-UP NIGHT AUDIT. Re-ran {} date(s). ---", rerunCount);
        } finally {
            isRunning.set(false);
        }
    }

    @Transactional
    public void performInventoryRollover(LocalDate businessDate) {
        log.info("Night Audit: Running inventory rollover for transition to {}", businessDate);

        List<RoomAssignment> endingAssignments = roomAssignmentRepository.findAssignmentsEndingOnOrBefore(
                businessDate, COMPLETABLE_ASSIGNMENT_STATUSES);
        int completedCount = 0;

        for (RoomAssignment assignment : endingAssignments) {
            assignment.setStatus(RoomAssignmentStatus.COMPLETED);
            roomAssignmentRepository.save(assignment);
            completedCount++;
        }

        List<RoomAssignment> startingAssignments = roomAssignmentRepository.findAssignmentsStartingOnOrBefore(
                businessDate, RoomAssignmentStatus.SCHEDULED);
        int activatedCount = 0;

        for (RoomAssignment assignment : startingAssignments) {
            Booking booking = assignment.getBooking();

            if (booking.getStatus() != BookingStatus.CHECKED_IN) {
                continue;
            }

            assignment.setStatus(RoomAssignmentStatus.ACTIVE);
            roomAssignmentRepository.save(assignment);

            booking.setRoom(assignment.getRoom());
            booking.setUnit(assignment.getRoom().getUnit());
            bookingRepository.save(booking);
            activatedCount++;
        }

        log.info("Night Audit: Inventory rollover completed for {}. Completed: {}, Activated: {}",
                businessDate, completedCount, activatedCount);
    }

    public record NightAuditResultDto(
            LocalDate date,
            int totalAssignments,
            int chargesPosted,
            int skippedAlreadyPosted,
            int skippedFolioNotOpen,
            int skippedNoFolio,
            int errors,
            int mealPlanChargesPosted,
            int mealPlanChargesSkipped,
            int extraBedChargesPosted,
            int extraBedChargesSkipped
    ) {}
}
