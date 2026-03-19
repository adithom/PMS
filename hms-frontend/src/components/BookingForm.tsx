import React, { useEffect, useState } from 'react';
import propertyApi from '../api/propertyApi';
import guestApi from '../api/guestApi';
import bookingApi, { type BookingCreationDto } from '../api/bookingApi';
import roomApi from '../api/roomApi';
import availabilityApi from '../api/availabilityApi';
import type { Property, Room, UnitDto, Booking } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

export type GuestSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

type Props = {
  propertyId?: string | null;
  room?: Room | null;
  booking?: Booking | null;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuest?: GuestSearchResult | null;
  onSuccess?: (created: Booking) => void;
  onCancel?: () => void;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

/* ────────────────────────────────────────────────────────────── */
/* Component                                                    */
/* ────────────────────────────────────────────────────────────── */

export default function BookingForm({
  propertyId: propPropertyId = null,
  room: preselectedRoom = null,
  booking = null,
  initialCheckIn,
  initialCheckOut,
  initialGuest,
  onSuccess,
  onCancel
}: Props) {
  const isEditMode = !!booking;
  const getRoomId = (r: Room | null): string | null => r ? r.roomId ?? (r as any).id ?? null : null;

  // ── Hierarchy State ──
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(propPropertyId || booking?.propertyId || null);
  
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(booking?.unitId || (preselectedRoom as any)?.unitId || null);
  
  const [availableRooms, setAvailableRooms] = useState<Room[]>(preselectedRoom ? [preselectedRoom] : []);
  const [room, setRoom] = useState<Room | null>(preselectedRoom ?? null);

  // ── Stay Parameters ──
  const [checkIn, setCheckIn] = useState<string>(booking?.checkIn ?? initialCheckIn ?? '');
  const [checkOut, setCheckOut] = useState<string>(booking?.checkOut ?? initialCheckOut ?? '');
  const [adults, setAdults] = useState<number>(booking?.adults ?? 1);
  const [children, setChildren] = useState<number>(booking?.children ?? 0);
  const [currency, setCurrency] = useState<string>(booking?.currency ?? 'INR');
  const [totalPrice, setTotalPrice] = useState<number>(booking?.totalPrice ?? 0);
  const [paidAmount, setPaidAmount] = useState<number>(booking?.paidAmount ?? 0);
  const [specialRequests, setSpecialRequests] = useState<string>(booking?.specialRequests ?? '');
  const [status, setStatus] = useState<string>(booking?.status ?? 'PENDING');

  // ── Guest State ──
  const defaultGuestName = initialGuest ? `${initialGuest.firstName} ${initialGuest.lastName}` : '';
  const [guestQuery, setGuestQuery] = useState<string>(booking?.guestName ?? defaultGuestName);
  const [guestResults, setGuestResults] = useState<GuestSearchResult[]>(initialGuest ? [initialGuest] : []);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(booking?.guestId ?? initialGuest?.id ?? null);

  const [creatingGuest, setCreatingGuest] = useState<boolean>(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState<string>('');
  const [newGuestLastName, setNewGuestLastName] = useState<string>('');
  const [newGuestEmail, setNewGuestEmail] = useState<string>('');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');
  const [newGuestDocId, setNewGuestDocId] = useState<string>('');

  // ── UI State ──
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  /* ═══════════════════════════════════════════════════════════ */
  /* Cascading Data Effects                                      */
  /* ═══════════════════════════════════════════════════════════ */

  // 1. Fetch Properties
  useEffect(() => {
    propertyApi.getAll().then(props => setProperties(props || [])).catch(() => {});
  }, []);

  // 2. Fetch Units (Triggered when Property changes)
  useEffect(() => {
    if (!selectedPropertyId) { setUnits([]); return; }
    propertyApi.getUnits(selectedPropertyId).then(fetched => setUnits(fetched || [])).catch(() => setUnits([]));
  }, [selectedPropertyId]);

  // 3. Auto-discover Unit from Preselected Room 
  // (Fixes the issue where preselected room has unitName but no direct unitId)
  useEffect(() => {
    if (units.length > 0 && preselectedRoom && !selectedUnitId) {
      const r = preselectedRoom as any;
      if (r.unitId) {
        setSelectedUnitId(r.unitId);
      } else if (r.unitName) {
        const match = units.find(u => u.name === r.unitName);
        if (match) setSelectedUnitId(match.id);
      }
    }
  }, [units, preselectedRoom, selectedUnitId]);

  // 4. Fetch Rooms & Check Availability (Unified to prevent race conditions)
  useEffect(() => {
    // Strict block: Do nothing until Unit is explicitly resolved
    if (!selectedPropertyId || !selectedUnitId) { 
      setAvailableRooms(preselectedRoom ? [preselectedRoom] : []);
      setAvailabilityMessage(null);
      return; 
    }

    let mounted = true;

    const fetchRoomsAndAvailability = async () => {
      try {
        const hasDates = checkIn && checkOut && new Date(checkOut) > new Date(checkIn);
        
        // If we have dates, check availability first
        if (!isEditMode && hasDates) {
          setCheckingAvailability(true);
          
          // Parallel fetch: Get all rooms in unit + get availability constraints
          const [allRoomsInUnit, availableList] = await Promise.all([
            roomApi.getByUnit(selectedPropertyId, selectedUnitId),
            availabilityApi.searchAvailableRoomsByUnit(selectedUnitId, checkIn, checkOut)
          ]);
          
          if (!mounted) return;

          const availIds = new Set(availableList.map((r: any) => r.roomId));
          const filtered = allRoomsInUnit.filter(r => availIds.has(getRoomId(r)!));
          
          setAvailableRooms(filtered);
          
          if (filtered.length === 0) setAvailabilityMessage({ type: 'error', text: '⚠️ No rooms available for selected dates' });
          else setAvailabilityMessage({ type: 'success', text: `✓ ${filtered.length} room(s) available` });

          // Re-snap to the preselected room if it survived the availability filter
          setRoom(prev => {
            if (prev && availIds.has(getRoomId(prev)!)) return prev;
            if (preselectedRoom && availIds.has(getRoomId(preselectedRoom)!)) {
              return filtered.find(r => getRoomId(r) === getRoomId(preselectedRoom)) || null;
            }
            return null;
          });
          
          setCheckingAvailability(false);
        } else {
          // No dates selected yet, just load the raw inventory for the Unit
          setAvailabilityMessage(null);
          const allRoomsInUnit = await roomApi.getByUnit(selectedPropertyId, selectedUnitId);
          if (!mounted) return;
          
          setAvailableRooms(allRoomsInUnit);
          
          if (isEditMode && booking?.roomNumber) {
            const match = allRoomsInUnit.find(r => r.number === booking.roomNumber);
            if (match) setRoom(match);
          } else if (preselectedRoom) {
            const match = allRoomsInUnit.find(r => getRoomId(r) === getRoomId(preselectedRoom));
            if (match) setRoom(match);
          }
        }
      } catch (err) {
        if (!mounted) return;
        setAvailableRooms([]);
        setCheckingAvailability(false);
      }
    };

    fetchRoomsAndAvailability();

    return () => { mounted = false; };
  }, [selectedPropertyId, selectedUnitId, checkIn, checkOut, isEditMode, booking, preselectedRoom]);

  // Guest Search Effect
  useEffect(() => {
    if (isEditMode || !guestQuery || guestQuery.length < 2) return;
    let mounted = true;
    guestApi.search(guestQuery).then(raw => {
      if (!mounted) return;
      const normalized = (raw || []).map((g: any) => ({
        id: String(g.id ?? g.uuid ?? g.guestId ?? g._id),
        firstName: String(g.firstName ?? g.first_name ?? g.fname ?? ''),
        lastName: String(g.lastName ?? g.last_name ?? g.lname ?? ''),
        email: g.email,
        phone: g.phone
      })).filter((g: any) => g.id !== 'undefined');
      setGuestResults(normalized);
    }).catch(() => setGuestResults([]));
    return () => { mounted = false; };
  }, [guestQuery, isEditMode]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Submission                                                  */
  /* ═══════════════════════════════════════════════════════════ */

  const createGuestThenSelect = async (): Promise<string> => {
    setLoading(true); setError(null);
    try {
      const payload = { firstName: newGuestFirstName, lastName: newGuestLastName, email: newGuestEmail, phone: newGuestPhone, docId: newGuestDocId };
      const created = await guestApi.create(payload) as any;
      const idStr = String(created.id ?? created.uuid ?? created.guestId ?? created._id);
      
      setSelectedGuestId(idStr);
      setGuestResults([{ id: idStr, firstName: newGuestFirstName, lastName: newGuestLastName, email: newGuestEmail, phone: newGuestPhone }]);
      setCreatingGuest(false);
      return idStr;
    } catch (err: any) {
      setError(err.message || 'Failed to create guest');
      throw err;
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (creatingGuest && !isEditMode) await createGuestThenSelect();

      // Strict Hierarchy Validations
      if (!selectedPropertyId) throw new Error('Property is required.');
      if (!selectedUnitId) throw new Error('Unit is required.');
      if (!selectedGuestId && !creatingGuest) throw new Error('Please select or create a guest.');
      if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) throw new Error('Valid dates required.');

      const payload: BookingCreationDto = {
        roomId: getRoomId(room) ?? undefined,
        guestId: selectedGuestId!,
        unitId: selectedUnitId, // Now strictly passed
        status: status as any,
        checkIn, checkOut, adults, children, currency, totalPrice, paidAmount, specialRequests
      };

      const result = (isEditMode && booking?.id) 
        ? await bookingApi.partialUpdate(selectedPropertyId, booking.id, payload)
        : await bookingApi.create(selectedPropertyId, payload);

      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} booking`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Location & Room (Strict Cascade) ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
        <h4 className="text-sm font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">Location & Room</h4>
        
        {!propPropertyId && (
          <label>
            <span className={labelCls}>Property *</span>
            <select className={inputCls} value={selectedPropertyId ?? ''} disabled={isEditMode}
              onChange={e => { setSelectedPropertyId(e.target.value || null); setSelectedUnitId(null); setRoom(null); }}>
              <option value="">-- Select property --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Unit *</span>
            <select className={inputCls} value={selectedUnitId ?? ''} disabled={!selectedPropertyId || isEditMode} required
              onChange={e => { setSelectedUnitId(e.target.value || null); setRoom(null); }}>
              <option value="">-- Select unit --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>

          <div>
            <label>
              <span className={labelCls}>Room (Optional)</span>
              <select className={inputCls} value={getRoomId(room) ?? ''} disabled={!selectedUnitId}
                onChange={e => setRoom(availableRooms.find(r => getRoomId(r) === e.target.value) ?? null)}>
                <option value="">No room / Floating inventory</option>
                {availableRooms.map(r => <option key={getRoomId(r)} value={getRoomId(r)!}>{r.number} {r.type ? `- ${r.type}` : ''}</option>)}
              </select>
            </label>
            {availabilityMessage && !isEditMode && selectedUnitId && (
              <p className={cn("mt-2 text-xs font-semibold px-2 py-1 rounded-md inline-block", 
                availabilityMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                {availabilityMessage.text}
              </p>
            )}
            {checkingAvailability && (
              <p className="mt-2 text-xs font-semibold text-slate-500 animate-pulse">Checking live availability...</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Guest Info ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h4 className="text-sm font-bold tracking-tight text-slate-900">Guest Details</h4>
          {!isEditMode && !creatingGuest && (
            <button type="button" onClick={() => setCreatingGuest(true)} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              + New Guest
            </button>
          )}
        </div>

        {isEditMode ? (
          <label>
            <span className={labelCls}>Guest</span>
            <input className={inputCls} readOnly value={guestQuery} />
          </label>
        ) : creatingGuest ? (
          <div className="space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelCls}>First Name *</span><input className={inputCls} value={newGuestFirstName} onChange={e => setNewGuestFirstName(e.target.value)} /></label>
              <label><span className={labelCls}>Last Name *</span><input className={inputCls} value={newGuestLastName} onChange={e => setNewGuestLastName(e.target.value)} /></label>
            </div>
            <label><span className={labelCls}>Email</span><input className={inputCls} value={newGuestEmail} onChange={e => setNewGuestEmail(e.target.value)} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={labelCls}>Phone</span><input className={inputCls} value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} /></label>
              <label><span className={labelCls}>Doc ID</span><input className={inputCls} value={newGuestDocId} onChange={e => setNewGuestDocId(e.target.value)} /></label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreatingGuest(false)} className={btnSecondary}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <label>
              <span className={labelCls}>Search Existing Guest</span>
              <input className={inputCls} placeholder="Type name or phone..." value={guestQuery} 
                onChange={e => { setGuestQuery(e.target.value); setSelectedGuestId(null); }} />
            </label>
            {guestResults.length > 0 && !selectedGuestId && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {guestResults.map(g => (
                  <button key={g.id} type="button" onClick={() => { setSelectedGuestId(g.id); setGuestQuery(`${g.firstName} ${g.lastName}`); setGuestResults([]); }}
                    className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <span className="font-semibold text-slate-900">{g.firstName} {g.lastName}</span>
                    <span className="text-xs text-slate-500">{g.email ?? g.phone ?? 'No contact info'}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedGuestId && <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">✓ Guest Attached</span>}
          </div>
        )}
      </div>

      {/* ── Booking Specifics ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-2">Stay Parameters</h4>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelCls}>Check-in *</span><input type="date" className={inputCls} value={checkIn} onChange={e => setCheckIn(e.target.value)} /></label>
          <label><span className={labelCls}>Check-out *</span><input type="date" className={inputCls} value={checkOut} onChange={e => setCheckOut(e.target.value)} /></label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label><span className={labelCls}>Adults</span><input type="number" min={1} className={inputCls} value={adults} onChange={e => setAdults(Number(e.target.value) || 1)} /></label>
          <label><span className={labelCls}>Children</span><input type="number" min={0} className={inputCls} value={children} onChange={e => setChildren(Number(e.target.value) || 0)} /></label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Status</span>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label><span className={labelCls}>Currency</span><input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} /></label>
          <label><span className={labelCls}>Total Price</span><input type="number" min={0} className={inputCls} value={totalPrice} onChange={e => setTotalPrice(Number(e.target.value) || 0)} /></label>
          <label><span className={labelCls}>Amount Paid</span><input type="number" min={0} className={inputCls} value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value) || 0)} /></label>
        </div>

        <label>
          <span className={labelCls}>Notes / Special Requests</span>
          <textarea className={inputCls} rows={3} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} />
        </label>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button type="button" className={btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Processing...' : isEditMode ? 'Save Changes' : 'Confirm Booking'}
        </button>
      </div>
    </form>
  );
}