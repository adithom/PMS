package com.adith.os.HMS.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Applies DDL constraints that Hibernate's ddl-auto=update cannot express.
 * Runs once at startup and is idempotent — safe to re-run on every restart.
 */
@Component
public class SchemaConstraintInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaConstraintInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public SchemaConstraintInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        applyRoomAssignmentOverlapConstraint();
    }

    /**
     * Adds a Postgres EXCLUDE constraint that prevents two SCHEDULED or ACTIVE room
     * assignments for the same room from having overlapping date ranges.
     * Requires the btree_gist extension for UUID equality inside a GiST index.
     */
    private void applyRoomAssignmentOverlapConstraint() {
        try {
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS btree_gist");

            jdbcTemplate.execute("""
                    DO $$
                    BEGIN
                      IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'no_overlapping_active_assignments'
                      ) THEN
                        ALTER TABLE room_assignment
                          ADD CONSTRAINT no_overlapping_active_assignments
                          EXCLUDE USING gist (
                            room_id WITH =,
                            daterange(start_date, end_date, '[)') WITH &&
                          ) WHERE (status IN ('SCHEDULED', 'ACTIVE'));
                      END IF;
                    END;
                    $$""");

            log.info("room_assignment overlap exclusion constraint is in place");
        } catch (Exception e) {
            log.warn("Could not apply room_assignment overlap constraint — continuing without it. Reason: {}", e.getMessage());
        }
    }
}
