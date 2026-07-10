import { useEffect, useState, useMemo } from 'react';
import ModalShell from '../ModalShell';
import BookingDetailModal from '../Booking/BookingDetailModal';
import AddRoomModal from '../Booking/AddRoomModal';
import RescheduleModal from './RescheduleModal';
import PaymentForm from '../Billing/PaymentForm';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import bookingApi from '../../api/bookingApi';
import paymentApi from '../../api/paymentApi';
import type { PaymentDto } from '../../api/paymentApi';
import type { Booking } from '../../types';
import guestApi from '../../api/guestApi';
import travelAgentApi from '../../api/travelAgentApi';
import { GuestIdType, GUEST_ID_TYPE_LABELS } from '../../types';
import { fmtDate, fmtDateTime, diffDays } from '../../utils/dateHelpers';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
};

const TEMP_GUEST_ID = '00000000-0000-0000-0000-000000000001';
const TEMP_GUEST_NAME = 'Temporary Guest';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-600';
const sectionHeadingCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3';

// ── Guest search + inline create ──────────────────────────────────────────────

type GuestResult = { id: string; firstName: string; lastName: string; email?: string; phone?: string };

function normalizeGuests(raw: any[]): GuestResult[] {
  return (raw || []).map((g: any) => ({
    id: String(g.id ?? g.uuid ?? g.guestId ?? ''),
    firstName: String(g.firstName ?? g.first_name ?? ''),
    lastName: String(g.lastName ?? g.last_name ?? ''),
    email: g.email,
    phone: g.phone,
  })).filter(g => g.id);
}

function GuestSearchField({
  label,
  initialName,
  onSelect,
  allowCreate = true,
}: {
  label: string;
  initialName: string;
  onSelect: (id: string, name: string) => void;
  allowCreate?: boolean;
}) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<GuestResult[]>([]);
  const [touched, setTouched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newIdType, setNewIdType] = useState<GuestIdType | ''>('');
  const [newIdNumber, setNewIdNumber] = useState('');
  const [newPreferences, setNewPreferences] = useState('');

  useEffect(() => {
    if (!touched || query.length < 2) { setResults([]); return; }
    let mounted = true;
    guestApi.search(query).then(raw => {
      if (!mounted) return;
      setResults(normalizeGuests(raw));
    }).catch(() => setResults([]));
    return () => { mounted = false; };
  }, [query, touched]);

  const handleCreate = async () => {
    if (!newFirst.trim()) return;
    setCreating(true);
    try {
      const created = await guestApi.create({
        firstName: newFirst.trim(),
        lastName: newLast.trim() || undefined,
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        dateOfBirth: newDob || undefined,
        guestIdType: (newIdType as GuestIdType) || undefined,
        idNumber: newIdNumber.trim() || undefined,
        preferences: newPreferences.trim() || undefined,
      });
      const name = `${newFirst.trim()} ${newLast.trim()}`.trim();
      setQuery(name);
      setResults([]);
      setShowCreate(false);
      setTouched(false);
      onSelect(created.id, name);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <label className={labelCls}>{label}</label>
      <input
        className={inputCls}
        value={query}
        placeholder="Search by name…"
        onChange={e => { setQuery(e.target.value); setTouched(true); setShowCreate(false); }}
      />
      {touched && results.length === 0 && query.length >= 2 && !showCreate && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="px-4 py-2.5 text-xs text-slate-500">No results.</div>
          {allowCreate && (
            <button
              type="button"
              onClick={() => {
                // Pre-split "first last" from query
                const parts = query.trim().split(' ');
                setNewFirst(parts[0] ?? '');
                setNewLast(parts.slice(1).join(' '));
                setShowCreate(true);
                setResults([]);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-indigo-600 hover:bg-slate-50"
            >
              + Create new guest "{query}"
            </button>
          )}
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
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
              className="flex w-full flex-col items-start border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">{g.firstName} {g.lastName}</span>
              <span className="text-xs text-slate-500">{g.email ?? g.phone ?? 'No contact info'}</span>
            </button>
          ))}
        </div>
      )}
      {showCreate && (
        <div className="mt-2 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>First name *</label>
              <input className={inputCls} value={newFirst} onChange={e => setNewFirst(e.target.value)} placeholder="First name" />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input className={inputCls} value={newLast} onChange={e => setNewLast(e.target.value)} placeholder="Last name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email (optional)" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone (optional)" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Date of birth</label>
              <input type="date" className={inputCls} value={newDob} onChange={e => setNewDob(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>ID type</label>
              <select className={inputCls} value={newIdType} onChange={e => setNewIdType(e.target.value as GuestIdType | '')}>
                <option value="">— none —</option>
                {Object.values(GuestIdType).map(t => (
                  <option key={t} value={t}>{GUEST_ID_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          {newIdType && (
            <div>
              <label className={labelCls}>ID number</label>
              <input className={inputCls} value={newIdNumber} onChange={e => setNewIdNumber(e.target.value)} placeholder="Document number" />
            </div>
          )}
          <div>
            <label className={labelCls}>Preferences / notes</label>
            <input className={inputCls} value={newPreferences} onChange={e => setNewPreferences(e.target.value)} placeholder="Dietary, room preferences… (optional)" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCreate} disabled={creating || !newFirst.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Travel agent search field ─────────────────────────────────────────────────

function TravelAgentField({
  initialId,
  initialName,
  onSelect,
}: {
  initialId: string;
  initialName: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState(initialName);
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched || query.length < 2) { setResults([]); return; }
    let mounted = true;
    travelAgentApi.search(query).then(raw => {
      if (!mounted) return;
      setResults((raw || []).map((a: any) => ({ id: String(a.id), name: String(a.name ?? a.agencyName ?? '') })));
    }).catch(() => setResults([]));
    return () => { mounted = false; };
  }, [query, touched]);

  // Reset query when initialName changes externally
  useEffect(() => { setQuery(initialName); }, [initialName]);

  return (
    <div className="relative">
      <label className={labelCls}>Travel Agent</label>
      <input
        className={inputCls}
        value={query}
        placeholder="Search agency name…"
        onChange={e => { setQuery(e.target.value); setTouched(true); if (!e.target.value) onSelect('', ''); }}
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setQuery(a.name); setResults([]); setTouched(false); onSelect(a.id, a.name); }}
              className="flex w-full items-start border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-900">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-room inline editor ────────────────────────────────────────────────────

interface RowState {
  guestId: string;
  guestName: string;
  adults: number;
  children: number;
  extraBeds: number;
  isTwinBed: boolean;
  customRate: string;
}

function BookingRow({
  booking,
  nights,
  currency,
  nightlyRate,
  isSingle,
  overallStatus,
  onSave,
  onViewDetail,
}: {
  booking: BookingSummaryDto;
  nights: number;
  currency: string;
  nightlyRate: number;
  isSingle: boolean;
  overallStatus: string;
  onSave: (bookingId: string, row: RowState) => Promise<void>;
  onViewDetail?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<RowState>(() => ({
    guestId: booking.guestId,
    guestName: booking.guestName,
    adults: booking.adults ?? 1,
    children: booking.children ?? 0,
    extraBeds: booking.extraBeds ?? 0,
    isTwinBed: booking.isTwinBed ?? false,
    customRate: booking.nightlyRate != null && booking.nightlyRate !== nightlyRate
      ? String(booking.nightlyRate)
      : '',
  }));

  const isTemp = booking.guestId === TEMP_GUEST_ID || booking.guestName === TEMP_GUEST_NAME;
  const effectiveRate = parseFloat(row.customRate) || nightlyRate;
  const estimatedTotal = Math.round(effectiveRate * Math.max(nights, 0) * 100) / 100;

  // Occupancy/extra-bed/twin/rate can always be edited (unless the booking or whole
  // reservation is locked); guest reassignment is only allowed before check-in.
  const canEditGuest = !booking.cancelled && overallStatus !== 'CHECKED_IN' && overallStatus !== 'CHECKED_OUT' && overallStatus !== 'CANCELLED';
  const canEditRoom = !booking.cancelled && overallStatus !== 'CHECKED_OUT' && overallStatus !== 'CANCELLED';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(booking.bookingId, row);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between gap-4 px-4 py-3 transition-colors',
          canEditGuest && 'cursor-pointer hover:bg-slate-50',
          expanded && 'bg-slate-50'
        )}
        onClick={() => canEditGuest ? setExpanded(v => !v) : undefined}
      >
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold truncate', isTemp ? 'text-amber-600 italic' : 'text-slate-900')}>
            {isTemp ? '— Unassigned —' : booking.guestName}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {booking.unitName}
            {booking.roomNumber ? ` · Room ${booking.roomNumber}` : ' · unassigned'}
            {booking.isTwinBed && ' · twin'}
            {(booking.extraBeds ?? 0) > 0 && ` · ${booking.extraBeds} extra bed${booking.extraBeds !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', booking.cancelled ? STATUS_BADGE.CANCELLED : (STATUS_BADGE[overallStatus] || STATUS_BADGE.PENDING))}>
              {booking.cancelled ? 'CANCELLED' : overallStatus.replace('_', ' ')}
            </span>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {currency} {booking.totalPrice.toFixed(2)}
            </div>
          </div>
          {canEditGuest && <span className="text-slate-400 text-xs">{expanded ? '▲' : '▼'}</span>}
          {!canEditGuest && (
            <div className="flex flex-col items-end gap-1">
              {onViewDetail && (
                <button type="button" onClick={e => { e.stopPropagation(); onViewDetail(); }}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-700">
                  View →
                </button>
              )}
              {canEditRoom && (
                <button type="button" onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                  {expanded ? 'Close' : 'Edit'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && canEditRoom && (
        <form onSubmit={handleSave} className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-3">
          {canEditGuest && (
            <GuestSearchField
              label="Guest"
              initialName={isTemp ? '' : booking.guestName}
              onSelect={(id, name) => setRow(r => ({ ...r, guestId: id, guestName: name }))}
            />
          )}

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Adults</label>
              <input type="number" min={1} className={inputCls} value={row.adults}
                onChange={e => setRow(r => ({ ...r, adults: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div>
              <label className={labelCls}>Children</label>
              <input type="number" min={0} className={inputCls} value={row.children}
                onChange={e => setRow(r => ({ ...r, children: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div>
              <label className={labelCls}>Extra Beds</label>
              <input type="number" min={0} max={5} className={inputCls} value={row.extraBeds}
                onChange={e => setRow(r => ({ ...r, extraBeds: Math.max(0, Number(e.target.value) || 0) }))} />
            </div>
            <div className="flex flex-col justify-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  checked={row.isTwinBed}
                  onChange={e => setRow(r => ({ ...r, isTwinBed: e.target.checked }))}
                />
                <span className="text-xs font-semibold text-slate-600">Twin</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelCls}>Custom nightly rate (optional)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={row.customRate}
              onChange={e => setRow(r => ({ ...r, customRate: e.target.value }))}
              placeholder={String(nightlyRate)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Leave blank to use the unit rate ({currency} {nightlyRate.toFixed(2)})
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-500">
              Est. {currency} <span className="font-bold text-slate-800">{estimatedTotal.toFixed(2)}</span>
              {' '}({nights}n × {currency} {effectiveRate.toFixed(2)})
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setExpanded(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}
    </li>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string;
  reservationId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function ReservationDetailModal({ propertyId, reservationId, onClose, onUpdated }: Props) {
  const [reservation, setReservation] = useState<GroupBookingSummaryDto | null>(null);
  const [fullBookings, setFullBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'payments'>('detail');

  // Organizer state
  const [editingOrganizer, setEditingOrganizer] = useState(false);
  const [organizerSaving, setOrganizerSaving] = useState(false);

  // Reservation-level details form
  interface ResDetails {
    groupReference: string;
    specialRequests: string;
    mealPlanType: 'CP' | 'MAP' | 'AP' | '';
    bookingSource: string;
    travelAgentId: string;
    travelAgentName: string;
  }
  const [resDetails, setResDetails] = useState<ResDetails>({
    groupReference: '', specialRequests: '', mealPlanType: 'CP',
    bookingSource: '', travelAgentId: '', travelAgentName: '',
  });
  // Per-unit nightly rates (one per unit)
  const [unitRates, setUnitRates] = useState<Record<string, string>>({});
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [savingUnitId, setSavingUnitId] = useState<string | null>(null);

  // Payments tab
  const [allPayments, setAllPayments] = useState<PaymentDto[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState<{ amount: string; notes: string }>({ amount: '', notes: '' });
  const [paymentProcessingId, setPaymentProcessingId] = useState<string | null>(null);

  const initFromReservation = (r: GroupBookingSummaryDto) => {
    const firstActive = r.bookings.find(b => !b.cancelled);
    setResDetails({
      groupReference: r.groupReference || '',
      specialRequests: r.specialRequests || '',
      mealPlanType: (firstActive?.mealPlanType || 'CP') as any,
      bookingSource: r.bookingSource || '',
      travelAgentId: r.travelAgentId || '',
      travelAgentName: r.travelAgentName || '',
    });
    const rates: Record<string, string> = {};
    r.bookings.forEach(b => {
      if (b.unitId && !(b.unitId in rates)) {
        const rate = b.nightlyRate ?? b.unitBaseRate;
        rates[b.unitId] = rate != null ? String(rate) : '';
      }
    });
    setUnitRates(rates);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await reservationApi.getReservation(propertyId, reservationId);
      setReservation(r);
      initFromReservation(r);
      const ids = r.bookings.map(b => b.bookingId);
      const fetched = await Promise.all(ids.map(id => bookingApi.getById(propertyId, id).catch(() => null)));
      setFullBookings(fetched.filter(Boolean) as Booking[]);
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

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const data = await paymentApi.getAllPaymentsForReservation(propertyId, reservationId);
      setAllPayments(data || []);
    } catch {
      // non-critical
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'payments') loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reservationId]);

  // Grouped units (for rate inputs)
  const unitGroups = useMemo(() => {
    if (!reservation) return [];
    const seen = new Set<string>();
    const groups: Array<{ unitId: string; unitName: string; bookings: BookingSummaryDto[] }> = [];
    for (const b of reservation.bookings) {
      if (!seen.has(b.unitId)) {
        seen.add(b.unitId);
        groups.push({ unitId: b.unitId, unitName: b.unitName, bookings: [] });
      }
      groups.find(g => g.unitId === b.unitId)!.bookings.push(b);
    }
    return groups;
  }, [reservation]);

  const nights = reservation ? diffDays(reservation.checkIn, reservation.checkOut) : 0;
  const isSingleRoom = (reservation?.totalRooms ?? 0) === 1;
  const grandTotal = reservation?.totalGroupPrice ?? 0;
  const totalBalance = reservation
    ? Math.max(
        0,
        reservation.bookings.reduce((s, b) => s + (b.balanceDue ?? 0), 0)
          - (reservation.reservationLevelPaidAmount ?? 0)
      )
    : 0;
  const isOrganizerTemp = reservation?.organizerGuestId === TEMP_GUEST_ID
    || reservation?.organizerGuestName === TEMP_GUEST_NAME;
  const isEditable = reservation
    && reservation.overallStatus !== 'CANCELLED'
    && reservation.overallStatus !== 'CHECKED_OUT';

  // ── Handlers ──

  const handleSaveOrganizer = async (guestId: string, guestName: string) => {
    if (!reservation) return;
    setOrganizerSaving(true);
    try {
      await reservationApi.updateReservation(propertyId, reservationId, {
        organizerGuestId: guestId,
      });
      await fetchData();
      onUpdated?.();
      setEditingOrganizer(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to update organizer');
    } finally {
      setOrganizerSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!reservation) return;
    setDetailsSaving(true);
    try {
      const bookingUpdates = reservation.bookings.map(b => ({
        bookingId: b.bookingId,
        guestId: b.guestId,
        adults: b.adults,
        children: b.children,
        nightlyRate: parseFloat(unitRates[b.unitId] || '0') || 0,
      }));
      await reservationApi.updateReservation(propertyId, reservationId, {
        organizerGuestId: reservation.organizerGuestId,
        groupReference: resDetails.groupReference || undefined,
        specialRequests: resDetails.specialRequests || undefined,
        mealPlanType: (resDetails.mealPlanType as any) || undefined,
        bookingSource: resDetails.bookingSource || undefined,
        travelAgentId: resDetails.travelAgentId || undefined,
        bookingUpdates,
      });
      await fetchData();
      onUpdated?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to save details');
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleSaveUnitRate = async (unitId: string) => {
    if (!reservation) return;
    const rate = parseFloat(unitRates[unitId] || '0') || 0;
    const bookingIds = reservation.bookings.filter(b => b.unitId === unitId).map(b => b.bookingId);
    setSavingUnitId(unitId);
    try {
      await reservationApi.updateReservation(propertyId, reservationId, {
        organizerGuestId: reservation.organizerGuestId,
        bookingUpdates: bookingIds.map(bookingId => ({ bookingId, nightlyRate: rate })),
      });
      await fetchData();
      onUpdated?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to save rate');
    } finally {
      setSavingUnitId(null);
    }
  };

  const handleSaveBookingRow = async (bookingId: string, row: RowState) => {
    if (!reservation) return;
    const existing = reservation.bookings.find(b => b.bookingId === bookingId)!;
    const unitRate = parseFloat(unitRates[existing.unitId] || '0') || 0;
    const rate = row.customRate.trim() !== '' ? parseFloat(row.customRate) || unitRate : unitRate;
    await reservationApi.updateReservation(propertyId, reservationId, {
      organizerGuestId: reservation.organizerGuestId,
      bookingUpdates: [{
        bookingId,
        guestId: row.guestId,
        adults: row.adults,
        children: row.children,
        isTwinBed: row.isTwinBed,
        extraBeds: row.extraBeds,
        nightlyRate: rate,
      }],
    });
    await fetchData();
    onUpdated?.();
  };

  const handleCancelReservation = async () => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return;
    if (!confirm('Cancel this reservation? All member bookings will be cancelled.')) return;
    try {
      await reservationApi.cancelReservation(propertyId, reservationId);
      onUpdated?.();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel');
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
      setError(e?.message || 'Failed to toggle billing');
    }
  };

  const guestNameForPayment = (p: PaymentDto): string => {
    if (p.reservationId && !p.bookingId) return 'Master';
    const match = reservation?.bookings.find(b => b.bookingId === p.bookingId);
    return match?.guestName ?? 'Guest';
  };

  const totalPayments = useMemo(
    () => allPayments.reduce((s, p) => s + (p.amount ?? 0), 0),
    [allPayments]
  );

  const startEditPayment = (p: PaymentDto) => {
    setEditingPaymentId(p.id);
    setPaymentEditForm({ amount: String(p.amount ?? ''), notes: p.notes ?? '' });
  };

  const handleSavePaymentEdit = async (p: PaymentDto) => {
    const amt = parseFloat(paymentEditForm.amount);
    if (isNaN(amt) || amt <= 0) return;
    setPaymentProcessingId(p.id);
    try {
      if (p.reservationId && !p.bookingId) {
        await paymentApi.updateReservationPayment(propertyId, reservationId, p.id, { amount: amt, notes: paymentEditForm.notes });
      } else {
        const b = reservation?.bookings.find(b => b.bookingId === p.bookingId);
        if (!b?.folioId) throw new Error('Folio not found');
        await paymentApi.updateFolioPayment(propertyId, b.folioId, p.id, { amount: amt, notes: paymentEditForm.notes });
      }
      setEditingPaymentId(null);
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to update payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const handleDeletePayment = async (p: PaymentDto) => {
    if (!window.confirm(`Delete payment of ${reservation?.currency} ${p.amount?.toFixed(2)}?`)) return;
    setPaymentProcessingId(p.id);
    try {
      if (p.reservationId && !p.bookingId) {
        await paymentApi.deleteReservationPayment(propertyId, reservationId, p.id);
      } else {
        const b = reservation?.bookings.find(b => b.bookingId === p.bookingId);
        if (!b?.folioId) throw new Error('Folio not found');
        await paymentApi.deleteFolioPayment(propertyId, b.folioId, p.id);
      }
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment.');
    } finally {
      setPaymentProcessingId(null);
    }
  };

  const selectedBooking = selectedBookingId
    ? fullBookings.find(b => b.id === selectedBookingId) ?? null
    : null;

  const paymentFolioId = isSingleRoom ? reservation?.bookings[0]?.folioId ?? null : null;

  // ── Render ──

  return (
    <>
    <ModalShell
      onClose={onClose}
      title="Reservation"
      subtitle={reservation?.reservationNumber ? `#${reservation.reservationNumber}` : undefined}
      size="wide"
    >
      <div>
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}
        {loading && <div className="py-12 text-center text-sm text-slate-400">Loading…</div>}

        {reservation && (
          <>
            {/* Tab strip */}
            <div className="mb-5 flex gap-1 border-b border-slate-200">
              {(['detail', 'payments'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2 text-sm font-bold capitalize transition-colors',
                    activeTab === tab
                      ? 'border-b-2 border-indigo-600 text-indigo-700'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {tab === 'detail' ? 'Detail' : 'Payments'}
                </button>
              ))}
            </div>

            {/* ── DETAIL TAB ── */}
            {activeTab === 'detail' && (
              <div className="flex flex-col gap-6 lg:flex-row">

                {/* LEFT PANE */}
                <div className="min-w-0 flex-1 space-y-6">

                  {/* Dates + status bar */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {fmtDate(reservation.checkIn)} → {fmtDate(reservation.checkOut)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {nights} nights · {reservation.totalRooms} {reservation.totalRooms === 1 ? 'room' : 'rooms'}
                      </p>
                    </div>
                    <span className={cn('shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', STATUS_BADGE[reservation.overallStatus] || STATUS_BADGE.PENDING)}>
                      {reservation.overallStatus.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Rates per unit */}
                  {isEditable && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className={sectionHeadingCls}>Nightly Rates</p>
                      <div className="space-y-3">
                        {unitGroups.map(g => {
                          const baseRate = g.bookings[0]?.unitBaseRate;
                          return (
                            <div key={g.unitId} className="flex items-center gap-3">
                              <label className="w-36 shrink-0 text-sm font-semibold text-slate-700 truncate">
                                {g.unitName}
                                <span className="ml-1.5 text-xs font-normal text-slate-400">
                                  ({g.bookings.length} room{g.bookings.length !== 1 ? 's' : ''})
                                </span>
                              </label>
                              <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{reservation.currency}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  value={unitRates[g.unitId] ?? ''}
                                  onChange={e => setUnitRates(r => ({ ...r, [g.unitId]: e.target.value }))}
                                  placeholder={baseRate != null ? String(baseRate) : '0'}
                                />
                              </div>
                              {baseRate != null && (
                                <span className="shrink-0 text-xs text-slate-400">
                                  default: {baseRate.toFixed(0)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSaveUnitRate(g.unitId)}
                                disabled={savingUnitId === g.unitId}
                                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                              >
                                {savingUnitId === g.unitId ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Meal plan */}
                  {isEditable && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className={sectionHeadingCls}>Meal Plan (all rooms)</p>
                      <p className="mb-2 text-xs text-slate-500">
                        Informational only — fold the meal cost into the nightly rate above.
                      </p>
                      <div className="flex flex-wrap gap-4">
                        {([
                          { value: '', label: 'None' },
                          { value: 'CP', label: 'CP — Breakfast only' },
                          { value: 'MAP', label: 'MAP — Breakfast + 1 meal' },
                          { value: 'AP', label: 'AP — All inclusive' },
                        ] as const).map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={resDetails.mealPlanType === opt.value}
                              onChange={() => setResDetails(d => ({ ...d, mealPlanType: opt.value }))}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Booking source + travel agent */}
                  {isEditable && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className={sectionHeadingCls}>Source &amp; Agent</p>
                      <div className="space-y-3">
                        <div>
                          <label className={labelCls}>Booking Source</label>
                          <input
                            className={inputCls}
                            value={resDetails.bookingSource}
                            onChange={e => setResDetails(d => ({ ...d, bookingSource: e.target.value }))}
                            placeholder="e.g. Walk-in, MakeMyTrip, Phone…"
                          />
                        </div>
                        <TravelAgentField
                          initialId={resDetails.travelAgentId}
                          initialName={resDetails.travelAgentName}
                          onSelect={(id, name) => setResDetails(d => ({ ...d, travelAgentId: id, travelAgentName: name }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* Reference / notes */}
                  {isEditable && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className={sectionHeadingCls}>Notes</p>
                      <input
                        className={inputCls}
                        value={resDetails.groupReference}
                        onChange={e => setResDetails(d => ({ ...d, groupReference: e.target.value }))}
                        placeholder="Group reference / note…"
                      />
                    </div>
                  )}

                  {/* Rooms list */}
                  <div>
                    <p className={sectionHeadingCls}>
                      Rooms ({reservation.bookings.length})
                      {isEditable && <span className="ml-2 normal-case font-normal text-slate-400">· click to edit occupancy / guest</span>}
                    </p>
                    <ul className="space-y-2">
                      {reservation.bookings.map(b => {
                        const rate = parseFloat(unitRates[b.unitId] || '0') || 0;
                        return (
                          <BookingRow
                            key={b.bookingId}
                            booking={b}
                            nights={nights}
                            currency={reservation.currency}
                            nightlyRate={rate}
                            isSingle={isSingleRoom}
                            overallStatus={reservation.overallStatus}
                            onSave={handleSaveBookingRow}
                            onViewDetail={() => setSelectedBookingId(b.bookingId)}
                          />
                        );
                      })}
                    </ul>

                    {reservation.bookings.length > 1 && (
                      <div className="mt-3 flex justify-end rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Total</p>
                          <p className="text-sm font-extrabold text-slate-900">{reservation.currency} {grandTotal.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400">{nights}n · {reservation.bookings.length} rooms</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audit trail */}
                  {(() => {
                    const cancelledRows = fullBookings.filter(b => b.cancellationReason);
                    const rescheduledRows = fullBookings.filter(b => b.rescheduleReason);
                    if (!cancelledRows.length && !rescheduledRows.length) return null;
                    return (
                      <div>
                        <p className={sectionHeadingCls}>Audit</p>
                        <div className="space-y-2">
                          {cancelledRows.map(b => (
                            <div key={`c-${b.id}`} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
                              <div className="font-bold text-rose-900">Cancelled · {b.guestName}</div>
                              <div className="mt-0.5 text-rose-800">{b.cancellationReason}</div>
                            </div>
                          ))}
                          {rescheduledRows.map(b => (
                            <div key={`r-${b.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                              <div className="font-bold text-amber-900">Rescheduled · {b.guestName}</div>
                              <div className="mt-0.5 text-amber-800">
                                {b.originalCheckIn && b.originalCheckOut
                                  ? `From ${fmtDate(b.originalCheckIn)} → ${fmtDate(b.originalCheckOut)}. `
                                  : ''}{b.rescheduleReason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* RIGHT PANE */}
                <div className="lg:w-72 xl:w-80 shrink-0 space-y-4">

                  {/* Organizer card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className={sectionHeadingCls}>Organizer</p>
                    {(isOrganizerTemp || editingOrganizer) ? (
                      <div>
                        <GuestSearchField
                          label="Search or create guest"
                          initialName=""
                          onSelect={(id, name) => {
                            if (organizerSaving) return;
                            handleSaveOrganizer(id, name);
                          }}
                        />
                        {organizerSaving && <p className="mt-2 text-xs text-slate-400">Saving…</p>}
                        {!isOrganizerTemp && (
                          <button type="button" onClick={() => setEditingOrganizer(false)}
                            className="mt-2 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-extrabold text-slate-900 leading-tight">{reservation.organizerGuestName}</p>
                          {reservation.groupReference && (
                            <p className="mt-0.5 text-xs font-semibold text-indigo-600">{reservation.groupReference}</p>
                          )}
                          {reservation.travelAgentName && (
                            <p className="mt-1 text-xs text-slate-500">Agent: {reservation.travelAgentName}</p>
                          )}
                          {reservation.bookingSource && (
                            <p className="mt-0.5 text-xs text-slate-500">Source: {reservation.bookingSource}</p>
                          )}
                        </div>
                        {isEditable && (
                          <button type="button" onClick={() => setEditingOrganizer(true)}
                            className="shrink-0 text-xs text-slate-400 hover:text-slate-600" title="Change organizer">
                            ✏
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <p className={sectionHeadingCls}>Summary</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Total</span>
                      <span className="font-bold text-slate-900">{reservation.currency} {grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Balance due</span>
                      <span className={cn('font-bold', totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                        {reservation.currency} {totalBalance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Created</span>
                      <span>{fmtDate(reservation.createdAt)}</span>
                    </div>
                    {reservation.totalRooms > 1 && (
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Billing</span>
                        <span>{reservation.billingMode}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {isEditable && (
                      <button
                        type="button"
                        onClick={handleSaveDetails}
                        disabled={detailsSaving}
                        className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {detailsSaving ? 'Saving…' : 'Save Details'}
                      </button>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setShowAddPayment(true)}
                        className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Record Payment
                      </button>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setShowAddRoom(true)}
                        className="w-full rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        Add Room
                      </button>
                    )}
                    {(reservation.overallStatus === 'PENDING' || reservation.overallStatus === 'CONFIRMED') && (
                      <button
                        type="button"
                        onClick={() => setShowReschedule(true)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Reschedule
                      </button>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={handleCancelReservation}
                        className="w-full rounded-xl bg-rose-50 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        Cancel Reservation
                      </button>
                    )}
                    {reservation.totalRooms > 1 && isEditable && (
                      <button
                        type="button"
                        onClick={handleToggleBilling}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Switch to {reservation.billingMode === 'CONSOLIDATED' ? 'Separate' : 'Consolidated'} billing
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {activeTab === 'payments' && (
              <div>
                {paymentsLoading ? (
                  <div className="py-12 text-center text-sm text-slate-400">Loading payments…</div>
                ) : allPayments.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                    No payments recorded for this reservation.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Ref #</th>
                          <th className="px-4 py-2.5">Guest</th>
                          <th className="px-4 py-2.5">Method</th>
                          <th className="px-4 py-2.5">Notes</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                          <th className="px-4 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allPayments.map(p => {
                          const isEditing = editingPaymentId === p.id;
                          const isProcessing = paymentProcessingId === p.id;
                          if (isEditing) {
                            return (
                              <tr key={p.id} className="bg-emerald-50/60">
                                <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(p.paymentDate)}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{p.paymentNumber}</td>
                                <td className="px-4 py-3 text-xs font-medium text-slate-700">{guestNameForPayment(p)}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{p.paymentMethod?.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-3">
                                  <input type="text" value={paymentEditForm.notes}
                                    onChange={e => setPaymentEditForm(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                    placeholder="Notes" />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <input type="number" min="0.01" step="0.01" value={paymentEditForm.amount}
                                    onChange={e => setPaymentEditForm(f => ({ ...f, amount: e.target.value }))}
                                    className="w-28 rounded border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleSavePaymentEdit(p)} disabled={isProcessing}
                                      className="text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-800 disabled:opacity-50">
                                      {isProcessing ? 'Saving…' : 'Save'}
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => setEditingPaymentId(null)}
                                      className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600">
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={p.id} className="transition-colors hover:bg-slate-50">
                              <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(p.paymentDate)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{p.paymentNumber}</td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
                                  p.reservationId && !p.bookingId ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                )}>
                                  {guestNameForPayment(p)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-medium text-slate-700">{p.paymentMethod?.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{p.notes || '—'}</td>
                              <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                                {reservation.currency} {(p.amount ?? 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => startEditPayment(p)}
                                    className="text-[10px] font-bold uppercase text-indigo-500 hover:text-indigo-700">
                                    Edit
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button onClick={() => handleDeletePayment(p)} disabled={isProcessing}
                                    className="text-[10px] font-bold uppercase text-rose-500 hover:text-rose-700 disabled:opacity-50">
                                    {isProcessing ? '…' : 'Delete'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex justify-end border-t-2 border-slate-200 bg-slate-50 px-4 py-2.5">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payments</p>
                        <p className="text-sm font-extrabold text-emerald-700">{reservation.currency} {totalPayments.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
        onSuccess={() => { setShowAddRoom(false); fetchData(); onUpdated?.(); }}
      />
    )}
    {showReschedule && reservation && (
      <RescheduleModal
        reservation={reservation}
        propertyId={propertyId}
        onClose={() => setShowReschedule(false)}
        onRescheduled={() => { setShowReschedule(false); fetchData(); onUpdated?.(); }}
      />
    )}
    {showAddPayment && reservation && (
      <ModalShell title="Record Payment" onClose={() => setShowAddPayment(false)}>
        <PaymentForm
          propertyId={propertyId}
          folioId={isSingleRoom ? paymentFolioId ?? undefined : undefined}
          reservationId={isSingleRoom ? undefined : reservation.reservationId}
          balanceDue={totalBalance}
          onSuccess={() => { setShowAddPayment(false); fetchData(); onUpdated?.(); }}
          onCancel={() => setShowAddPayment(false)}
        />
      </ModalShell>
    )}
    </>
  );
}
