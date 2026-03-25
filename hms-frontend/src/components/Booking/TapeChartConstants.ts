// src/components/Booking/TapeChartConstants.ts

export const CELL_W = 110;
export const CELL_H = 40;
export const LABEL_W = 160;
export const MIN_CHART_ROWS = 18;

export const BUFFER_BEFORE = 15;
export const BUFFER_AFTER = 16;
export const REFETCH_THRESHOLD = 3;
export const NAV_DEBOUNCE_MS = 300;
export const SCROLL_EDGE_PX = 80;
export const SCROLL_COOLDOWN_MS = 600;
export const SCROLL_STEP_DAYS = 2;

export const STATUS_COLORS: Record<string, { bar: string; text: string; legend: string; label: string }> = {
  CONFIRMED:   { bar: 'bg-blue-200/90',    text: 'text-blue-900',     legend: 'bg-blue-300',    label: 'Confirmed' },
  CHECKED_IN:  { bar: 'bg-green-200/90',   text: 'text-green-900',    legend: 'bg-green-300',   label: 'Checked In' },
  PENDING:     { bar: 'bg-amber-200/90',   text: 'text-amber-900',    legend: 'bg-amber-300',   label: 'Pending' },
  CHECKED_OUT: { bar: 'bg-slate-300/90',   text: 'text-slate-800',    legend: 'bg-slate-300',   label: 'Checked Out' },
  CANCELLED:   { bar: 'bg-gray-200/50',    text: 'text-gray-500',     legend: 'bg-gray-300',    label: 'Cancelled' },
  NO_SHOW:     { bar: 'bg-rose-200/90',    text: 'text-rose-900',     legend: 'bg-rose-300',    label: 'No Show / Available' },
};

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
