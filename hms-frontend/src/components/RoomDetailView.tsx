import type { Room } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Tokens & Helpers                                             */
/* ────────────────────────────────────────────────────────────── */

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  room: Room;
  statusLabel: string;
  statusDescription: string;
  statusStatClass: string;
  onEdit: () => void;
  onBook: () => void;
};

/* ────────────────────────────────────────────────────────────── */
/* Component                                                    */
/* ────────────────────────────────────────────────────────────── */

export default function RoomDetailsView({
  room,
  statusLabel,
  statusDescription,
  statusStatClass,
  onEdit,
  onBook,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Current Status Header */}
      <div className={cn('rounded-xl border p-4', statusStatClass || 'border-slate-200 bg-slate-50')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Status</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{statusLabel}</p>
          </div>
          <span className="text-sm font-medium text-slate-500">{statusDescription}</span>
        </div>
      </div>

      {/* Grid Specs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capacity</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{room.capacity} guests</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Base Rate</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(room.baseRate)}</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Unit</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{room.unitName || 'Direct room'}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory State</p>
            <p className="mt-1 text-base font-semibold capitalize text-slate-900">
              {room.status.toLowerCase().replaceAll('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button type="button" className={btnSecondary} onClick={onEdit}>Edit Room</button>
        <button type="button" className={btnPrimary} onClick={onBook}>Create Booking</button>
      </div>
    </div>
  );
}