package com.adith.os.HMS.billing.nightaudit;

import com.adith.os.HMS.billing.folio.ChargeCode;
import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioService;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.booking.Booking;
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

@Service
public class NightAuditService {

    private static final Logger log = LoggerFactory.getLogger(NightAuditService.class);

    private final RoomAssignmentRepository roomAssignmentRepository;
    private final FolioService folioService;

    public NightAuditService(RoomAssignmentRepository roomAssignmentRepository,
                             FolioService folioService) {
        this.roomAssignmentRepository = roomAssignmentRepository;
        this.folioService = folioService;
    }

    /**
     * Nightly batch job that posts ROOM_RENT charges for all active room assignments.
     *
     * Runs at the configured cron schedule (default: 2:00 AM daily).
     * Posts charges for the PREVIOUS night (yesterday's date).
     *
     * Logic:
     * 1. Find all ACTIVE room assignments where yesterday falls within [startDate, endDate)
     * 2. For each assignment, check if a ROOM_RENT charge already exists for that date
     * 3. If not, post a charge using the room's baseRate to the booking's master folio
     */
    @Scheduled(cron = "${hms.night-audit.cron:0 0 2 * * *}")
    @Transactional
    public void postNightlyRoomCharges() {
        LocalDate chargeDate = LocalDate.now().minusDays(1); // Charge for last night
        log.info("Night Audit: Starting nightly room charge posting for date {}", chargeDate);

        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findAssignmentsForDate(
                chargeDate, RoomAssignmentStatus.ACTIVE);

        log.info("Night Audit: Found {} active room assignments for {}", activeAssignments.size(), chargeDate);

        int chargesPosted = 0;
        int chargesSkipped = 0;
        int errors = 0;

        for (RoomAssignment assignment : activeAssignments) {
            try {
                Booking booking = assignment.getBooking();
                Room room = assignment.getRoom();
                Folio masterFolio = booking.getMasterFolio();

                if (masterFolio == null) {
                    log.warn("Night Audit: No master folio found for booking {}. Skipping.", booking.getId());
                    chargesSkipped++;
                    continue;
                }

                // Check if a room rent charge already exists for this date (idempotency)
                boolean chargeExists = masterFolio.getCharges() != null && masterFolio.getCharges().stream()
                        .filter(c -> !c.isVoided())
                        .filter(c -> c.getChargeCode() == ChargeCode.ROOM_RENT)
                        .anyMatch(c -> c.getChargeDate().equals(chargeDate));

                if (chargeExists) {
                    log.debug("Night Audit: Room rent charge already exists for booking {} on {}. Skipping.",
                            booking.getId(), chargeDate);
                    chargesSkipped++;
                    continue;
                }

                // Post the room rent charge using the room's base rate
                BigDecimal nightlyRate = room.getBaseRate();

                ChargeCreationDto chargeDto = new ChargeCreationDto(
                        chargeDate,
                        ChargeCode.ROOM_RENT,
                        "Room " + room.getNumber() + " - Nightly Rate",
                        nightlyRate,
                        BigDecimal.ONE,
                        BigDecimal.ZERO, // Tax rate (TODO: global tax rate lookup)
                        BigDecimal.ZERO, // Discount rate
                        "ROOM_ASSIGNMENT",
                        assignment.getId(),
                        "Night Audit - Auto-posted",
                        "NIGHT_AUDIT"
                );

                folioService.addCharge(
                        booking.getProperty().getId(),
                        masterFolio.getId(),
                        chargeDto
                );

                chargesPosted++;
                log.debug("Night Audit: Posted room rent charge for booking {} room {} on {}",
                        booking.getId(), room.getNumber(), chargeDate);

            } catch (Exception e) {
                errors++;
                log.error("Night Audit: Error posting charge for assignment {}: {}",
                        assignment.getId(), e.getMessage(), e);
            }
        }

        log.info("Night Audit: Completed for {}. Posted: {}, Skipped: {}, Errors: {}",
                chargeDate, chargesPosted, chargesSkipped, errors);
    }

    /**
     * Manually trigger the night audit for a specific date.
     * Useful for backfilling charges or re-running after an error.
     */
    @Transactional
    public NightAuditResultDto runNightAuditForDate(LocalDate chargeDate) {
        log.info("Night Audit (Manual): Running for date {}", chargeDate);

        List<RoomAssignment> activeAssignments = roomAssignmentRepository.findAssignmentsForDate(
                chargeDate, RoomAssignmentStatus.ACTIVE);

        int chargesPosted = 0;
        int chargesSkipped = 0;
        int errors = 0;

        for (RoomAssignment assignment : activeAssignments) {
            try {
                Booking booking = assignment.getBooking();
                Room room = assignment.getRoom();
                Folio masterFolio = booking.getMasterFolio();

                if (masterFolio == null) {
                    chargesSkipped++;
                    continue;
                }

                boolean chargeExists = masterFolio.getCharges() != null && masterFolio.getCharges().stream()
                        .filter(c -> !c.isVoided())
                        .filter(c -> c.getChargeCode() == ChargeCode.ROOM_RENT)
                        .anyMatch(c -> c.getChargeDate().equals(chargeDate));

                if (chargeExists) {
                    chargesSkipped++;
                    continue;
                }

                BigDecimal nightlyRate = room.getBaseRate();

                ChargeCreationDto chargeDto = new ChargeCreationDto(
                        chargeDate,
                        ChargeCode.ROOM_RENT,
                        "Room " + room.getNumber() + " - Nightly Rate",
                        nightlyRate,
                        BigDecimal.ONE,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        "ROOM_ASSIGNMENT",
                        assignment.getId(),
                        "Night Audit - Manual run for " + chargeDate,
                        "NIGHT_AUDIT"
                );

                folioService.addCharge(
                        booking.getProperty().getId(),
                        masterFolio.getId(),
                        chargeDto
                );

                chargesPosted++;

            } catch (Exception e) {
                errors++;
                log.error("Night Audit (Manual): Error posting charge for assignment {}: {}",
                        assignment.getId(), e.getMessage(), e);
            }
        }

        log.info("Night Audit (Manual): Completed for {}. Posted: {}, Skipped: {}, Errors: {}",
                chargeDate, chargesPosted, chargesSkipped, errors);

        return new NightAuditResultDto(chargeDate, activeAssignments.size(), chargesPosted, chargesSkipped, errors);
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
