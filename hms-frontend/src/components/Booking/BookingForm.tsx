import React, { useEffect, useState } from 'react';
import propertyApi from '../../api/propertyApi';
import guestApi from '../../api/guestApi';
import bookingApi, { type BookingCreationDto } from '../../api/bookingApi';
import travelAgentApi from '../../api/travelAgentApi';
import mealPlanApi from '../../api/mealPlanApi';
import roomApi from '../../api/roomApi';
import availabilityApi from '../../api/availabilityApi';
import { GuestIdType, GUEST_ID_TYPE_LABELS } from '../../types';
import type { Property, Room, UnitDto, Booking, TravelAgent, MealPlan, MealPlanType } from '../../types';

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
  const [nightlyRate, setNightlyRate] = useState<number>(() => {
    if (!booking) return 0;
    const inD = new Date(booking.checkIn), outD = new Date(booking.checkOut);
    const nights = Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24));
    return nights > 0 ? Math.round(booking.totalPrice / nights) : booking.totalPrice;
  });
  const [paidAmount, setPaidAmount] = useState<number>(booking?.paidAmount ?? 0);
  const [specialRequests, setSpecialRequests] = useState<string>(booking?.specialRequests ?? '');
  const [status, setStatus] = useState<string>(booking?.status ?? 'PENDING');
  
  // ---> NEW STATE FOR TWIN BED <---
  const [isTwinBed, setIsTwinBed] = useState<boolean>(booking?.isTwinBed ?? false);
  const [referenceNumber, setReferenceNumber] = useState<string>(booking?.referenceNumber ?? '');

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
  const [newGuestIdNumber, setNewGuestIdNumber] = useState<string>('');
  const [newGuestIdType, setNewGuestIdType] = useState<GuestIdType | ''>('');

  // ── Travel Agent State ──
  const [agentSectionOpen, setAgentSectionOpen] = useState<boolean>(
    !!(booking?.travelAgentId)
  );
  const [agentQuery, setAgentQuery] = useState<string>(booking?.travelAgentName ?? '');
  const [agentResults, setAgentResults] = useState<TravelAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(booking?.travelAgentId ?? null);
  const [selectedAgentName, setSelectedAgentName] = useState<string>(booking?.travelAgentName ?? '');
  const [creatingAgent, setCreatingAgent] = useState<boolean>(false);
  const [newAgentName, setNewAgentName] = useState<string>('');
  const [newAgentContactPerson, setNewAgentContactPerson] = useState<string>('');
  const [newAgentEmail, setNewAgentEmail] = useState<string>('');
  const [newAgentPhone, setNewAgentPhone] = useState<string>('');
  const [newAgentIataCode, setNewAgentIataCode] = useState<string>('');
  const [newAgentCommissionRate, setNewAgentCommissionRate] = useState<string>('');

  // ── Meal Plan State ──
  const [mealPlanOpen, setMealPlanOpen] = useState<boolean>(!!booking?.mealPlanType);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlanType | null>(booking?.mealPlanType ?? null);
  const [mealPlanPrice, setMealPlanPrice] = useState<string>(
    booking?.mealPlanPricePerNight?.toString() ?? ''
  );
  const [mealPlanChildrenPrice, setMealPlanChildrenPrice] = useState<string>(
    booking?.mealPlanChildrenPricePerNight?.toString() ?? ''
  );
  const [propertyMealPlans, setPropertyMealPlans] = useState<MealPlan[]>([]);

  // ── Extra Bed State ──
  const [extraBedOpen, setExtraBedOpen] = useState<boolean>(!!(booking?.extraBeds && booking.extraBeds > 0));
  const [extraBeds, setExtraBeds] = useState<number>(booking?.extraBeds ?? 0);
  const [extraBedRate, setExtraBedRate] = useState<string>(booking?.extraBedRatePerNight?.toString() ?? '');
  const [extraBedChargeCode, setExtraBedChargeCode] = useState<'ROOM_RENT' | 'MISC'>(booking?.extraBedChargeCode ?? 'MISC');

  // ── UI State ──
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  /* ═══════════════════════════════════════════════════════════ */
  /* Cascading Data Effects                                    */
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

  // Pre-fill nightly rate from room's base rate when a room is selected (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (room) setNightlyRate(room.baseRate);
  }, [room, isEditMode]);

  // Auto-fill extra bed rate from property default when section opens (create mode only)
  useEffect(() => {
    if (isEditMode || !extraBedOpen || !selectedPropertyId) return;
    if (extraBedRate) return;
    const prop = properties.find(p => p.id === selectedPropertyId);
    if (prop?.extraBedRatePerNight != null) {
      setExtraBedRate(prop.extraBedRatePerNight.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraBedOpen, selectedPropertyId, properties, isEditMode]);

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

  // Fetch property meal plans when property changes
  useEffect(() => {
    if (!selectedPropertyId) { setPropertyMealPlans([]); return; }
    mealPlanApi.getByProperty(selectedPropertyId)
      .then(plans => setPropertyMealPlans(plans || []))
      .catch(() => setPropertyMealPlans([]));
  }, [selectedPropertyId]);

  // Auto-fill meal plan prices when plan type is selected (only if price not already set)
  useEffect(() => {
    if (!selectedMealPlan) return;
    const plan = propertyMealPlans.find(p => p.mealPlanType === selectedMealPlan);
    if (plan) {
      if (!mealPlanPrice) setMealPlanPrice(plan.pricePerNight.toString());
      if (!mealPlanChildrenPrice) setMealPlanChildrenPrice((plan.childrenPricePerNight ?? 0).toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMealPlan, propertyMealPlans]);

  // Travel Agent Search Effect
  useEffect(() => {
    if (!agentQuery || agentQuery.length < 2 || selectedAgentId) return;
    let mounted = true;
    travelAgentApi.search(agentQuery).then(raw => {
      if (!mounted) return;
      setAgentResults(raw || []);
    }).catch(() => setAgentResults([]));
    return () => { mounted = false; };
  }, [agentQuery, selectedAgentId]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Submission                                                  */
  /* ═══════════════════════════════════════════════════════════ */

  const createGuestThenSelect = async (): Promise<string> => {
    setLoading(true); setError(null);
    try {
      const payload: Parameters<typeof guestApi.create>[0] = {
        firstName: newGuestFirstName,
        lastName: newGuestLastName,
        ...(newGuestEmail && { email: newGuestEmail }),
        ...(newGuestPhone && { phone: newGuestPhone }),
        ...(newGuestIdNumber && { idNumber: newGuestIdNumber }),
        ...(newGuestIdType && { guestIdType: newGuestIdType }),
      };
      const created = await guestApi.create(payload) as any;
      const idStr = String(created.id ?? created.uuid ?? created.guestId ?? created._id);
      
      setSelectedGuestId(idStr);
      // Update the visual search input to show the new guest's name
      setGuestQuery(`${newGuestFirstName} ${newGuestLastName}`);
      // Clear results so the dropdown doesn't pop open
      setGuestResults([]); 
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
      let finalGuestId = selectedGuestId;

      if (creatingGuest && !isEditMode) {
        finalGuestId = await createGuestThenSelect();
      }

      // Strict Hierarchy Validations
      if (!selectedPropertyId) throw new Error('Property is required.');
      if (!selectedUnitId) throw new Error('Unit is required.');
      if (!finalGuestId) throw new Error('Please select or create a guest.');
      const today = new Date().toISOString().split('T')[0];
      if (!checkIn || !checkOut) throw new Error('Check-in and check-out dates are required.');
      if (!isEditMode && new Date(checkIn) < new Date(today)) throw new Error('Check-in date cannot be in the past.');
      if (new Date(checkOut) <= new Date(checkIn)) throw new Error('Valid dates required.');

      // Resolve travel agent for payload
      let travelAgentPayload: Pick<BookingCreationDto, 'travelAgentId' | 'newTravelAgent'> = {};
      if (agentSectionOpen) {
        if (selectedAgentId) {
          travelAgentPayload = { travelAgentId: selectedAgentId };
        } else if (creatingAgent && newAgentName.trim()) {
          travelAgentPayload = {
            newTravelAgent: {
              name: newAgentName.trim(),
              contactPerson: newAgentContactPerson.trim() || undefined,
              email: newAgentEmail.trim() || undefined,
              phone: newAgentPhone.trim() || undefined,
              iataCode: newAgentIataCode.trim() || undefined,
              commissionRate: newAgentCommissionRate ? Number(newAgentCommissionRate) : undefined,
            }
          };
        }
      }

      const inD = new Date(checkIn), outD = new Date(checkOut);
      const nights = checkIn && checkOut && outD > inD
        ? Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const xBedNightly = extraBedOpen && extraBeds > 0 && extraBedRate ? extraBeds * Number(extraBedRate) : 0;
      const adultMealNightly = mealPlanOpen && selectedMealPlan && mealPlanPrice ? adults * Number(mealPlanPrice) : 0;
      const childMealNightly = mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice ? children * Number(mealPlanChildrenPrice) : 0;
      const computedTotalPrice = (nightlyRate + adultMealNightly + childMealNightly + xBedNightly) * nights;

      const mealPlanPayload = mealPlanOpen && selectedMealPlan
        ? {
            mealPlanType: selectedMealPlan,
            mealPlanPricePerNight: mealPlanPrice ? Number(mealPlanPrice) : undefined,
            mealPlanChildrenPricePerNight: mealPlanChildrenPrice ? Number(mealPlanChildrenPrice) : undefined,
          }
        : isEditMode ? { clearMealPlan: true } : {};

      const extraBedPayload = extraBedOpen && extraBeds > 0
        ? {
            extraBeds,
            extraBedRatePerNight: extraBedRate ? Number(extraBedRate) : undefined,
            extraBedChargeCode,
          }
        : { extraBeds: 0, extraBedRatePerNight: undefined, extraBedChargeCode: undefined };

      const payload = {
        roomId: getRoomId(room) ?? undefined,
        guestId: finalGuestId,
        unitId: selectedUnitId,
        status: status as any,
        checkIn, checkOut, adults, children, currency, paidAmount, specialRequests,
        isTwinBed,
        referenceNumber: referenceNumber || undefined,
        ...(isEditMode ? { totalPrice: computedTotalPrice } : { nightlyRate }),
        ...travelAgentPayload,
        ...mealPlanPayload,
        ...extraBedPayload
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
              <select className={inputCls} value={getRoomId(room) ?? ''} disabled={!selectedUnitId || (isEditMode && booking?.status === 'CHECKED_IN')}
                onChange={e => setRoom(availableRooms.find(r => getRoomId(r) === e.target.value) ?? null)}>
                <option value="">No room / Floating inventory</option>
                {availableRooms.map(r => <option key={getRoomId(r)} value={getRoomId(r)!}>{r.number} {r.type ? `- ${r.type}` : ''}</option>)}
              </select>
            </label>
            {isEditMode && booking?.status === 'CHECKED_IN' && (
              <p className="mt-2 text-xs font-semibold px-2 py-1 rounded-md inline-block bg-amber-100 text-amber-800">
                Use "Shift Room" from the chart menu to change rooms for a checked-in guest.
              </p>
            )}
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
              <label><span className={labelCls}>Document ID</span><input className={inputCls} value={newGuestIdNumber} onChange={e => setNewGuestIdNumber(e.target.value)} placeholder="e.g. A1234567" /></label>
            </div>
            <label>
              <span className={labelCls}>ID Type</span>
              <select className={inputCls} value={newGuestIdType} onChange={e => setNewGuestIdType(e.target.value as GuestIdType | '')}>
                <option value="">— Select type —</option>
                {Object.values(GuestIdType).map(t => (
                  <option key={t} value={t}>{GUEST_ID_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreatingGuest(false)} className={btnSecondary}>
                Cancel
              </button>
              <button 
                type="button" 
                onClick={createGuestThenSelect} 
                disabled={loading || !newGuestFirstName || !newGuestLastName} 
                className={btnPrimary}
              >
                {loading ? 'Saving...' : 'Save Guest'}
              </button>
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

      {/* ── Travel Agent ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-sm font-bold tracking-tight text-slate-900">Travel Agent</h4>
            {!agentSectionOpen && <p className="text-xs text-slate-400 mt-0.5">Optional — leave blank if direct booking</p>}
          </div>
          {!agentSectionOpen ? (
            <button type="button" onClick={() => setAgentSectionOpen(true)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              + Add Travel Agent
            </button>
          ) : (
            <button type="button" onClick={() => {
              setAgentSectionOpen(false);
              setSelectedAgentId(null); setSelectedAgentName(''); setAgentQuery('');
              setAgentResults([]); setCreatingAgent(false);
              setNewAgentName(''); setNewAgentContactPerson(''); setNewAgentEmail('');
              setNewAgentPhone(''); setNewAgentIataCode(''); setNewAgentCommissionRate('');
            }} className="text-xs font-medium text-slate-400 hover:text-rose-500">
              Remove
            </button>
          )}
        </div>

        {agentSectionOpen && (
          <>
            {creatingAgent ? (
              <div className="space-y-4 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={labelCls}>Agency Name *</span>
                    <input className={inputCls} value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="e.g. Cox & Kings" /></label>
                  <label><span className={labelCls}>Contact Person</span>
                    <input className={inputCls} value={newAgentContactPerson} onChange={e => setNewAgentContactPerson(e.target.value)} /></label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={labelCls}>Email</span>
                    <input type="email" className={inputCls} value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} /></label>
                  <label><span className={labelCls}>Phone</span>
                    <input className={inputCls} value={newAgentPhone} onChange={e => setNewAgentPhone(e.target.value)} /></label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={labelCls}>IATA Code</span>
                    <input className={inputCls} value={newAgentIataCode} onChange={e => setNewAgentIataCode(e.target.value)} placeholder="e.g. 12345678" /></label>
                  <label><span className={labelCls}>Commission Rate (%)</span>
                    <input type="number" min={0} max={100} step={0.01} className={inputCls}
                      value={newAgentCommissionRate} onChange={e => setNewAgentCommissionRate(e.target.value)} placeholder="e.g. 10" /></label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setCreatingAgent(false)} className={btnSecondary}>Cancel</button>
                  <button type="button" disabled={!newAgentName.trim()}
                    onClick={async () => {
                      setLoading(true); setError(null);
                      try {
                        const created = await travelAgentApi.create({
                          name: newAgentName.trim(),
                          contactPerson: newAgentContactPerson.trim() || undefined,
                          email: newAgentEmail.trim() || undefined,
                          phone: newAgentPhone.trim() || undefined,
                          iataCode: newAgentIataCode.trim() || undefined,
                          commissionRate: newAgentCommissionRate ? Number(newAgentCommissionRate) : undefined,
                        });
                        setSelectedAgentId(created.id);
                        setSelectedAgentName(created.name);
                        setAgentQuery(created.name);
                        setCreatingAgent(false);
                      } catch (err: any) {
                        setError(err.message || 'Failed to create travel agent');
                      } finally { setLoading(false); }
                    }}
                    className={btnPrimary}>
                    {loading ? 'Saving...' : 'Save Agent'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                {!selectedAgentId && (
                  <div className="flex items-center justify-between mb-2">
                    <span className={labelCls} style={{ marginBottom: 0 }}>Search Existing Agent</span>
                    <button type="button" onClick={() => { setCreatingAgent(true); setAgentQuery(''); setAgentResults([]); }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                      + New Agent
                    </button>
                  </div>
                )}
                {selectedAgentId ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      ✓ {selectedAgentName}
                    </span>
                    <button type="button" onClick={() => {
                      setSelectedAgentId(null); setSelectedAgentName(''); setAgentQuery(''); setAgentResults([]);
                    }} className="text-xs text-slate-400 hover:text-rose-500 font-medium">Change</button>
                  </div>
                ) : (
                  <>
                    <input className={inputCls} placeholder="Type agency name or IATA code..." value={agentQuery}
                      onChange={e => { setAgentQuery(e.target.value); setSelectedAgentId(null); }} />
                    {agentResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        {agentResults.map(a => (
                          <button key={a.id} type="button"
                            onClick={() => { setSelectedAgentId(a.id); setSelectedAgentName(a.name); setAgentQuery(a.name); setAgentResults([]); }}
                            className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                            <span className="font-semibold text-slate-900">{a.name}</span>
                            <span className="text-xs text-slate-500">
                              {[a.iataCode, a.email, a.phone].filter(Boolean).join(' · ') || 'No contact info'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Meal Plan ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-sm font-bold tracking-tight text-slate-900">Meal Plan</h4>
            {!mealPlanOpen && <p className="text-xs text-slate-400 mt-0.5">Optional — leave blank for room-only</p>}
          </div>
          {!mealPlanOpen ? (
            <button type="button" onClick={() => setMealPlanOpen(true)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              + Add Meal Plan
            </button>
          ) : (
            <button type="button" onClick={() => {
              setMealPlanOpen(false);
              setSelectedMealPlan(null);
              setMealPlanPrice('');
              setMealPlanChildrenPrice('');
            }} className="text-xs font-medium text-slate-400 hover:text-rose-500">
              Remove
            </button>
          )}
        </div>

        {mealPlanOpen && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(['CP', 'MAP', 'AP'] as MealPlanType[]).map(type => {
                const plan = propertyMealPlans.find(p => p.mealPlanType === type);
                const label = type === 'CP' ? 'Continental (CP)' : type === 'MAP' ? 'Half Board (MAP)' : 'Full Board (AP)';
                return (
                  <label key={type}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-all',
                      selectedMealPlan === type
                        ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-300'
                        : 'border-slate-200 hover:border-slate-300'
                    )}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mealPlanType"
                        value={type}
                        checked={selectedMealPlan === type}
                        onChange={() => {
                          setMealPlanPrice('');
                          setMealPlanChildrenPrice('');
                          setSelectedMealPlan(type);
                        }}
                        className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-semibold text-slate-800">{label}</span>
                    </div>
                    {plan && (
                      <span className="pl-6 text-xs text-slate-400">
                        ₹{plan.pricePerNight.toLocaleString()} adult · ₹{(plan.childrenPricePerNight ?? 0).toLocaleString()} child /person/night
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {selectedMealPlan && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Adult price / person / night <span className="font-normal text-slate-400">(editable)</span></span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputCls}
                    placeholder="Adult price per person"
                    value={mealPlanPrice}
                    onChange={e => setMealPlanPrice(e.target.value)}
                  />
                </label>
                <label>
                  <span className={labelCls}>Child price / person / night <span className="font-normal text-slate-400">(editable)</span></span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className={inputCls}
                    placeholder="Children price per person"
                    value={mealPlanChildrenPrice}
                    onChange={e => setMealPlanChildrenPrice(e.target.value)}
                  />
                </label>
              </div>
            )}
            {selectedMealPlan && (mealPlanPrice || mealPlanChildrenPrice) && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium">Adds to nightly rate: </span>
                {adults} adult{adults !== 1 ? 's' : ''} × {currency} {Number(mealPlanPrice || 0).toLocaleString()} = {currency} {(adults * Number(mealPlanPrice || 0)).toLocaleString()}
                {Number(mealPlanChildrenPrice || 0) > 0 && (
                  <> &nbsp;+&nbsp; {children} child{children !== 1 ? 'ren' : ''} × {currency} {Number(mealPlanChildrenPrice).toLocaleString()} = {currency} {(children * Number(mealPlanChildrenPrice)).toLocaleString()}</>
                )}
                <span className="font-semibold"> = {currency} {(adults * Number(mealPlanPrice || 0) + children * Number(mealPlanChildrenPrice || 0)).toLocaleString()} / night</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Extra Bed ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h4 className="text-sm font-bold tracking-tight text-slate-900">Extra Bed</h4>
            {!extraBedOpen && <p className="text-xs text-slate-400 mt-0.5">Optional — billed nightly by night audit</p>}
          </div>
          {!extraBedOpen ? (
            <button type="button" onClick={() => {
              setExtraBedOpen(true);
              setExtraBeds(1);
              if (!extraBedRate) {
                const prop = properties.find(p => p.id === selectedPropertyId);
                if (prop?.extraBedRatePerNight != null) setExtraBedRate(prop.extraBedRatePerNight.toString());
              }
            }} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
              + Add Extra Bed
            </button>
          ) : (
            <button type="button" onClick={() => {
              setExtraBedOpen(false);
              setExtraBeds(0);
              setExtraBedRate('');
              setExtraBedChargeCode('MISC');
            }} className="text-xs font-medium text-slate-400 hover:text-rose-500">
              Remove
            </button>
          )}
        </div>

        {extraBedOpen && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Number of Extra Beds</span>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={extraBeds || ''}
                  onChange={e => setExtraBeds(e.target.value === '' ? 0 : Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label>
                <span className={labelCls}>
                  Rate / bed / night (₹)
                  {(() => {
                    const prop = properties.find(p => p.id === selectedPropertyId);
                    return prop?.extraBedRatePerNight != null ? (
                      <span className="ml-1 font-normal text-slate-400">
                        — property default: ₹{prop.extraBedRatePerNight.toLocaleString()}
                      </span>
                    ) : null;
                  })()}
                </span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  className={inputCls}
                  placeholder="Enter rate per bed per night"
                  value={extraBedRate}
                  onChange={e => setExtraBedRate(e.target.value)}
                />
              </label>
            </div>

            <div>
              <span className={labelCls}>Bill as</span>
              <div className="flex gap-3 mt-1">
                {(['ROOM_RENT', 'MISC'] as const).map(code => (
                  <label key={code} className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
                    extraBedChargeCode === code
                      ? 'border-emerald-400 bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-300'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  )}>
                    <input
                      type="radio"
                      name="extraBedChargeCode"
                      value={code}
                      checked={extraBedChargeCode === code}
                      onChange={() => setExtraBedChargeCode(code)}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {code === 'ROOM_RENT' ? 'Room Rent' : 'Miscellaneous'}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {extraBedChargeCode === 'ROOM_RENT'
                  ? 'Charge will appear on the room rent bill'
                  : 'Charge will appear on the ancillary / miscellaneous bill'}
              </p>
            </div>

          </div>
        )}
      </div>

      {/* ── Booking Specifics ── */}
      <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h4 className="text-sm font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-2">Stay Parameters</h4>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className={labelCls}>Check-in *</span><input type="date" className={inputCls} value={checkIn} min={isEditMode ? undefined : new Date().toISOString().split('T')[0]} onChange={e => setCheckIn(e.target.value)} /></label>
          <label><span className={labelCls}>Check-out *</span><input type="date" className={inputCls} value={checkOut} min={checkIn || (isEditMode ? undefined : new Date().toISOString().split('T')[0])} onChange={e => setCheckOut(e.target.value)} /></label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label><span className={labelCls}>Adults</span><input type="number" min={1} className={inputCls} value={adults || ''} onChange={e => setAdults(e.target.value === '' ? 0 : Math.max(1, Number(e.target.value)))} /></label>
          <label><span className={labelCls}>Children</span><input type="number" min={0} className={inputCls} value={children || ''} onChange={e => setChildren(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))} /></label>
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
          <div>
            <label>
              <span className={labelCls}>Nightly Rate</span>
              <input
                type="number" min={0} className={inputCls}
                value={(() => {
                  const adultMeal = mealPlanOpen && selectedMealPlan && mealPlanPrice ? Number(mealPlanPrice) : 0;
                  const childMeal = mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice ? Number(mealPlanChildrenPrice) : 0;
                  const xBed = extraBedOpen && extraBeds > 0 && extraBedRate ? extraBeds * Number(extraBedRate) : 0;
                  return (nightlyRate + adults * adultMeal + children * childMeal + xBed) || '';
                })()}
                onChange={e => {
                  const adultMeal = mealPlanOpen && selectedMealPlan && mealPlanPrice ? Number(mealPlanPrice) : 0;
                  const childMeal = mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice ? Number(mealPlanChildrenPrice) : 0;
                  const xBed = extraBedOpen && extraBeds > 0 && extraBedRate ? extraBeds * Number(extraBedRate) : 0;
                  setNightlyRate(Math.max(0, (Number(e.target.value) || 0) - adults * adultMeal - children * childMeal - xBed));
                }}
              />
            </label>
            {(room || (mealPlanOpen && selectedMealPlan && (mealPlanPrice || mealPlanChildrenPrice)) || (extraBedOpen && extraBeds > 0 && extraBedRate)) && (
              <div className="mt-1.5 space-y-0.5">
                {room && (
                  <p className="text-xs text-slate-500">
                    Base rate: {currency} {room.baseRate.toLocaleString()}/night
                  </p>
                )}
                {mealPlanOpen && selectedMealPlan && mealPlanPrice && (
                  <p className="text-xs text-slate-400">
                    + {adults} adult{adults !== 1 ? 's' : ''} × {currency} {Number(mealPlanPrice).toLocaleString()} = {currency} {(adults * Number(mealPlanPrice)).toLocaleString()}
                  </p>
                )}
                {mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice && children > 0 && (
                  <p className="text-xs text-slate-400">
                    + {children} child{children !== 1 ? 'ren' : ''} × {currency} {Number(mealPlanChildrenPrice).toLocaleString()} = {currency} {(children * Number(mealPlanChildrenPrice)).toLocaleString()}
                  </p>
                )}
                {extraBedOpen && extraBeds > 0 && extraBedRate && Number(extraBedRate) > 0 && (
                  <p className="text-xs text-slate-400">
                    + {extraBeds} extra bed{extraBeds !== 1 ? 's' : ''} × {currency} {Number(extraBedRate).toLocaleString()} = {currency} {(extraBeds * Number(extraBedRate)).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label>
              <span className={labelCls}>Total Price</span>
              <input
                type="number"
                className={cn(inputCls, 'bg-slate-50 pointer-events-none select-none')}
                value={(() => {
                  if (!checkIn || !checkOut) return 0;
                  const inD = new Date(checkIn), outD = new Date(checkOut);
                  if (outD <= inD) return 0;
                  const nights = Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24));
                  const adultMeal = mealPlanOpen && selectedMealPlan && mealPlanPrice ? Number(mealPlanPrice) : 0;
                  const childMeal = mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice ? Number(mealPlanChildrenPrice) : 0;
                  const effectiveMeal = adults * adultMeal + children * childMeal;
                  const xBed = extraBedOpen && extraBeds > 0 && extraBedRate ? extraBeds * Number(extraBedRate) : 0;
                  return (nightlyRate + effectiveMeal + xBed) * nights;
                })()}
                readOnly
                tabIndex={-1}
              />
            </label>
            {(() => {
              if (!checkIn || !checkOut) return null;
              const inD = new Date(checkIn), outD = new Date(checkOut);
              if (outD <= inD) return null;
              const nights = Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24));
              const adultMeal = mealPlanOpen && selectedMealPlan && mealPlanPrice ? Number(mealPlanPrice) : 0;
              const childMeal = mealPlanOpen && selectedMealPlan && mealPlanChildrenPrice ? Number(mealPlanChildrenPrice) : 0;
              const effectiveMeal = adults * adultMeal + children * childMeal;
              const xBed = extraBedOpen && extraBeds > 0 && extraBedRate ? extraBeds * Number(extraBedRate) : 0;
              const effectiveNightly = nightlyRate + effectiveMeal + xBed;
              const parts: string[] = [];
              if (effectiveMeal > 0) parts.push(`${selectedMealPlan} ${currency} ${effectiveMeal.toLocaleString()} meal`);
              if (xBed > 0) parts.push(`extra bed ${currency} ${xBed.toLocaleString()}`);
              return (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-xs text-slate-500">
                    {currency} {effectiveNightly.toLocaleString()}/night × {nights} night{nights !== 1 ? 's' : ''} = {currency} {(effectiveNightly * nights).toLocaleString()}
                  </p>
                  {parts.length > 0 && (
                    <p className="text-xs text-slate-400">
                      (base {currency} {nightlyRate.toLocaleString()} + {parts.join(' + ')})
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <label><span className={labelCls}>Amount Paid</span><input type="number" min={0} className={inputCls} value={paidAmount || ''} onChange={e => setPaidAmount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))} /></label>
        </div>

        {/* ---> NEW CHECKBOX FOR TWIN BED <--- */}
        <div className="flex items-center pt-2">
          <input
            id="isTwinBed"
            type="checkbox"
            checked={isTwinBed}
            onChange={(e) => setIsTwinBed(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
          />
          <label htmlFor="isTwinBed" className="ml-2 block text-sm font-medium text-slate-700 cursor-pointer select-none">
            Twin Bedded Room
          </label>
        </div>

        <label>
          <span className={labelCls}>Reference Number <span className="font-normal text-slate-400">(Optional)</span></span>
          <input
            className={inputCls}
            placeholder="e.g. BKG-20250301-1234"
            value={referenceNumber}
            onChange={e => setReferenceNumber(e.target.value)}
          />
        </label>

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
