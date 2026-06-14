import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import { fmtDate, toDS } from '../../utils/dateHelpers';
import type { BookingStatus } from '../../types';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-200',
};

type Tab = 'inHouse' | 'scheduled' | 'stayed' | 'rescheduled' | 'cancelled';

interface Props {
  propertyId: string;
  onOpen: (reservationId: string) => void;
}

/**
 * Reservations list — reservation-grain rows, expand to reveal member bookings for groups.
 * Tabs: In-House / Scheduled / Stayed / Rescheduled / Cancelled.
 *
 * Filtering is client-side off the full reservation list. Status routing:
 *   In-House    = overallStatus CHECKED_IN
 *   Scheduled   = overallStatus PENDING or CONFIRMED, checkIn >= today
 *   Stayed      = overallStatus CHECKED_OUT
 *   Rescheduled = any member booking with rescheduleReason populated (future feature)
 *   Cancelled   = overallStatus CANCELLED or NO_SHOW
 */
export default function ReservationsList({ propertyId, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>('inHouse');
  const [reservations, setReservations] = useState<GroupBookingSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const data = await reservationApi.getReservations(propertyId);
      setReservations(data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [propertyId]);

  const today = useMemo(() => toDS(new Date()), []);

  const buckets = useMemo(() => {
    const inHouse: GroupBookingSummaryDto[] = [];
    const scheduled: GroupBookingSummaryDto[] = [];
    const stayed: GroupBookingSummaryDto[] = [];
    const rescheduled: GroupBookingSummaryDto[] = [];
    const cancelled: GroupBookingSummaryDto[] = [];

    for (const r of reservations) {
      // Rescheduled is a future feature — currently the dimension is empty.
      // Once Booking.rescheduleReason starts being populated, member-level fetch can flag here.
      const s = r.overallStatus as BookingStatus;
      if (s === 'CHECKED_IN') inHouse.push(r);
      else if (s === 'CHECKED_OUT') stayed.push(r);
      else if (s === 'CANCELLED' || s === 'NO_SHOW') cancelled.push(r);
      else scheduled.push(r);
    }
    return { inHouse, scheduled, stayed, rescheduled, cancelled };
  }, [reservations, today]);

  const visible = buckets[tab];

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'inHouse', label: 'In-House', count: buckets.inHouse.length },
    { id: 'scheduled', label: 'Scheduled', count: buckets.scheduled.length },
    { id: 'stayed', label: 'Stayed', count: buckets.stayed.length },
    { id: 'rescheduled', label: 'Rescheduled', count: buckets.rescheduled.length },
    { id: 'cancelled', label: 'Cancelled', count: buckets.cancelled.length },
  ];

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all',
              tab === t.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            )}
          >
            {t.label}
            <span className={cn(
              'ml-2 rounded-full px-1.5 py-0.5 text-[10px]',
              tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            )}>{t.count}</span>
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No reservations in this view.
        </div>
      )}

      {/* Reservation rows */}
      <ul className="space-y-2">
        {visible.map(r => {
          const isGroup = r.bookings.length > 1;
          const isExpanded = expanded.has(r.reservationId);
          return (
            <li key={r.reservationId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => onOpen(r.reservationId)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isGroup && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleExpand(r.reservationId); }}
                      className="rounded p-1 hover:bg-slate-200"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                    </span>
                  )}
                  {isGroup && <Users className="h-4 w-4 text-indigo-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {r.organizerGuestName}
                      {r.groupReference && (
                        <span className="ml-2 text-xs font-bold text-slate-500">· {r.groupReference}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.reservationNumber && (
                        <span className="mr-2 font-mono font-bold text-slate-400">#{r.reservationNumber}</span>
                      )}
                      {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                      {' · '}
                      {r.totalRooms} {r.totalRooms === 1 ? 'room' : 'rooms'}
                      {' · '}
                      {r.billingMode}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{r.currency} {r.totalGroupPrice.toFixed(2)}</div>
                  </div>
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_BADGE[r.overallStatus] || STATUS_BADGE.PENDING)}>
                    {r.overallStatus.replace('_', ' ')}
                  </span>
                </div>
              </button>

              {isGroup && isExpanded && (
                <ul className="border-t border-slate-100 bg-slate-50 px-5 py-2">
                  {r.bookings.map((b: BookingSummaryDto) => (
                    <li key={b.bookingId} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{b.guestName}</div>
                        <div className="text-slate-500">
                          {b.unitName} · Room {b.roomNumber || <span className="italic">unassigned</span>}
                        </div>
                      </div>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_BADGE[b.status] || STATUS_BADGE.PENDING)}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
