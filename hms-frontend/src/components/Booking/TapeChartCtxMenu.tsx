// src/components/Booking/TapeChartCtxMenu.tsx
import { useEffect, useRef, useState } from 'react';
import bookingApi from '../../api/bookingApi';
import type { Booking } from '../../types';
import { STATUS_COLORS, cn } from './TapeChartConstants';
import { toDS, dateStr } from '../../utils/dateHelpers';

type TapeChartCtxMenuProps = {
  state: { x: number; y: number; booking: Booking } | null;
  propertyId: string;
  onClose: () => void;
  onAction: () => void;
  onEarlyCheckout: (bookingId: string) => void;
};

export default function TapeChartCtxMenu({
  state,
  propertyId,
  onClose,
  onAction,
  onEarlyCheckout,
}: TapeChartCtxMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  if (!state) return null;
  const { x, y, booking } = state;
  const sc = STATUS_COLORS[booking.status] ?? STATUS_COLORS.PENDING;
  const guestName = booking.guestName || 'Guest';

  type Act = { label: string; doFn: () => Promise<void>; danger?: boolean };
  const acts: Act[] = [];

  if (booking.id) {
    switch (booking.status) {
      case 'PENDING':
        acts.push({
          label: '✓ Confirm Booking',
          doFn: async () => {
            await bookingApi.updateStatus(propertyId, booking.id!, 'CONFIRMED');
            onAction();
          },
        });
        acts.push({
          label: '✕ Cancel Booking',
          doFn: async () => {
            await bookingApi.updateStatus(propertyId, booking.id!, 'CANCELLED');
            onAction();
          },
          danger: true,
        });
        break;
      case 'CONFIRMED':
        acts.push({
          label: '✓ Check-in Guest',
          doFn: async () => {
            await bookingApi.checkIn(propertyId, booking.id!);
            onAction();
          },
        });
        acts.push({
          label: '⊘ Mark No Show',
          doFn: async () => {
            await bookingApi.updateStatus(propertyId, booking.id!, 'NO_SHOW');
            onAction();
          },
          danger: true,
        });
        break;
      case 'CHECKED_IN': {
        const outDate = dateStr(booking.checkOut);
        const today = toDS(new Date());

        if (today < outDate) {
          acts.push({
            label: '⏱ Early Checkout',
            doFn: async () => {
              onEarlyCheckout(booking.id!);
              onClose();
            },
          });
        } else {
          acts.push({
            label: '⏎ Check-out Guest',
            doFn: async () => {
              await bookingApi.checkOut(propertyId, booking.id!);
              onAction();
            },
          });
        }
        break;
      }
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-[60] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{
        left: Math.min(x, window.innerWidth - 280),
        top: Math.min(y, window.innerHeight - 300),
      }}
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="truncate text-sm font-bold text-slate-900">{guestName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
              sc.bar,
              sc.text,
            )}
          >
            {booking.status.replace('_', ' ')}
          </span>
          <span className="text-[11px] text-slate-400">Room {booking.roomNumber || '—'}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {dateStr(booking.checkIn)} → {dateStr(booking.checkOut)}
        </p>
      </div>
      <div className="py-1">
        {error && (
          <p className="px-4 py-2 text-xs text-rose-600">{error}</p>
        )}
        {acts.length === 0 && <p className="px-4 py-2 text-xs text-slate-400">No actions available</p>}
        {acts.map((a) => (
          <button
            key={a.label}
            type="button"
            className={cn(
              'w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50',
              a.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700',
            )}
            onClick={async () => {
              try {
                setError(null);
                await a.doFn();
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Action failed');
              }
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
