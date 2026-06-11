import { useState } from 'react';
import ModalShell from '../ModalShell';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import { todayIST, diffDays, fmtDate } from '../../utils/dateHelpers';

interface Props {
  reservation: GroupBookingSummaryDto;
  propertyId: string;
  onClose: () => void;
  onRescheduled: (updated: GroupBookingSummaryDto) => void;
}

export default function RescheduleModal({ reservation, propertyId, onClose, onRescheduled }: Props) {
  const [newCheckIn, setNewCheckIn] = useState(reservation.checkIn);
  const [newCheckOut, setNewCheckOut] = useState(reservation.checkOut);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayIST();
  const newNights = newCheckIn && newCheckOut ? diffDays(newCheckIn, newCheckOut) : 0;
  const datesValid = newCheckIn >= today && newCheckOut > newCheckIn && newNights > 0;

  const estimatedTotal = reservation.bookings.reduce((sum: number, b: BookingSummaryDto) => {
    const roomRate = b.unitBaseRate ?? 0;
    const mealRate = b.mealPlanPricePerNight ?? 0;
    return sum + (roomRate + mealRate) * newNights;
  }, 0);

  const handleConfirm = async () => {
    if (!datesValid) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await reservationApi.reschedule(propertyId, reservation.reservationId, {
        newCheckIn,
        newCheckOut,
        reason: reason.trim() || undefined,
      });
      onRescheduled(updated);
    } catch (e: any) {
      setError(e?.message || 'Failed to reschedule reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Reschedule Reservation">
      <div className="p-6 space-y-5">
        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Room assignments will be released. Rooms must be re-assigned after rescheduling.
        </div>

        {/* Date pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              New Check-in
            </label>
            <input
              type="date"
              value={newCheckIn}
              min={today}
              onChange={e => {
                setNewCheckIn(e.target.value);
                if (newCheckOut <= e.target.value) {
                  setNewCheckOut('');
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
              New Check-out
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

        {newCheckIn && newCheckOut && newNights > 0 && (
          <p className="text-xs text-slate-500">{newNights} night{newNights !== 1 ? 's' : ''} · {fmtDate(newCheckIn)} → {fmtDate(newCheckOut)}</p>
        )}

        {/* Reason */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 resize-none"
            placeholder="e.g. Guest request, itinerary change…"
          />
        </div>

        {/* Estimate breakdown */}
        {datesValid && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Estimated Total (room + meal plan)
            </p>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-400">Unit</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-400 text-right">Rate/night</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-400 text-right">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.bookings.map((b: BookingSummaryDto) => {
                    const roomRate = b.unitBaseRate ?? 0;
                    const mealRate = b.mealPlanPricePerNight ?? 0;
                    const ratePerNight = roomRate + mealRate;
                    const total = ratePerNight * newNights;
                    return (
                      <tr key={b.bookingId} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{b.unitName} · {b.guestName}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {reservation.currency} {ratePerNight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800">
                          {reservation.currency} {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-700" colSpan={2}>Total estimate</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      {reservation.currency} {estimatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400 italic">
              Estimate only — actual billing is determined by the folio after room re-assignment.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!datesValid || loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Rescheduling…' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
