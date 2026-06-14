# Multi-Room CONSOLIDATED Billing — Incomplete Feature

## Status
Not started. Single-room reservations are now guarded against this entirely
(see `time-date-fixes` branch: `GroupBookingService.createGroupBooking`/`consolidateBilling`,
`FolioService.addCharge`/`setChargeRoute`). This doc covers the remaining gap for
reservations with **>1 booking** in CONSOLIDATED mode (`Reservation.defaultRouteToMaster = true`).

## Issue

When a multi-room reservation is switched to CONSOLIDATED billing:

1. New charges get `FolioCharge.routeToMaster = true` (`FolioService.addCharge`,
   default derived from `reservation.isDefaultRouteToMaster()`).
2. `Folio.getSettleableTotal()` excludes `routeToMaster=true` charges, so each
   booking's folio `balanceDue` drops to ~0 even though real charges exist.
3. `BillService.generateMultiBill()` filters out `routeToMaster=true` charges
   (`unbilledCharges` excludes `c.isRouteToMaster()`). If a folio's charges are
   *entirely* routed, bill generation throws `"No unbilled charges available"`.
4. `computeMasterCreditShareForBooking()` returns `ZERO` for CONSOLIDATED
   reservations — reservation-level payments are never distributed to individual
   folios in this mode either.
5. **There is no "master bill" generation path anywhere.** Routed charges and
   reservation-level payments both exist in the data model but nothing ever
   bills the former or applies the latter.
   - `FolioChargeRepository.findRouteToMasterChargesByReservationId()` is defined
     but never called — looks like a stub for the intended feature.
   - `GroupBillService` only produces an aggregate *view* of charges across
     bookings, not a billable document tied to a Bill/invoice number.

Net effect: toggling a multi-room reservation to CONSOLIDATED makes its routed
charges effectively un-billable and its folios show misleadingly low balances.

## Scope of a fix

Need a real "master bill" concept for a reservation:

- [ ] Decide representation: a dedicated master `Folio`/`Bill` per reservation,
      vs. a new `GroupBill`/`ReservationBill` entity that aggregates
      `routeToMaster=true` charges across all bookings in the reservation.
- [ ] `BillService`: add `generateMasterBill(reservationId, ...)` (or equivalent)
      that:
      - Pulls `findRouteToMasterChargesByReservationId()` for unbilled, non-voided,
        routed charges.
      - Generates a PDF invoice + sequence number like `generateMultiBill`.
      - Marks those charges as billed (`charge.setBill(...)` / `setGroupBill(...)`).
- [ ] Apply reservation-level payments (`sumCompletedByReservationId`) against
      the master bill's balance, instead of returning `ZERO` from
      `computeMasterCreditShareForBooking` with nowhere for it to go.
- [ ] Folio/bill balance display: ensure individual folios in CONSOLIDATED mode
      show an accurate (likely zero) balance for routed charges, with a clear UI
      indicator pointing to the master bill instead of looking like "nothing owed".
- [ ] `GroupBookingService.consolidateBilling` / `separateBilling`: when toggling
      modes mid-stay with existing unbilled routed charges, confirm there's a
      clean migration path (e.g. re-routing charges back doesn't strand them on
      a half-generated master bill).
- [ ] Frontend: surface the master bill (generation, view, download) somewhere
      in `ReservationDetailModal` / `GroupBillService` UI — currently there's no
      entry point for it.
- [ ] Tests: multi-room CONSOLIDATED reservation — charge posting, master bill
      generation, payment application, and folio balance display end-to-end.

## Related known-issues.md entries
- H7 (checkOutBooking blocks consolidated-booking checkout due to child folio
  balance) and H9 (consolidateBilling/separateBilling leave folio.balanceDue
  stale) are symptoms of this same underlying gap and should be re-checked once
  this is addressed.
