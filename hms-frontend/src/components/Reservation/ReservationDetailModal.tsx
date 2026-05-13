import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import bookingApi from '../../api/bookingApi';
import type { Booking } from '../../types';
import { fmtDate, diffDays } from '../../utils/dateHelpers';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-200',
};

interface Props {
  propertyId: string;
  reservationId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

/**
 * Reservation detail view — shown from the Reservations list and (later) calendar.
 * Header summarizes the reservation; a member list shows individual bookings;
 * an audit panel surfaces the cancellation reason (and reschedule reason once that
 * feature lands). Single bookings just appear as a 1-member reservation.
 */
export default function ReservationDetailModal({ propertyId, reservationId, onClose, onUpdated }: Props) {
  const [reservation, setReservation] = useState<GroupBookingSummaryDto | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await reservationApi.getReservation(propertyId, reservationId);
      setReservation(r);
      // Fetch full Booking DTOs for member bookings — we want audit fields.
      const ids = r.bookings.map(b => b.bookingId);
      const fetched = await Promise.all(ids.map(id => bookingApi.getById(propertyId, id).catch(() => null)));
      setBookings(fetched.filter(Boolean) as Booking[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reservation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, reservationId]);

  const handleCancelReservation = async () => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    if (!confirm('Cancel this reservation? All member bookings will be cancelled.')) return;
    try {
      await reservationApi.cancelReservation(propertyId, reservationId);
      // also stamp cancellation reason on each booking
      if (reason && reason.trim()) {
        await Promise.all(bookings.map(b => b.id
          ? bookingApi.updateStatus(propertyId, b.id, 'CANCELLED', reason.trim()).catch(() => null)
          : null));
      }
      onUpdated?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel reservation');
    }
  };

  const handleToggleBilling = async () => {
    if (!reservation) return;
    try {
      if (reservation.billingMode === 'CONSOLIDATED') {
        await reservationApi.separateBilling(propertyId, reservationId);
      } else {
        await reservationApi.consolidateBilling(propertyId, reservationId);
      }
      await fetchData();
      onUpdated?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to toggle billing mode');
    }
  };

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Reservation" className="max-w-3xl">
      <div className="p-6">
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-sm rounded-md">{error}</div>}
        {loading && <div className="text-sm text-slate-500">Loading…</div>}

        {reservation && (
          <>
            {/* Header */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reservation</p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                    {reservation.organizerGuestName}
                    {reservation.groupReference && (
                      <span className="ml-2 text-sm font-bold text-slate-500">· {reservation.groupReference}</span>
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {fmtDate(reservation.checkIn)} → {fmtDate(reservation.checkOut)}
                    {' · '}
                    {diffDays(reservation.checkIn, reservation.checkOut)} nights
                    {' · '}
                    {reservation.totalRooms} {reservation.totalRooms === 1 ? 'room' : 'rooms'}
                  </p>
                </div>
                <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', STATUS_BADGE[reservation.overallStatus] || STATUS_BADGE.PENDING)}>
                  {reservation.overallStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <div className="font-bold uppercase tracking-wider text-slate-400">Total</div>
                  <div className="mt-0.5 font-bold text-slate-900">{reservation.currency} {reservation.totalGroupPrice.toFixed(2)}</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-wider text-slate-400">Billing</div>
                  <div className="mt-0.5 font-bold text-slate-900">{reservation.billingMode}</div>
                </div>
                <div>
                  <div className="font-bold uppercase tracking-wider text-slate-400">Created</div>
                  <div className="mt-0.5 text-slate-700">{fmtDate(reservation.createdAt)}</div>
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    onClick={handleToggleBilling}
                  >
                    Switch to {reservation.billingMode === 'CONSOLIDATED' ? 'SEPARATE' : 'CONSOLIDATED'}
                  </button>
                </div>
              </div>
            </div>

            {/* Member bookings */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Bookings ({reservation.bookings.length})</h3>
              <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
                {reservation.bookings.map((b: BookingSummaryDto) => (
                  <li key={b.bookingId} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{b.guestName}</div>
                      <div className="text-xs text-slate-500">
                        {b.unitName} · Room {b.roomNumber || <span className="italic">unassigned</span>}
                        {b.isTwinBed && ' · twin'}
                      </div>
                      {b.specialRequests && (
                        <div className="mt-1 text-xs text-slate-500 italic">"{b.specialRequests}"</div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_BADGE[b.status] || STATUS_BADGE.PENDING)}>
                        {b.status.replace('_', ' ')}
                      </span>
                      <div className="mt-1 text-xs text-slate-600">
                        {reservation.currency} {b.totalPrice.toFixed(2)}
                        {b.balanceDue > 0 && (
                          <span className="ml-2 text-rose-600">due {b.balanceDue.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Audit panel — surfaces cancellation/reschedule reasons. */}
            {(() => {
              const cancellationReasons = bookings
                .filter(b => b.cancellationReason)
                .map(b => ({ id: b.id!, name: b.guestName, reason: b.cancellationReason! }));
              const rescheduleReasons = bookings
                .filter(b => b.rescheduleReason)
                .map(b => ({ id: b.id!, name: b.guestName, reason: b.rescheduleReason!, from: b.originalCheckIn, to: b.originalCheckOut }));
              if (cancellationReasons.length === 0 && rescheduleReasons.length === 0) return null;
              return (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Audit</h3>
                  <div className="mt-2 space-y-2">
                    {cancellationReasons.map(r => (
                      <div key={`c-${r.id}`} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
                        <div className="font-bold text-rose-900">Cancelled · {r.name}</div>
                        <div className="mt-0.5 text-rose-800">{r.reason}</div>
                      </div>
                    ))}
                    {rescheduleReasons.map(r => (
                      <div key={`r-${r.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                        <div className="font-bold text-amber-900">Rescheduled · {r.name}</div>
                        <div className="mt-0.5 text-amber-800">
                          {r.from && r.to ? `From ${fmtDate(r.from)} → ${fmtDate(r.to)}. ` : ''}{r.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Footer actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              {reservation.overallStatus !== 'CANCELLED' && reservation.overallStatus !== 'CHECKED_OUT' && (
                <button
                  type="button"
                  onClick={handleCancelReservation}
                  className="rounded-lg bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"
                >
                  Cancel Reservation
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
