import { useEffect, useState } from 'react';
import ModalShell from '../ModalShell';
import propertyApi from '../../api/propertyApi';
import roomApi from '../../api/roomApi';
import availabilityApi from '../../api/availabilityApi';
import guestApi from '../../api/guestApi';
import bookingApi from '../../api/bookingApi';
import { fmtDate, diffDays } from '../../utils/dateHelpers';
import type { UnitDto, Room } from '../../types';

interface Props {
  propertyId: string;
  reservationId: string;
  checkIn: string;
  checkOut: string;
  organizerGuestId?: string;
  organizerGuestName?: string;
  status?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500';
const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500';

type GuestHit = { id: string; firstName: string; lastName: string; email?: string; phone?: string };
type GuestMode = 'organizer' | 'search' | 'create';

export default function AddRoomModal({ propertyId, reservationId, checkIn, checkOut, organizerGuestId, organizerGuestName, status = 'CONFIRMED', onClose, onSuccess }: Props) {
  const nights = diffDays(checkIn, checkOut);

  const [units, setUnits] = useState<UnitDto[]>([]);
  const [unitId, setUnitId] = useState('');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [baseRate, setBaseRate] = useState<number>(0);

  // Guest state
  const [guestMode, setGuestMode] = useState<GuestMode>(organizerGuestId ? 'organizer' : 'search');
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<GuestHit[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedGuestName, setSelectedGuestName] = useState('');
  // Inline create
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    propertyApi.getUnits(propertyId).then(u => setUnits(u || [])).catch(() => {});
  }, [propertyId]);

  useEffect(() => {
    if (!unitId) { setRooms([]); setRoomId(''); setBaseRate(0); return; }
    setLoadingRooms(true);
    setRoomId('');
    availabilityApi.searchAvailableRoomsByUnit(unitId, checkIn, checkOut)
      .then((available: any[]) => {
        const ids = new Set(available.map((r: any) => r.roomId ?? r.id));
        return roomApi.getByUnit(propertyId, unitId).then(all => {
          const filtered = (all || []).filter(r => ids.has((r as any).roomId ?? (r as any).id));
          setRooms(filtered);
          if (filtered.length > 0) setBaseRate(filtered[0].baseRate);
        });
      })
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [unitId, propertyId, checkIn, checkOut]);

  useEffect(() => {
    if (!roomId) {
      if (rooms.length > 0) setBaseRate(rooms[0].baseRate);
      return;
    }
    const r = rooms.find(r => ((r as any).roomId ?? (r as any).id) === roomId);
    if (r) setBaseRate(r.baseRate);
  }, [roomId, rooms]);

  useEffect(() => {
    if (guestMode !== 'search' || !guestQuery || guestQuery.length < 2) return;
    let alive = true;
    guestApi.search(guestQuery).then((raw: any[]) => {
      if (!alive) return;
      setGuestResults((raw || []).map((g: any) => ({
        id: String(g.id ?? g.uuid ?? ''),
        firstName: String(g.firstName ?? ''),
        lastName: String(g.lastName ?? ''),
        email: g.email,
        phone: g.phone,
      })).filter(g => g.id));
    }).catch(() => {});
    return () => { alive = false; };
  }, [guestQuery, guestMode]);

  const selectGuest = (g: GuestHit) => {
    setSelectedGuestId(g.id);
    setSelectedGuestName(`${g.firstName} ${g.lastName}`);
    setGuestResults([]);
    setGuestQuery('');
  };

  const createAndSelectGuest = async () => {
    if (!newFirstName.trim() || !newLastName.trim()) return;
    setCreatingGuest(true);
    setError(null);
    try {
      const created = await guestApi.create({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        ...(newPhone && { phone: newPhone.trim() }),
        ...(newEmail && { email: newEmail.trim() }),
      }) as any;
      const id = String(created.id ?? created.uuid ?? '');
      setSelectedGuestId(id);
      setSelectedGuestName(`${newFirstName.trim()} ${newLastName.trim()}`);
      setGuestMode('search'); // show the confirmed chip via search mode
    } catch (e: any) {
      setError(e?.message || 'Failed to create guest');
    } finally {
      setCreatingGuest(false);
    }
  };

  const effectiveGuestId = guestMode === 'organizer' ? organizerGuestId : selectedGuestId;
  const canSubmit = !!unitId && !!effectiveGuestId && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      await bookingApi.create(propertyId, {
        guestId: effectiveGuestId!,
        unitId,
        roomId: roomId || undefined,
        checkIn,
        checkOut,
        nightlyRate: baseRate,
        reservationId,
        status,
      } as any);
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Failed to add room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Add Room to Reservation">
      <div className="p-6 space-y-5">
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        )}

        {/* Dates — read-only */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} night{nights !== 1 ? 's' : ''}
        </div>

        {/* Unit */}
        <div>
          <label className={labelCls}>Unit *</label>
          <select className={inputCls} value={unitId} onChange={e => setUnitId(e.target.value)}>
            <option value="">— Select unit —</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Room */}
        <div>
          <label className={labelCls}>Room <span className="normal-case font-normal text-slate-400">(optional)</span></label>
          {!unitId ? (
            <select className={inputCls} disabled><option>Select a unit first</option></select>
          ) : loadingRooms ? (
            <p className="text-xs text-slate-400 py-2">Checking availability…</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-amber-600 py-2">No rooms available for these dates in this unit.</p>
          ) : (
            <select className={inputCls} value={roomId} onChange={e => setRoomId(e.target.value)}>
              <option value="">Floating — assign later</option>
              {rooms.map(r => {
                const id = (r as any).roomId ?? (r as any).id;
                return <option key={id} value={id}>{r.number}{r.type ? ` · ${r.type}` : ''} — ₹{r.baseRate.toLocaleString()}/night</option>;
              })}
            </select>
          )}
          {baseRate > 0 && unitId && (
            <p className="mt-1 text-xs text-slate-400">
              Nightly rate: ₹{baseRate.toLocaleString()} · Estimated total: ₹{(baseRate * nights).toLocaleString()}
            </p>
          )}
        </div>

        {/* Guest */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls} style={{ marginBottom: 0 }}>Guest</label>
            {guestMode !== 'create' && (
              <button
                type="button"
                onClick={() => { setGuestMode('create'); setSelectedGuestId(null); setSelectedGuestName(''); setGuestQuery(''); setGuestResults([]); }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                + New guest
              </button>
            )}
          </div>

          {/* Organizer selected (default) */}
          {guestMode === 'organizer' && organizerGuestId && organizerGuestName && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <span className="font-semibold text-emerald-800">✓ {organizerGuestName} <span className="font-normal text-emerald-600 text-xs">(organizer)</span></span>
              <button
                type="button"
                onClick={() => { setGuestMode('search'); setSelectedGuestId(null); setSelectedGuestName(''); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Change
              </button>
            </div>
          )}

          {/* Search mode */}
          {guestMode === 'search' && (
            <div className="relative">
              {selectedGuestId ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-emerald-800">✓ {selectedGuestName}</span>
                  <button type="button" onClick={() => { setSelectedGuestId(null); setSelectedGuestName(''); setGuestQuery(''); }} className="text-xs text-slate-400 hover:text-slate-600">Change</button>
                </div>
              ) : (
                <>
                  <input
                    className={inputCls}
                    placeholder="Search by name or phone…"
                    value={guestQuery}
                    onChange={e => { setGuestQuery(e.target.value); setGuestResults([]); }}
                    autoFocus
                  />
                  {organizerGuestId && organizerGuestName && (
                    <button
                      type="button"
                      onClick={() => setGuestMode('organizer')}
                      className="mt-1.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ← Use {organizerGuestName} (organizer)
                    </button>
                  )}
                  {guestResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                      {guestResults.map(g => (
                        <button key={g.id} type="button"
                          onClick={() => selectGuest(g)}
                          className="flex w-full flex-col items-start border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50">
                          <span className="font-semibold text-slate-900">{g.firstName} {g.lastName}</span>
                          <span className="text-xs text-slate-400">{g.email ?? g.phone ?? '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Inline create mode */}
          {guestMode === 'create' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name *</label>
                  <input className={inputCls} value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First" autoFocus />
                </div>
                <div>
                  <label className={labelCls}>Last Name *</label>
                  <input className={inputCls} value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={inputCls} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setGuestMode(organizerGuestId ? 'organizer' : 'search')}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createAndSelectGuest}
                  disabled={!newFirstName.trim() || !newLastName.trim() || creatingGuest}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingGuest ? 'Saving…' : 'Save Guest'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Adding…' : 'Add Room'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
