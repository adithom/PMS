import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Users, Building2 } from 'lucide-react';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingCreationDto, GroupRoomRequestDto } from '../../api/reservationApi';
import guestApi from '../../api/guestApi';
import unitApi from '../../api/unitApi';
import roomApi from '../../api/roomApi';
import travelAgentApi from '../../api/travelAgentApi';
import type { Room, MealPlanType, TravelAgent } from '../../types';
import { BOOKING_SOURCE_OPTIONS } from '../../types';
import { fmtDate } from '../../utils/dateHelpers';
import ModalShell from '../ModalShell';

interface GroupBookingModalProps {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UnitBlock {
  unitId: string;
  roomCount: number;
  adults: number;
  children: number;
  nightlyRate: number;
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500';
const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500';

export default function GroupBookingModal({ propertyId, onClose, onSuccess }: GroupBookingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Reference data ──
  const [units, setUnits] = useState<any[]>([]);
  const [roomsByUnit, setRoomsByUnit] = useState<Record<string, Room[]>>({});

  // ── Step 1: Group Details ──
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<any[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [selectedGuestName, setSelectedGuestName] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [groupReference, setGroupReference] = useState('');
  const [billingMode, setBillingMode] = useState<'SEPARATE' | 'CONSOLIDATED'>('SEPARATE');

  // ── Step 2: Rooms & Pricing ──
  const [unitBlocks, setUnitBlocks] = useState<UnitBlock[]>([
    { unitId: '', roomCount: 1, adults: 1, children: 0, nightlyRate: 0 }
  ]);

  // Meal plan
  const [mealPlanOpen, setMealPlanOpen] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlanType | null>(null);

  // Optional sections
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [agentQuery, setAgentQuery] = useState('');
  const [agentResults, setAgentResults] = useState<TravelAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedAgentName, setSelectedAgentName] = useState('');
  const [bookingSource, setBookingSource] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('CASH');

  /* ────────────────── Load initial data ────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        setInitLoading(true);
        const unitsData = await unitApi.getByProperty(propertyId);
        const fetchedUnits = Array.isArray(unitsData) ? unitsData : (unitsData as any).content ?? [];
        setUnits(fetchedUnits);

        // Pre-fetch base rates per unit
        const roomsResults = await Promise.all(
          fetchedUnits.map((u: any) => roomApi.getByUnit(propertyId, u.id).catch(() => []))
        );
        const byUnit: Record<string, Room[]> = {};
        fetchedUnits.forEach((u: any, i: number) => {
          byUnit[u.id] = Array.isArray(roomsResults[i]) ? roomsResults[i] : [];
        });
        setRoomsByUnit(byUnit);
      } catch {
        setError('Failed to load property data. Please close and try again.');
      } finally {
        setInitLoading(false);
      }
    };
    load();
  }, [propertyId]);

  /* ────────────────── Guest search ────────────────── */
  useEffect(() => {
    if (creatingGuest || !guestQuery || guestQuery.length < 2 || selectedGuestId) return;
    let live = true;
    guestApi.search(guestQuery).then(raw => {
      if (!live) return;
      setGuestResults((raw || []).map((g: any) => ({
        id: String(g.id ?? g.uuid ?? ''),
        firstName: g.firstName ?? '',
        lastName: g.lastName ?? '',
        email: g.email,
        phone: g.phone,
      })).filter((g: any) => g.id));
    }).catch(() => setGuestResults([]));
    return () => { live = false; };
  }, [guestQuery, creatingGuest, selectedGuestId]);

  /* ────────────────── Agent search ────────────────── */
  useEffect(() => {
    if (!agentQuery || agentQuery.length < 2 || selectedAgentId) return;
    let live = true;
    travelAgentApi.search(agentQuery).then(raw => {
      if (!live) return;
      setAgentResults(raw || []);
    }).catch(() => setAgentResults([]));
    return () => { live = false; };
  }, [agentQuery, selectedAgentId]);


  /* ────────────────── Unit block helpers ────────────────── */
  const updateBlock = (i: number, patch: Partial<UnitBlock>) => {
    setUnitBlocks(prev => {
      const next = [...prev];
      const updated = { ...next[i], ...patch };
      // Auto-fill rate when unit changes
      if (patch.unitId) {
        const baseRate = roomsByUnit[patch.unitId]?.[0]?.baseRate ?? 0;
        updated.nightlyRate = baseRate;
      }
      next[i] = updated;
      return next;
    });
    setError('');
  };

  const addBlock = () => setUnitBlocks(prev => [...prev, { unitId: '', roomCount: 1, adults: 1, children: 0, nightlyRate: 0 }]);
  const removeBlock = (i: number) => setUnitBlocks(prev => prev.filter((_, idx) => idx !== i));

  /* ────────────────── Inline guest create ────────────────── */
  const saveNewGuest = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) { setError('First and last name are required.'); return; }
    setLoading(true); setError('');
    try {
      const created = await guestApi.create({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        ...(newEmail && { email: newEmail.trim() }),
        ...(newPhone && { phone: newPhone.trim() }),
      }) as any;
      const id = String(created.id ?? created.uuid ?? '');
      setSelectedGuestId(id);
      setSelectedGuestName(`${newFirstName.trim()} ${newLastName.trim()}`);
      setGuestQuery(`${newFirstName.trim()} ${newLastName.trim()}`);
      setCreatingGuest(false);
      setGuestResults([]);
    } catch (err: any) {
      setError(err.message || 'Failed to create guest.');
    } finally { setLoading(false); }
  };

  /* ────────────────── Validation ────────────────── */
  const validateStep1 = (): boolean => {
    if (!selectedGuestId) { setError('Please select or create the organizer guest.'); return false; }
    if (!checkIn || !checkOut) { setError('Check-in and check-out dates are required.'); return false; }
    const today = new Date().toISOString().split('T')[0];
    if (checkIn < today) { setError('Check-in date cannot be in the past.'); return false; }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return false; }
    return true;
  };

  const validateStep2 = (): boolean => {
    if (unitBlocks.some(b => !b.unitId)) { setError('Please select a unit type for every row.'); return false; }
    if (unitBlocks.some(b => b.roomCount < 1)) { setError('Each unit row must have at least 1 room.'); return false; }
    if (mealPlanOpen && !selectedMealPlan) { setError('Please choose a meal plan type.'); return false; }
    return true;
  };

  const handleNext = () => {
    const ok = step === 1 ? validateStep1() : validateStep2();
    if (!ok) return;
    setError('');
    setStep(prev => (prev + 1) as 1 | 2 | 3);
  };

  /* ────────────────── Derived totals ────────────────── */
  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    : 0;

  const totalRooms = unitBlocks.reduce((s, b) => s + b.roomCount, 0);

  const grandTotal = unitBlocks.reduce((sum, b) => {
    return sum + b.roomCount * b.nightlyRate * nights;
  }, 0);

  /* ────────────────── Submit ────────────────── */
  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const roomRequests: GroupRoomRequestDto[] = unitBlocks.flatMap(b =>
        Array.from({ length: b.roomCount }, () => ({
          unitId: b.unitId,
          adults: b.adults,
          children: b.children,
          nightlyRate: b.nightlyRate,
        }))
      );

      const payload: GroupBookingCreationDto = {
        organizerGuestId: selectedGuestId,
        checkIn,
        checkOut,
        roomRequests,
        groupReference: groupReference || undefined,
        billingMode,
        ...(selectedAgentId ? { travelAgentId: selectedAgentId } : {}),
        ...(mealPlanOpen && selectedMealPlan ? {
          mealPlanType: selectedMealPlan,
          mealPlanPricePerNight: 0,
          mealPlanChildrenPricePerNight: 0,
        } : {}),
        ...(bookingSource ? { bookingSource } : {}),
        ...(advanceAmount && Number(advanceAmount) > 0 ? {
          advancePaymentAmount: Number(advanceAmount),
          advancePaymentMethod: advanceMethod,
        } : {}),
      };

      await reservationApi.createReservation(propertyId, payload);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create reservation.');
      setLoading(false);
    }
  };

  /* ────────────────── Render ────────────────── */
  const STEPS = ['Group Details', 'Rooms & Pricing', 'Review & Confirm'];

  return (
    <ModalShell title="New Group Reservation" size="wide" onClose={onClose}>
      <div className="flex h-[680px] flex-col">

        {/* Progress */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 shrink-0">
          <div className="flex items-center">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const active = step === n, past = step > n;
              return (
                <div key={label} className="flex flex-1 items-center">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-indigo-600 text-white' : past ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                    {past ? '✓' : n}
                  </div>
                  <span className={`ml-2 text-xs font-bold uppercase tracking-widest ${active ? 'text-indigo-900' : past ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
                  {n < 3 && <div className="mx-3 h-px flex-1 bg-slate-200" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/40 p-6">
          {initLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400 gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-600" />
              Loading...
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              {/* ══ STEP 1 ══ */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Organizer guest */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Organizer Guest</h4>
                      {!creatingGuest && !selectedGuestId && (
                        <button type="button" onClick={() => { setCreatingGuest(true); setGuestQuery(''); setGuestResults([]); }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800">+ New Guest</button>
                      )}
                      {selectedGuestId && (
                        <button type="button" onClick={() => { setSelectedGuestId(''); setSelectedGuestName(''); setGuestQuery(''); }}
                          className="text-xs font-medium text-slate-400 hover:text-rose-500">Change</button>
                      )}
                    </div>

                    {selectedGuestId ? (
                      <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                        <Users className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span className="text-sm font-semibold text-indigo-800">{selectedGuestName}</span>
                        <span className="ml-auto text-xs text-indigo-500">Organizer</span>
                      </div>
                    ) : creatingGuest ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className={labelCls}>First Name *</label><input className={inputCls} value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First name" /></div>
                          <div><label className={labelCls}>Last Name *</label><input className={inputCls} value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last name" /></div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
                          <div><label className={labelCls}>Phone</label><input className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="button" onClick={() => { setCreatingGuest(false); setNewFirstName(''); setNewLastName(''); setNewEmail(''); setNewPhone(''); }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                          <button type="button" onClick={saveNewGuest} disabled={loading || !newFirstName || !newLastName}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save Guest'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <label className={labelCls}>Search Existing Guest</label>
                        <input className={inputCls} placeholder="Type name or phone…" value={guestQuery}
                          onChange={e => { setGuestQuery(e.target.value); setSelectedGuestId(''); }} />
                        {guestResults.length > 0 && !selectedGuestId && (
                          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                            {guestResults.map(g => (
                              <button key={g.id} type="button"
                                onClick={() => { setSelectedGuestId(g.id); setSelectedGuestName(`${g.firstName} ${g.lastName}`); setGuestQuery(`${g.firstName} ${g.lastName}`); setGuestResults([]); }}
                                className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                <span className="font-semibold text-slate-900 text-sm">{g.firstName} {g.lastName}</span>
                                <span className="text-xs text-slate-400">{g.email ?? g.phone ?? 'No contact info'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Stay Dates</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className={labelCls}>Check-In *</label>
                        <input type="date" className={inputCls} value={checkIn} min={new Date().toISOString().split('T')[0]}
                          onChange={e => setCheckIn(e.target.value)} /></div>
                      <div><label className={labelCls}>Check-Out *</label>
                        <input type="date" className={inputCls} value={checkOut} min={checkIn || new Date().toISOString().split('T')[0]}
                          onChange={e => setCheckOut(e.target.value)} /></div>
                    </div>
                    {nights > 0 && (
                      <p className="mt-2 text-xs text-slate-400">{nights} night{nights !== 1 ? 's' : ''}</p>
                    )}
                  </div>

                  {/* Reference & Billing */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Reservation Settings</h4>
                    <div>
                      <label className={labelCls}>Group / Block Name <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                      <input className={inputCls} placeholder="e.g. Sharma Wedding Party" value={groupReference}
                        onChange={e => setGroupReference(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Master Billing</label>
                      <div className="grid gap-3 sm:grid-cols-2 mt-1">
                        {(['SEPARATE', 'CONSOLIDATED'] as const).map(mode => (
                          <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${billingMode === mode ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                            <input type="radio" name="billingMode" checked={billingMode === mode} onChange={() => setBillingMode(mode)} className="mt-0.5 h-4 w-4 text-indigo-600" />
                            <div>
                              <p className="text-sm font-bold text-slate-900">{mode === 'SEPARATE' ? 'Separate' : 'Consolidated'}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {mode === 'SEPARATE' ? 'Each room settles its own folio.' : "All charges route to the organizer's master folio."}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ STEP 2 ══ */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Unit blocks table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">Room Allocation</h4>
                      <button type="button" onClick={addBlock}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800">+ Add Unit Type</button>
                    </div>

                    {unitBlocks.map((block, i) => (
                      <div key={i} className="relative rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                        {unitBlocks.length > 1 && (
                          <div className="flex justify-end">
                            <button type="button" onClick={() => removeBlock(i)}
                              className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-5">
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Unit Type *</label>
                            <select className={inputCls} value={block.unitId}
                              onChange={e => updateBlock(i, { unitId: e.target.value })}>
                              <option value="" disabled>Select…</option>
                              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}># Rooms</label>
                            <input type="number" min={1} className={inputCls}
                              value={block.roomCount === 0 ? '' : block.roomCount}
                              onChange={e => updateBlock(i, { roomCount: parseInt(e.target.value) || 0 })}
                              onBlur={e => { if (!e.target.value || Number(e.target.value) < 1) updateBlock(i, { roomCount: 1 }); }} />
                          </div>
                          <div>
                            <label className={labelCls}>Adults/room</label>
                            <input type="number" min={1} className={inputCls}
                              value={block.adults === 0 ? '' : block.adults}
                              onChange={e => updateBlock(i, { adults: parseInt(e.target.value) || 0 })}
                              onBlur={e => { if (!e.target.value || Number(e.target.value) < 1) updateBlock(i, { adults: 1 }); }} />
                          </div>
                          <div>
                            <label className={labelCls}>Children/room</label>
                            <input type="number" min={0} className={inputCls}
                              value={block.children === 0 ? '' : block.children}
                              onChange={e => updateBlock(i, { children: parseInt(e.target.value) || 0 })}
                              onBlur={e => { if (!e.target.value) updateBlock(i, { children: 0 }); }} />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>Nightly Rate (room only)</label>
                            <input type="number" min={0} step={0.01} className={inputCls}
                              value={block.nightlyRate === 0 ? '' : block.nightlyRate}
                              onChange={e => updateBlock(i, { nightlyRate: parseFloat(e.target.value) || 0 })}
                              onBlur={e => { if (!e.target.value) updateBlock(i, { nightlyRate: 0 }); }} />
                            {block.unitId && roomsByUnit[block.unitId]?.[0] && (
                              <p className="mt-1 text-[10px] text-slate-400">
                                Base rate: ₹{roomsByUnit[block.unitId][0].baseRate.toLocaleString()}/night
                              </p>
                            )}
                          </div>
                          {nights > 0 && block.nightlyRate > 0 && (
                            <div className="flex items-end">
                              <p className="text-xs text-slate-500 pb-2">
                                {block.roomCount} room{block.roomCount !== 1 ? 's' : ''} × ₹{block.nightlyRate.toLocaleString()} × {nights}n
                                {' '}= <strong>₹{(block.roomCount * block.nightlyRate * nights).toLocaleString()}</strong>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {totalRooms > 0 && nights > 0 && (
                      <div className="flex justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 text-sm">
                        <span className="text-slate-600">{totalRooms} room{totalRooms !== 1 ? 's' : ''} · {nights} night{nights !== 1 ? 's' : ''}</span>
                        <span className="font-bold text-indigo-800">₹{grandTotal.toLocaleString()} total</span>
                      </div>
                    )}
                  </div>

                  {/* Meal plan */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Meal Plan</h4>
                        {!mealPlanOpen && <p className="text-xs text-slate-400 mt-0.5">Optional — applied to all rooms</p>}
                      </div>
                      {!mealPlanOpen ? (
                        <button type="button" onClick={() => setMealPlanOpen(true)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800">+ Add</button>
                      ) : (
                        <button type="button" onClick={() => { setMealPlanOpen(false); setSelectedMealPlan(null); }}
                          className="text-xs font-medium text-slate-400 hover:text-rose-500">Remove</button>
                      )}
                    </div>

                    {mealPlanOpen && (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {(['CP', 'MAP', 'AP'] as MealPlanType[]).map(type => {
                            const label = type === 'CP' ? 'Continental (CP)' : type === 'MAP' ? 'Half Board (MAP)' : 'Full Board (AP)';
                            return (
                              <label key={type}
                                className={`flex cursor-pointer flex-col gap-1 rounded-lg border-2 p-3 transition-all ${selectedMealPlan === type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                <div className="flex items-center gap-2">
                                  <input type="radio" name="mealPlanType" value={type}
                                    checked={selectedMealPlan === type}
                                    onChange={() => setSelectedMealPlan(type)}
                                    className="h-4 w-4 text-indigo-600" />
                                  <span className="text-sm font-bold text-slate-800">{label}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Advanced optional section */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button type="button"
                      onClick={() => setAdvancedOpen(v => !v)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                      <span>Optional: Travel Agent · Booking Source · Advance Payment</span>
                      {advancedOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>

                    {advancedOpen && (
                      <div className="border-t border-slate-100 p-5 space-y-5">
                        {/* Travel agent */}
                        <div>
                          <label className={labelCls}>Travel Agent</label>
                          {selectedAgentId ? (
                            <div className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                              <span className="text-sm font-semibold text-indigo-800">✓ {selectedAgentName}</span>
                              <button type="button" onClick={() => { setSelectedAgentId(''); setSelectedAgentName(''); setAgentQuery(''); setAgentResults([]); }}
                                className="text-xs text-slate-400 hover:text-rose-500 font-medium">Change</button>
                            </div>
                          ) : (
                            <div className="relative">
                              <input className={inputCls} placeholder="Type agency name…" value={agentQuery}
                                onChange={e => { setAgentQuery(e.target.value); setSelectedAgentId(''); }} />
                              {agentResults.length > 0 && (
                                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                                  {agentResults.map(a => (
                                    <button key={a.id} type="button"
                                      onClick={() => { setSelectedAgentId(a.id); setSelectedAgentName(a.name); setAgentQuery(a.name); setAgentResults([]); }}
                                      className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                      <span className="font-semibold text-slate-900 text-sm">{a.name}</span>
                                      <span className="text-xs text-slate-400">{[a.gstin, a.email].filter(Boolean).join(' · ') || 'No details'}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Booking source */}
                        <div>
                          <label className={labelCls}>Booking Source</label>
                          <input list="grp-source-opts" className={inputCls} placeholder="e.g. Direct / Walk-In"
                            value={bookingSource} onChange={e => setBookingSource(e.target.value)} />
                          <datalist id="grp-source-opts">
                            {BOOKING_SOURCE_OPTIONS.map(o => <option key={o} value={o} />)}
                          </datalist>
                        </div>

                        {/* Advance payment */}
                        <div>
                          <label className={labelCls}>Advance Payment <span className="normal-case font-normal text-slate-400">(applied to organizer's folio)</span></label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input type="number" min={0} className={inputCls} placeholder="Amount (₹)"
                              value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
                            <select className={inputCls} value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value)}
                              disabled={!advanceAmount || Number(advanceAmount) <= 0}>
                              <option value="CASH">Cash</option>
                              <option value="CREDIT_CARD">Credit Card</option>
                              <option value="DEBIT_CARD">Debit Card</option>
                              <option value="UPI">UPI</option>
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                              <option value="CHEQUE">Cheque</option>
                              <option value="DIGITAL_WALLET">Digital Wallet</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 3: REVIEW ══ */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center pt-2 pb-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mb-4">
                      <Building2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900">Ready to create this reservation?</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {totalRooms} room{totalRooms !== 1 ? 's' : ''} · {nights} night{nights !== 1 ? 's' : ''} · {fmtDate(checkIn)} → {fmtDate(checkOut)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 text-sm">
                    <Row label="Organizer" value={selectedGuestName} />
                    {groupReference && <Row label="Block Name" value={groupReference} />}
                    <Row label="Billing" value={billingMode === 'CONSOLIDATED' ? 'Consolidated (master folio)' : 'Separate (per room)'} />
                    {selectedAgentName && <Row label="Travel Agent" value={selectedAgentName} />}
                    {bookingSource && <Row label="Source" value={bookingSource} />}
                    {mealPlanOpen && selectedMealPlan && (
                      <Row label="Meal Plan" value={selectedMealPlan === 'CP' ? 'Continental (CP)' : selectedMealPlan === 'MAP' ? 'Half Board (MAP)' : 'Full Board (AP)'} />
                    )}
                    {advanceAmount && Number(advanceAmount) > 0 && (
                      <Row label="Advance" value={`₹${Number(advanceAmount).toLocaleString()} via ${advanceMethod.replace('_', ' ')}`} />
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Room Breakdown</h4>
                    {unitBlocks.map((b, i) => {
                      const unit = units.find(u => u.id === b.unitId);
                      const total = b.roomCount * b.nightlyRate * nights;
                      return (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-sm">
                          <span className="text-slate-700">{b.roomCount}× <strong>{unit?.name ?? '—'}</strong></span>
                          <span className="text-slate-500">
                            ₹{b.nightlyRate.toLocaleString()}/night
                            {nights > 0 && <> → <strong className="text-slate-900">₹{total.toLocaleString()}</strong></>}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-3 mt-1 font-bold text-sm">
                      <span className="text-slate-700">Grand Total</span>
                      <span className="text-indigo-700">₹{grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shrink-0">
          <button
            onClick={() => step === 1 ? onClose() : setStep(prev => (prev - 1) as 1 | 2)}
            disabled={loading || initLoading}
            className="rounded-lg px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button onClick={handleNext} disabled={initLoading}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Reservation'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
