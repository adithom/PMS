// src/utils/dateHelpers.ts

export const toDS = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const diffDays = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);

export const shortDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const dayLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { weekday: 'short' });

export const dateStr = (v: string): string => v.split('T')[0];
