import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import BookingDetailModal from '../Booking/BookingDetailModal';
import AddRoomModal from '../Booking/AddRoomModal';
import RescheduleModal from './RescheduleModal';
import EditReservationModal from './EditReservationModal';
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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showEditReservation, setShowEditReservation] = useState(false);

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

  const selectedBooking = selectedBookingId ? bookings.find(b => b.id === selectedBookingId) ?? null : null;

  return (
    <>
    <ModalShell onClose={onClose} title="Reservation" subtitle={reservation?.reservationNumber ? `#${reservation.reservationNumber}` : undefined} className="max-w-6xl">
      <div>
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-200">{error}</div>}
        {loading && <div className="text-sm text-slate-500">Loading…</div>}

        {reservation && (
          <>
            {/* Header summary card */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight truncate">
                    {reservation.organizerGuestName}
                  </h2>
                  {reservation.groupReference && (
                    <p className="mt-0.5 text-sm font-semibold text-indigo-600">{reservation.groupReference}</p>
                  )}
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{fmtDate(reservation.checkIn)} → {fmtDate(reservation.checkOut)}</span>
                    {' · '}{diffDays(reservation.checkIn, reservation.checkOut)} nights
                    {' · '}{reservation.totalRooms} {reservation.totalRooms === 1 ? 'room' : 'rooms'}
                  </p>
                </div>
                <span className={cn('shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', STATUS_BADGE[reservation.overallStatus] || STATUS_BADGE.PENDING)}>
                  {reservation.overallStatus.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white/70 py-3 text-sm">
                <div className="px-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</div>
                  <div className="mt-1 font-bold text-slate-900">{reservation.currency} {reservation.totalGroupPrice.toFixed(2)}</div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Billing</div>
                  <div className="mt-1 font-bold text-slate-900">{reservation.billingMode}</div>
                </div>
                <div className="px-4 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Created</div>
                  <div className="mt-1 font-bold text-slate-700">{fmtDate(reservation.createdAt)}</div>
                </div>
              </div>

              {reservation.totalRooms > 1 && (
                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full rounded-full border border-indigo-200 bg-indigo-50 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    onClick={handleToggleBilling}
                  >
                    Switch to {reservation.billingMode === 'CONSOLIDATED' ? 'Separate' : 'Consolidated'} billing
                  </button>
                </div>
              )}
            </div>

            {/* Member bookings */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Rooms ({reservation.bookings.length})</h3>
              <ul className="mt-2 space-y-2">
                {reservation.bookings.map((b: BookingSummaryDto) => (
                  <li
                    key={b.bookingId}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
                    onClick={() => setSelectedBookingId(b.bookingId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{b.guestName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {b.unitName} · Room {b.roomNumber || <span className="italic">unassigned</span>}
                        {b.isTwinBed && ' · twin'}
                      </div>
                      {b.specialRequests && (
                        <div className="mt-1 text-xs text-slate-500 italic">"{b.specialRequests}"</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_BADGE[b.status] || STATUS_BADGE.PENDING)}>
                          {b.status.replace('_', ' ')}
                        </span>
                        <div className="mt-1 text-xs font-semibold text-slate-600">
                          {reservation.currency} {b.totalPrice.toFixed(2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-rose-500 hover:text-rose-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Remove
                      </button>
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
            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5">
              {reservation.overallStatus !== 'CANCELLED' && reservation.overallStatus !== 'CHECKED_OUT' && (
                <button
                  type="button"
                  onClick={() => setShowAddRoom(true)}
                  className="whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Add Room
                </button>
              )}
              {reservation.overallStatus !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => setShowEditReservation(true)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
              )}
              {(reservation.overallStatus === 'PENDING' || reservation.overallStatus === 'CONFIRMED') && (
                <button
                  type="button"
                  onClick={() => setShowReschedule(true)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Reschedule
                </button>
              )}
              {reservation.overallStatus !== 'CANCELLED' && reservation.overallStatus !== 'CHECKED_OUT' && (
                <button
                  type="button"
                  onClick={handleCancelReservation}
                  className="whitespace-nowrap rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  Cancel Reservation
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </ModalShell>
    {selectedBooking && (
      <BookingDetailModal
        booking={selectedBooking}
        propertyId={propertyId}
        onClose={() => setSelectedBookingId(null)}
        onEditBooking={() => setSelectedBookingId(null)}
        onOpenFolio={() => setSelectedBookingId(null)}
      />
    )}
    {showAddRoom && reservation && (
      <AddRoomModal
        propertyId={propertyId}
        reservationId={reservationId}
        checkIn={reservation.checkIn}
        checkOut={reservation.checkOut}
        organizerGuestId={reservation.organizerGuestId}
        organizerGuestName={reservation.organizerGuestName}
        status={reservation.overallStatus}
        onClose={() => setShowAddRoom(false)}
        onSuccess={() => {
          setShowAddRoom(false);
          fetchData();
          onUpdated?.();
        }}
      />
    )}
    {showReschedule && reservation && (
      <RescheduleModal
        reservation={reservation}
        propertyId={propertyId}
        onClose={() => setShowReschedule(false)}
        onRescheduled={() => {
          setShowReschedule(false);
          fetchData();
          onUpdated?.();
        }}
      />
    )}
    {showEditReservation && reservation && (
      <EditReservationModal
        reservation={reservation}
        propertyId={propertyId}
        onClose={() => setShowEditReservation(false)}
        onUpdated={() => {
          setShowEditReservation(false);
          fetchData();
          onUpdated?.();
        }}
      />
    )}
    </>
  );
}
