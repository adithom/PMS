// src/utils/dateHelpers.ts

const IST = 'Asia/Kolkata';

/** Convert a Date to a YYYY-MM-DD string using IST date parts (for API calls / date inputs). */
export const toDS = (d: Date): string =>
  d.toLocaleDateString('en-CA', { timeZone: IST });

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

/** Abbreviated date label for tape chart column headers, e.g. "15 Jan". */
export const shortDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { timeZone: IST, day: 'numeric', month: 'short' });

/** Weekday abbreviation for tape chart column headers, e.g. "Mon". */
export const dayLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { timeZone: IST, weekday: 'short' });

/** Extract the date part (YYYY-MM-DD) from an ISO string (for comparisons, not display). */
export const dateStr = (v: string): string => v.split('T')[0];

/** Today's date in IST as YYYY-MM-DD. Use for <input type="date"> defaults and API params. */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

/** Format a YYYY-MM-DD string or ISO timestamp for display as dd-mm-yyyy. */
export function fmtDate(d: string | Date): string {
  const date = typeof d === 'string'
    ? new Date(d.includes('T') ? d : d + 'T00:00:00')
    : d;
  return date.toLocaleDateString('en-GB', { timeZone: IST }).replace(/\//g, '-');
}

/** Format an ISO timestamp for display as dd-mm-yyyy HH:mm (IST). */
export function fmtDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const datePart = date.toLocaleDateString('en-GB', { timeZone: IST }).replace(/\//g, '-');
  const timePart = date.toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}
