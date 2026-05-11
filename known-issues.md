# Known Issues

Sourced from ultrareview of branch `time-date-fixes` (May 2026). Red items were confirmed by the review tool and independently verified against the code. Grey items are uncertain / not yet code-verified.

---

## Critical — Data Corruption / Financial Errors

### C1. Night audit catch-up never re-posts partial charge failures
**File:** `NightAuditService.java:121`
When meal-plan or extra-bed posting fails inside the per-room try/catch, the exception is caught and logged but `errors` is not incremented. The night audit log for that date is written as successful, so the catch-up job never retries. Missing MEAL_PLAN/EXTRA_BED charges are silently lost.

> **Note:** The outer audit loop is intentionally non-transactional (per-room atomicity is handled by `FolioService.addCharge` which is itself `@Transactional`). Adding `@Transactional` to the outer loop would cause all rooms to roll back when one fails — confirmed bad via commit `f13ff0d`. The issue is only the missing `errors++` for sub-charge failures.

### C2. BillMapper double-counts payments on non-ROOM_RENT bills
**File:** `BillMapper.java:103`
Payment filter at line 107: `if (t == null) return true` — null-targetCategory payments are included unconditionally. These payments are then also counted in ROOM_RENT bills. Any payment without a targetCategory is double-counted, overstating amountPaid and understating balanceDue on both bill types.

### C3. Master-credit share divided by all bookings including cancelled
**File:** `BillService.java:73`
`computeMasterCreditShareForBooking` uses `bookingRepository.countByReservationId()` which includes CANCELLED/NO_SHOW bookings. Reservation-level payments are divided by that full count — if one of four rooms was cancelled, active rooms each receive 1/4 of the credit instead of 1/3, undercharging their final bills.

### C4. Group bills always show groupAmountPaid = 0
**File:** `GroupBillGenerationService.java:145`
`GroupBillSectionDto` is constructed with `groupAmountPaid = BigDecimal.ZERO` and `balanceDue = total` hardcoded at line 172. Unlike `BillMapper.toBillDto()`, `GroupBillGenerationService` never queries payments for the reservation. Group bills always show full balance due regardless of payments received.

### C5. GroupBookingService.createGroupBooking never creates RoomAssignments
**File:** `GroupBookingService.java:122`
The method creates Bookings and Folios but never calls `roomAssignmentService.createInitialAssignment()`. Even when a room is explicitly specified, no RoomAssignment row is created. Group rooms are untracked in the assignment table, which breaks night audit, tape chart, and billing.

### C6. cancelReservation marks CHECKED_OUT bookings as CANCELLED
**File:** `GroupBookingService.java:344`
The guard at line 350 only blocks `CHECKED_IN` status. CHECKED_OUT bookings pass the check and are overwritten with `CANCELLED` (line 355) — an illegal state transition that corrupts historical records.

### C7. Booking.reservation @JoinColumn(nullable=false) — production migration risk
**File:** `Booking.java:35`
`@JoinColumn(name = "reservation_id", nullable = false)` enforces a DB-level NOT NULL. Any legacy Booking rows without a reservation_id will cause a constraint violation on the next Hibernate schema update (`ddl-auto=update`) in production.

### C8. Custom nightly rate lost when room is assigned after booking creation
**File:** `RoomAssignmentService.java:71`
`createInitialAssignment` returns null when `booking.getRoom() == null`. When a room is later added via `assignRoomToBooking`, it calls `createInitialAssignment(savedBooking, null)` — the custom rate from the original booking is not passed through. The RoomAssignment is created with a null nightly rate.

---

## High — Incorrect Data / Functional Breakage

### H1. getBillsForFolio shows wrong balance — master credit not re-applied
**File:** `BillService.java:157`
`getBillsForFolio` calls the 4-arg `toBillDto` overload which defaults `appliedMasterCredit` to `BigDecimal.ZERO`. The master credit computed at bill-generation time is not persisted on the Bill entity, so every subsequent GET call shows an inflated balanceDue.

### H2. partialUpdateBooking / updateBooking don't sync Reservation dates
**File:** `BookingService.java:619`
When booking check-in/check-out dates are changed, `booking.setCheckIn()` / `booking.setCheckOut()` are called but `reservation.setCheckIn()` / `reservation.setCheckOut()` are not. The parent Reservation keeps stale dates.

### H3. FolioMapper.extractRoomNumber returns stale room after room shift
**File:** `FolioMapper.java:83`
Line 87: `assignments.get(0).getRoom()` — always the first assignment by list order. After a room shift, the folio DTO still reports the original room number instead of the current one.

### H4. BookingMapper.resolveActiveAssignment uses min(startDate) — wrong for shifted bookings
**File:** `BookingMapper.java:120`
`.min(Comparator.comparing(RoomAssignment::getStartDate))` picks the earliest SCHEDULED/ACTIVE assignment. When a booking has been shifted and has multiple valid assignments, this returns the original (stale) one rather than the current active assignment.

### H5. Tape-chart ghost-fill ignores real assignments outside the requested window
**File:** `AvailabilityService.java:478`
`buildGhostAssignments` receives `realAssignments` fetched only for the `[from, to]` window. The overlap check compares against this scoped list only — real assignments that extend beyond the window are invisible, allowing ghost bookings to be placed in already-occupied slots.

### H6. Walk-in POS payments orphaned — not tagged with bookingId/reservationId
**File:** `PaymentService.java:62`
Walk-in POS payments are recorded without a bookingId or reservationId. They cannot be reconciled against any folio after the fact.

### H7. checkOutBooking blocks consolidated-booking checkout due to child folio balance
**File:** `GroupBookingService.java:195`
Line 325 checks `folio.isFullyPaid()` on the individual booking's folio. In consolidated-billing mode, charges route to the master folio; the child folio shows a non-zero balance even when the master is fully settled, incorrectly blocking checkout.

### H8. voidBill leaves folio.paidAmount / balanceDue stale
**File:** `BillService.java:196` — grey, confirmed by code
`voidBill` calls `folio.recalculateTotals()` which recalculates charge-side totals only. Payment-derived fields (`paidAmount`, `balanceDue`) are not recomputed. Post-void, the folio shows the pre-void balance.

### H9. consolidateBilling / separateBilling leave folio.balanceDue stale
**File:** `GroupBookingService.java:207` — grey, not independently verified
Folio recalculation may not run after charge re-routing between folios during consolidation/separation, leaving balanceDue stale and blocking checkout incorrectly.

---

## Medium

### M1. BookingMapper N+1 — meal-plan repository queried per booking
**File:** `BookingMapper.java:120`
`toDto()` calls `mealPlanRepository.findByPropertyIdAndMealPlanType()` twice per booking (adult + children prices). List endpoints produce 2N repository hits with no batch fetch or cache.

### M2. FolioService.generateFolioNumber uses JVM default timezone
**File:** `FolioService.java:33` (line 536)
`LocalDate.now()` without a ZoneId. NightAuditService uses `ZoneId.of("Asia/Kolkata")` explicitly. If the VPS timezone differs, folio date segments drift from night-audit dates around midnight.

---

## Low / Unverified

### L1. Folio.status nullable=false without DB-level DEFAULT
**File:** `Folio.java:44` — grey
`nullable = false` with a Java-side default but no `columnDefinition` DB DEFAULT. Risky if any bulk insert bypasses JPA. (Ultrareview cited a non-existent `folio_type` column — the actual risk is on `status`.)

### L2. FolioService.addCharge swallows ResponseStatusException → returns 500
**File:** `FolioService.java:294` — grey, not verified

### L3. GroupBookingModal imports non-existent reservationApi module
**File:** `hms-frontend/src/components/Booking/GroupBookingModal.tsx:3` — grey, not verified

### L4. Tape-chart sorts room numbers lexicographically instead of numerically
**File:** `AvailabilityService.java:521` — grey, not verified

### L5. AdminController /restart only stops the JVM
**File:** `AdminController.java:22` — grey, not verified

### L6. POS walk-in folio payments silently untracked
**File:** `PaymentService.java:73` — grey, related to H6

---

## Confirmed Non-Issues

- **RoomAssignmentService.updateNightlyRates ExTax wipe** (`RoomAssignmentService.java:92`) — code at line 98 correctly calls `a.setNightlyRateExTax(nightlyRateExTax)`. Not a bug.
- **ChargeCode.computeRoomRentTaxRate null threshold** (`NightAuditService.java:164`) — `ChargeCode` guards `if (nightlyRate == null)` and returns 5%. The caller also has a fallback chain. Not a bug.
- **Night audit non-transactional outer loop** — intentional. Adding `@Transactional` to the outer loop causes all-or-nothing rollback across all rooms. Removed deliberately in commit `f13ff0d`. Per-room atomicity is handled by `FolioService.addCharge`.
