import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import guestApi from '../../api/guestApi';
import { todayIST, diffDays } from '../../utils/dateHelpers';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

type GuestSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

function normalizeGuests(raw: any[]): GuestSearchResult[] {
  return (raw || []).map((g: any) => ({
    id: String(g.id ?? g.uuid ?? g.guestId ?? g._id),
    firstName: String(g.firstName ?? g.first_name ?? g.fname ?? ''),
    lastName: String(g.lastName ?? g.last_name ?? g.lname ?? ''),
    email: g.email,
    phone: g.phone,
  })).filter(g => g.id !== 'undefined');
}

/** Inline guest search/select field — used for the organizer and each booking's guest. */
function GuestSearchField({ label, initialName, onSelect }: {
  label: string;
  initialName: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<GuestSearchResult[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched || query.length < 2) { setResults([]); return; }
    let mounted = true;
    guestApi.search(query).then(raw => {
      if (!mounted) return;
      setResults(normalizeGuests(raw));
    }).catch(() => setResults([]));
    return () => { mounted = false; };
  }, [query, touched]);

  return (
    <label className="relative block">
      <span className={labelCls}>{label}</span>
      <input
        className={inputCls}
        value={query}
        placeholder="Type name to search…"
        onChange={e => { setQuery(e.target.value); setTouched(true); }}
      />
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                const name = `${g.firstName} ${g.lastName}`.trim();
                setQuery(name);
                setResults([]);
                setTouched(false);
                onSelect(g.id, name);
              }}
              className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
            >
              <span className="font-semibold text-slate-900">{g.firstName} {g.lastName}</span>
              <span className="text-xs text-slate-500">{g.email ?? g.phone ?? 'No contact info'}</span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

interface BookingRowState {
  bookingId: string;
  guestId: string;
  guestName: string;
  unitName: string;
  roomNumber: string | null;
  adults: number;
  children: number;
  nightlyRate: number;
}

interface Props {
  reservation: GroupBookingSummaryDto;
  propertyId: string;
  onClose: () => void;
  onUpdated: (updated: GroupBookingSummaryDto) => void;
}

export default function EditReservationModal({ reservation, propertyId, onClose, onUpdated }: Props) {
  const [organizerGuestId, setOrganizerGuestId] = useState(reservation.organizerGuestId);
  const [groupReference, setGroupReference] = useState(reservation.groupReference ?? '');
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests ?? '');

  const [newCheckIn, setNewCheckIn] = useState(reservation.checkIn);
  const [newCheckOut, setNewCheckOut] = useState(reservation.checkOut);
  const [reason, setReason] = useState('');

  const currentNights = Math.max(diffDays(reservation.checkIn, reservation.checkOut), 1);

  const [rows, setRows] = useState<BookingRowState[]>(
    reservation.bookings.map((b: BookingSummaryDto) => ({
      bookingId: b.bookingId,
      guestId: b.guestId,
      guestName: b.guestName,
      unitName: b.unitName,
      roomNumber: b.roomNumber,
      adults: b.adults,
      children: b.children,
      nightlyRate: Math.round((b.totalPrice / currentNights) * 100) / 100,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayIST();
  const newNights = newCheckIn && newCheckOut ? diffDays(newCheckIn, newCheckOut) : 0;
  const datesChanged = newCheckIn !== reservation.checkIn || newCheckOut !== reservation.checkOut;
  const datesValid = newCheckIn >= today && newCheckOut > newCheckIn && newNights > 0;

  const updateRow = (bookingId: string, patch: Partial<BookingRowState>) => {
    setRows(prev => prev.map(r => r.bookingId === bookingId ? { ...r, ...patch } : r));
  };

  const handleSubmit = async () => {
    if (datesChanged && !datesValid) {
      setError('Please choose valid check-in / check-out dates.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (datesChanged) {
        await reservationApi.reschedule(propertyId, reservation.reservationId, {
          newCheckIn,
          newCheckOut,
          reason: reason.trim() || undefined,
        });
      }

      const updated = await reservationApi.updateReservation(propertyId, reservation.reservationId, {
        organizerGuestId,
        groupReference: groupReference.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        bookingUpdates: rows.map(r => ({
          bookingId: r.bookingId,
          guestId: r.guestId,
          adults: r.adults,
          children: r.children,
          nightlyRate: r.nightlyRate,
        })),
      });

      onUpdated(updated);
    } catch (e: any) {
      setError(e?.message || 'Failed to update reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Edit Reservation" className="max-w-2xl">
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Reservation-level fields */}
        <section className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Reservation</p>

          <GuestSearchField
            label="Organizer Guest"
            initialName={reservation.organizerGuestName}
            onSelect={(id) => setOrganizerGuestId(id)}
          />

          <label className="block">
            <span className={labelCls}>Group Reference</span>
            <input
              className={inputCls}
              value={groupReference}
              onChange={e => setGroupReference(e.target.value)}
              placeholder="e.g. ACME Corp Offsite"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Reservation Notes</span>
            <textarea
              className={inputCls}
              rows={3}
              value={specialRequests}
              onChange={e => setSpecialRequests(e.target.value)}
              placeholder="General notes for the whole stay…"
            />
          </label>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Check-in
              </label>
              <input
                type="date"
                value={newCheckIn}
                min={today}
                onChange={e => {
                  setNewCheckIn(e.target.value);
                  if (newCheckOut <= e.target.value) setNewCheckOut('');
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Check-out
              </label>
              <input
                type="date"
                value={newCheckOut}
                min={newCheckIn || today}
                onChange={e => setNewCheckOut(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
              />
            </div>
          </div>

          {datesChanged && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Dates will be applied to every room in this reservation. Room assignments will be released and must be re-assigned afterward.
              </div>
              <label className="block">
                <span className={labelCls}>Reschedule Reason (optional)</span>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Guest request, itinerary change…"
                />
              </label>
            </>
          )}
        </section>

        {/* Per-booking fields */}
        <section className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Rooms ({rows.length})
          </p>
          {rows.map(row => (
            <div key={row.bookingId} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-700">
                {row.unitName} {row.roomNumber ? `· Room ${row.roomNumber}` : <span className="italic font-normal text-slate-400">· unassigned</span>}
              </p>
              <GuestSearchField
                label="Guest"
                initialName={row.guestName}
                onSelect={(id, name) => updateRow(row.bookingId, { guestId: id, guestName: name })}
              />
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelCls}>Adults</span>
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={row.adults}
                    onChange={e => updateRow(row.bookingId, { adults: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Children</span>
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    value={row.children}
                    onChange={e => updateRow(row.bookingId, { children: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              </div>
              <label className="block">
                <span className={labelCls}>Nightly Rate ({reservation.currency})</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={row.nightlyRate}
                  onChange={e => updateRow(row.bookingId, { nightlyRate: Math.max(0, Number(e.target.value) || 0) })}
                />
                {!row.roomNumber && (
                  <span className="mt-1 block text-xs text-slate-400">
                    Room not yet assigned — this rate will be applied once a room is assigned.
                  </span>
                )}
              </label>
            </div>
          ))}
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1 border-t border-slate-200">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={loading} className={btnPrimary}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
