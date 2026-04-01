import { useState, useEffect, useRef } from 'react';
import bookingApi from '../../api/bookingApi';
import roomApi from '../../api/roomApi';
import type { Booking, Room } from '../../types';
import ModalShell from '../ModalShell';

interface RoomShiftModalProps {
  propertyId: string;
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

// Backend RoomDto serializes the PK as "id", but the frontend Room type declares it as "roomId".
// This helper reads whichever field is actually present at runtime.
function getRoomPk(r: Room): string {
  return r.roomId || (r as unknown as { id: string }).id || '';
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400';
const labelCls = 'mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500';
const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50';

type AvailStatus = 'idle' | 'checking' | 'available' | 'unavailable';

export default function RoomShiftModal({ propertyId, booking, onClose, onSuccess }: RoomShiftModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const checkOutStr = booking.checkOut.split('T')[0];
  // day before checkout — computed with local date parts to avoid UTC offset issues
  const maxShiftDate = (() => {
    const [y, m, day] = checkOutStr.split('-').map(Number);
    const d = new Date(y, m - 1, day - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [newRoomId, setNewRoomId] = useState('');
  const [shiftDate, setShiftDate] = useState(today);
  const [newRate, setNewRate] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [availStatus, setAvailStatus] = useState<AvailStatus>('idle');
  const [availReason, setAvailReason] = useState('');
  const availCheckRef = useRef(0);

  // Load all active rooms for the property (no pre-availability filter)
  useEffect(() => {
    roomApi.getByProperty(propertyId)
      .then(data => {
        const currentRoomId = booking.roomId || (booking as unknown as { roomId: string }).roomId;
        const others = (data || []).filter(r => {
          const pk = getRoomPk(r);
          return r.status === 'ACTIVE' && pk !== currentRoomId && pk !== '';
        });
        setRooms(others);
      })
      .catch(() => setError('Failed to load rooms.'))
      .finally(() => setLoading(false));
  }, [propertyId, booking.roomId]);

  // Check availability retroactively whenever room or shift date changes
  useEffect(() => {
    if (!newRoomId || !shiftDate) {
      setAvailStatus('idle');
      return;
    }
    const id = ++availCheckRef.current;
    setAvailStatus('checking');
    setAvailReason('');
    roomApi.checkRoomAvailability(newRoomId, shiftDate, checkOutStr)
      .then(result => {
        if (id !== availCheckRef.current) return;
        if (result.isAvailable) {
          setAvailStatus('available');
        } else {
          setAvailStatus('unavailable');
          setAvailReason(result.reason || 'Room is not available for these dates.');
        }
      })
      .catch(() => {
        if (id !== availCheckRef.current) return;
        setAvailStatus('idle');
      });
  }, [newRoomId, shiftDate, checkOutStr]);

  // Group rooms by unit name for the selector
  const roomsByUnit = rooms.reduce<Record<string, Room[]>>((acc, r) => {
    const unit = r.unitName ?? 'Other';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(r);
    return acc;
  }, {});

  const selectedRoom = rooms.find(r => getRoomPk(r) === newRoomId);

  const handleRoomChange = (id: string) => {
    setNewRoomId(id);
    const r = rooms.find(r => getRoomPk(r) === id);
    if (r && newRate === '') setNewRate(r.baseRate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newRoomId) { setError('Please select a destination room.'); return; }
    if (!shiftDate) { setError('Please select a shift date.'); return; }
    setSubmitting(true);
    try {
      await bookingApi.shiftRoom(propertyId, booking.id!, {
        newRoomId,
        shiftDate,
        newRate: newRate !== '' ? Number(newRate) : undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to shift room. The room may not be available for those dates.');
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Shift Room"
      subtitle={`${booking.guestName} • Currently in Room ${booking.roomNumber || 'Unassigned'}`}
      size="regular"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Current → New room summary */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Room</p>
            <p className="text-lg font-extrabold text-slate-800">{booking.roomNumber || '—'}</p>
          </div>
          <div className="text-slate-300 text-xl">→</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Room</p>
            <p className="text-lg font-extrabold text-blue-700">{selectedRoom ? selectedRoom.number : '—'}</p>
          </div>
        </div>

        {/* Destination room + shift date side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Destination Room *</label>
            {loading ? (
              <p className="text-sm text-slate-400 animate-pulse">Loading rooms...</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No other active rooms in this property.
              </p>
            ) : (
              <select className={inputCls} value={newRoomId} required onChange={e => handleRoomChange(e.target.value)}>
                <option value="">-- Select a room --</option>
                {Object.entries(roomsByUnit).map(([unit, unitRooms]) => (
                  <optgroup key={unit} label={unit}>
                    {unitRooms.map(r => {
                      const pk = getRoomPk(r);
                      return (
                        <option key={pk} value={pk}>
                          {r.number}{r.type ? ` – ${r.type}` : ''} ({booking.currency || 'INR'} {r.baseRate}/night)
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Shift Date *</label>
            <input
              type="date"
              className={inputCls}
              value={shiftDate}
              min={today}
              max={maxShiftDate}
              required
              onChange={e => setShiftDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-400">
              Before checkout ({checkOutStr})
            </p>
          </div>
        </div>

        {/* Availability badge — shown after a room and date are selected */}
        {newRoomId && shiftDate && (
          <div className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-2 ${
            availStatus === 'checking'     ? 'border-slate-200 bg-slate-50 text-slate-500' :
            availStatus === 'available'   ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
            availStatus === 'unavailable' ? 'border-rose-200 bg-rose-50 text-rose-800' :
            'border-slate-200 bg-slate-50 text-slate-400'
          }`}>
            {availStatus === 'checking' && <span className="animate-pulse">Checking availability…</span>}
            {availStatus === 'available' && <><span>✓</span> Room is available for {shiftDate} → {checkOutStr}</>}
            {availStatus === 'unavailable' && <><span>✕</span> {availReason}</>}
          </div>
        )}

        {/* Nightly rate override */}
        <div>
          <label className={labelCls}>
            Nightly Rate Override{' '}
            <span className="normal-case font-normal text-slate-400">(optional — leave blank for base rate)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-400">{booking.currency || 'INR'}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={selectedRoom ? String(selectedRoom.baseRate) : ''}
              className={inputCls}
              value={newRate}
              onChange={e => setNewRate(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="e.g. Guest requested quieter room"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className={btnPrimary}
            disabled={submitting || !newRoomId || loading || availStatus === 'unavailable'}
          >
            {submitting ? 'Shifting…' : 'Confirm Room Shift'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
