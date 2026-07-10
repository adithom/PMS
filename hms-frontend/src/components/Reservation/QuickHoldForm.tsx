import { useEffect, useRef, useState } from 'react';
import unitApi from '../../api/unitApi';
import reservationApi from '../../api/reservationApi';
import type { UnitDto } from '../../types';
import { todayIST, addDays, toDS } from '../../utils/dateHelpers';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';

interface Props {
  propertyId: string;
  onSuccess: (reservationId: string) => void;
  onClose: () => void;
}

export default function QuickHoldForm({ propertyId, onSuccess, onClose }: Props) {
  const today = todayIST();
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(toDS(addDays(new Date(today), 1)));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    unitApi.getByProperty(propertyId).then(data => {
      const list = data || [];
      setUnits(list);
      const initial: Record<string, number> = {};
      list.forEach(u => { initial[u.id] = 0; });
      setCounts(initial);
    }).catch(() => {});
  }, [propertyId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const totalRooms = Object.values(counts).reduce((s, n) => s + n, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalRooms === 0) { setError('Select at least one room.'); return; }
    if (checkOut <= checkIn) { setError('Check-out must be after check-in.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const roomRequests = units
        .filter(u => (counts[u.id] ?? 0) > 0)
        .map(u => ({ unitId: u.id, count: counts[u.id] }));
      const res = await reservationApi.quickHold(propertyId, {
        checkIn,
        checkOut,
        roomRequests,
        notes: notes.trim() || undefined,
      });
      onSuccess(res.reservationId);
    } catch (e: any) {
      setError(e?.message || 'Failed to create hold.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">Quick Hold</p>
        <p className="text-xs text-slate-500">Creates a pending reservation — fill in guest details later.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Check-in</label>
            <input
              type="date"
              className={inputCls}
              value={checkIn}
              min={today}
              onChange={e => {
                setCheckIn(e.target.value);
                if (checkOut <= e.target.value) {
                  setCheckOut(toDS(addDays(new Date(e.target.value), 1)));
                }
              }}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Check-out</label>
            <input
              type="date"
              className={inputCls}
              value={checkOut}
              min={checkIn ? toDS(addDays(new Date(checkIn), 1)) : today}
              onChange={e => setCheckOut(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Per-unit room counts */}
        {units.length > 0 && (
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600">Rooms</label>
            <div className="space-y-2">
              {units.map(unit => (
                <div key={unit.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700 truncate">{unit.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                      disabled={(counts[unit.id] ?? 0) === 0}
                      onClick={() => setCounts(prev => ({ ...prev, [unit.id]: Math.max(0, (prev[unit.id] ?? 0) - 1) }))}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-slate-900">
                      {counts[unit.id] ?? 0}
                    </span>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                      onClick={() => setCounts(prev => ({ ...prev, [unit.id]: (prev[unit.id] ?? 0) + 1 }))}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Reference / Notes <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. ACME Corp, phone inquiry"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || totalRooms === 0}
            className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Holding…' : `Hold${totalRooms > 0 ? ` (${totalRooms})` : ''}`}
          </button>
        </div>
      </form>
    </div>
  );
}
