// src/components/Booking/TapeChartConstants.ts
import type { ReservationStatus } from '../../types';

export const CELL_W = 110;
export const CELL_H = 40;
export const LABEL_W = 112;
export const MIN_CHART_ROWS = 18;

export const BUFFER_BEFORE = 15;
export const BUFFER_AFTER = 16;
export const REFETCH_THRESHOLD = 3;
export const NAV_DEBOUNCE_MS = 300;
export const SCROLL_EDGE_PX = 80;
export const SCROLL_COOLDOWN_MS = 600;
export const SCROLL_STEP_DAYS = 2;

export const STATUS_COLORS: Record<ReservationStatus | 'CANCELLED_BOOKING', { bar: string; text: string; legend: string; label: string }> = {
  CONFIRMED:         { bar: 'bg-blue-200/90',    text: 'text-blue-900',     legend: 'bg-blue-300',    label: 'Confirmed' },
  CHECKED_IN:        { bar: 'bg-green-200/90',   text: 'text-green-900',    legend: 'bg-green-300',   label: 'Checked In' },
  PENDING:           { bar: 'bg-amber-200/90',   text: 'text-amber-900',    legend: 'bg-amber-300',   label: 'Pending' },
  CHECKED_OUT:       { bar: 'bg-slate-300/90',   text: 'text-slate-800',    legend: 'bg-slate-300',   label: 'Checked Out' },
  CANCELLED:         { bar: 'bg-gray-200/50',    text: 'text-gray-500',     legend: 'bg-gray-300',    label: 'Cancelled' },
  CANCELLED_BOOKING: { bar: 'bg-rose-200/50',    text: 'text-rose-500',     legend: 'bg-rose-300',    label: 'Room Cancelled' },
};

export function bookingStatusKey(reservationStatus: ReservationStatus, cancelled: boolean): ReservationStatus | 'CANCELLED_BOOKING' {
  if (cancelled) return 'CANCELLED_BOOKING';
  return reservationStatus;
}

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

// Pick a deterministic color tint for a reservation/group (rotating palette).
export const GROUP_TINTS = [
  'border-indigo-400 ring-indigo-300',
  'border-emerald-400 ring-emerald-300',
  'border-amber-400 ring-amber-300',
  'border-fuchsia-400 ring-fuchsia-300',
  'border-cyan-400 ring-cyan-300',
  'border-rose-400 ring-rose-300',
];
export function tintForReservation(resId?: string): string | null {
  if (!resId) return null;
  let h = 0;
  for (let i = 0; i < resId.length; i++) h = (h * 31 + resId.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % GROUP_TINTS.length;
  return GROUP_TINTS[idx];
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
