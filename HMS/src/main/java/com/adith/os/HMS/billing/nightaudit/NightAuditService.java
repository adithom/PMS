package com.adith.os.HMS.billing.nightaudit;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.booking.Booking;
import com.adith.os.HMS.booking.BookingRepository;
import com.adith.os.HMS.booking.BookingStatus;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.roomassignment.RoomAssignment;
import com.adith.os.HMS.roomassignment.RoomAssignmentRepository;
import com.adith.os.HMS.roomassignment.RoomAssignmentStatus;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class NightAuditService {

    private static final Logger log = LoggerFactory.getLogger(NightAuditService.class);
    private static final List<RoomAssignmentStatus> CHARGEABLE_ASSIGNMENT_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE, RoomAssignmentStatus.COMPLETED);
    private static final List<RoomAssignmentStatus> COMPLETABLE_ASSIGNMENT_STATUSES =
            List.of(RoomAssignmentStatus.SCHEDULED, RoomAssignmentStatus.ACTIVE);

    private final RoomAssignmentRepository roomAssignmentRepository;
    private final FolioService folioService;
    private final BookingRepository bookingRepository;
    private final NightAuditLogRepository nightAuditLogRepository;

    public NightAuditService(RoomAssignmentRepository roomAssignmentRepository,
                             FolioService folioService,
                             BookingRepository bookingRepository,
                             NightAuditLogRepository nightAuditLogRepository) {
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.folioService = folioService;
        this.bookingRepository = bookingRepository;
        this.nightAuditLogRepository = nightAuditLogRepository;
    }

    /**
     * Full nightly batch job:
     * 1. Post charges for the previous night
     * 2. Roll room-assignment inventory into the new business date
     *
     * Runs at the configured cron schedule (default: 2:00 AM daily).
     */
    @Scheduled(cron = "${hms.night-audit.cron:0 0 2 * * *}")
    @Transactional
    public void runFullNightAudit() {
        runFullNightAuditForDate(LocalDate.now().minusDays(1), "AUTO");
    }

    /**
     * Manually trigger the night audit for a specific date.
     * Useful for backfilling charges or re-running after an error.
     */
    @Transactional
    public NightAuditResultDto runNightAuditForDate(LocalDate chargeDate) {
        log.info("Night Audit (Manual): Running for date {}", chargeDate);
        AtomicReference<String> firstError = new AtomicReference<>();
        NightAuditResultDto result = runNightAuditInternal(chargeDate, true, firstError);
        log.info("Night Audit (Manual): Completed for {}. Posted: {}, Skipped: {}, Errors: {}",
                chargeDate, result.chargesPosted(), result.chargesSkipped(), result.errors());
        saveLog(chargeDate, "MANUAL", result, firstError.get());
        return result;
    }

    @Transactional
    public NightAuditResultDto runFullNightAuditForDate(LocalDate auditDate, String runType) {
        LocalDate businessDate = auditDate.plusDays(1);

        log.info("--- STARTING FULL NIGHT AUDIT FOR {} ({}) ---", auditDate, runType);

        AtomicReference<String> firstError = new AtomicReference<>();
        boolean manualRun = "MANUAL".equals(runType);
        NightAuditResultDto result = runNightAuditInternal(auditDate, manualRun, firstError);
        performInventoryRollover(businessDate);

        log.info("--- COMPLETED FULL NIGHT AUDIT FOR {} ({}). Posted: {}, Skipped: {}, Errors: {} ---",
                auditDate, runType, result.chargesPosted(), result.chargesSkipped(), result.errors());

        saveLog(auditDate, runType, result, firstError.get());
        return result;
    }

    private void saveLog(LocalDate auditDate, String runType, NightAuditResultDto result, String errorSummary) {
        try {
            nightAuditLogRepository.save(new NightAuditLog(
                    auditDate, runType,
                    result.totalAssignments(), result.chargesPosted(),
                    result.chargesSkipped(), result.errors(),
                    errorSummary
            ));
        } catch (Exception e) {
            log.error("Night Audit: Failed to persist audit log for {}: {}", auditDate, e.getMessage());
        }
    }

    private NightAuditResultDto runNightAuditInternal(LocalDate chargeDate, boolean manualRun,
                                                      AtomicReference<String> firstError) {
        List<RoomAssignment> assignments = roomAssignmentRepository.findAssignmentsForDate(
                chargeDate, CHARGEABLE_ASSIGNMENT_STATUSES);

        log.info("Night Audit{}: Found {} chargeable room assignments for {}",
                manualRun ? " (Manual)" : "", assignments.size(), chargeDate);

        int chargesPosted = 0;
        int chargesSkipped = 0;
        int errors = 0;

        for (RoomAssignment assignment : assignments) {
            try {
                Booking booking = assignment.getBooking();
                Room room = assignment.getRoom();
                Folio masterFolio = booking.getMasterFolio();

                if (masterFolio == null) {
                    if (!manualRun) {
                        log.warn("Night Audit: No master folio found for booking {}. Skipping.", booking.getId());
                    }
                    chargesSkipped++;
                    continue;
                }

                if (masterFolio.getStatus() != com.adith.os.HMS.billing.folio.FolioStatus.OPEN) {
                    if (!manualRun) {
                        log.warn("Night Audit: Folio {} for booking {} is {} (not OPEN). Skipping.",
                                masterFolio.getId(), booking.getId(), masterFolio.getStatus());
                    }
                    chargesSkipped++;
                    continue;
                }

                boolean chargeExists = masterFolio.getCharges() != null && masterFolio.getCharges().stream()
                        .filter(c -> !c.isVoided())
                        .filter(c -> c.getChargeCode() == ChargeCode.ROOM_RENT)
                        .anyMatch(c -> c.getChargeDate().equals(chargeDate));

                if (chargeExists) {
                    if (!manualRun) {
                        log.debug("Night Audit: Room rent charge already exists for booking {} on {}. Skipping.",
                                booking.getId(), chargeDate);
                    }
                    chargesSkipped++;
                    continue;
                }

                BigDecimal nightlyRate = assignment.getNightlyRate() != null
                        ? assignment.getNightlyRate()
                        : room.getBaseRate();

                ChargeCreationDto chargeDto = new ChargeCreationDto(
                        chargeDate,
                        ChargeCode.ROOM_RENT,
                        "Room " + room.getNumber() + " - Nightly Rate",
                        nightlyRate,
                        BigDecimal.ONE,
                        null,
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

            } catch (Exception e) {
                errors++;
                firstError.compareAndSet(null, e.getMessage());
                log.error("Night Audit{}: Error posting charge for assignment {}: {}",
                        manualRun ? " (Manual)" : "",
                        assignment.getId(), e.getMessage(), e);
            }
        }

        return new NightAuditResultDto(chargeDate, assignments.size(), chargesPosted, chargesSkipped, errors);
    }

    private void performInventoryRollover(LocalDate businessDate) {
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

    /**
     * Simple result record for manual night audit runs.
     */
    public record NightAuditResultDto(
            LocalDate date,
            int totalAssignments,
            int chargesPosted,
            int chargesSkipped,
            int errors
    ) {}
}
