import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import type { GroupBookingSummaryDto, BookingSummaryDto } from '../../api/reservationApi';
import { fmtDate, toDS } from '../../utils/dateHelpers';
import type { ReservationStatus } from '../../types';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED:   'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_IN:  'bg-emerald-100 text-emerald-800 border-emerald-200',
  CHECKED_OUT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  CANCELLED:   'bg-rose-100 text-rose-800 border-rose-200',
};

type Tab = 'inHouse' | 'scheduled' | 'stayed' | 'rescheduled' | 'cancelled';

interface Props {
  reservations: GroupBookingSummaryDto[];
  loading: boolean;
  onOpen: (reservationId: string) => void;
}

export default function MobileListView({ reservations, loading, onOpen }: Props) {
  const [tab, setTab] = useState<Tab>('inHouse');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const today = useMemo(() => toDS(new Date()), []);

  const buckets = useMemo(() => {
    const inHouse: GroupBookingSummaryDto[] = [];
    const scheduled: GroupBookingSummaryDto[] = [];
    const stayed: GroupBookingSummaryDto[] = [];
    const rescheduled: GroupBookingSummaryDto[] = [];
    const cancelled: GroupBookingSummaryDto[] = [];
    for (const r of reservations) {
      const s = r.overallStatus as ReservationStatus;
      if (s === 'CHECKED_IN') inHouse.push(r);
      else if (s === 'CHECKED_OUT') stayed.push(r);
      else if (s === 'CANCELLED') cancelled.push(r);
      else scheduled.push(r);
    }
    return { inHouse, scheduled, stayed, rescheduled, cancelled };
  }, [reservations]);

  const arrivalsToday = useMemo(
    () => reservations.filter(r =>
      r.checkIn === today && (r.overallStatus === 'PENDING' || r.overallStatus === 'CONFIRMED')
    ).length,
    [reservations, today]
  );

  const departuresToday = useMemo(
    () => reservations.filter(r => r.checkOut === today && r.overallStatus === 'CHECKED_IN').length,
    [reservations, today]
  );

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'inHouse',    label: 'In-House',   count: buckets.inHouse.length },
    { id: 'scheduled',  label: 'Scheduled',  count: buckets.scheduled.length },
    { id: 'stayed',     label: 'Stayed',     count: buckets.stayed.length },
    { id: 'rescheduled',label: 'Rescheduled',count: buckets.rescheduled.length },
    { id: 'cancelled',  label: 'Cancelled',  count: buckets.cancelled.length },
  ];

  const q = search.trim().toLowerCase();
  const visible = (buckets[tab] as GroupBookingSummaryDto[]).filter(r =>
    !q || r.organizerGuestName.toLowerCase().includes(q) || (r.groupReference || '').toLowerCase().includes(q)
  );

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      {/* Occupancy summary strip */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: 'In-House',  value: buckets.inHouse.length,  color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
          { label: 'Arrivals',  value: arrivalsToday,           color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Departures',value: departuresToday,          color: 'bg-amber-50 border-amber-200 text-amber-800' },
        ].map(chip => (
          <div key={chip.label} className={cn('rounded-xl border px-3 py-3 text-center', chip.color)}>
            <div className="text-2xl font-extrabold">{chip.value}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-70">{chip.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search guest or reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Tabs — horizontally scrollable */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm min-w-max">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setSearch(''); }}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              )}
            >
              {t.label}
              <span className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              )}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center text-sm text-slate-400 py-8">Loading…</div>}

      {!loading && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {q ? 'No results for that search.' : 'No reservations in this view.'}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map(r => {
          const isGroup = r.bookings.length > 1;
          const isExpanded = expanded.has(r.reservationId);
          const rooms = r.bookings.map((b: BookingSummaryDto) => b.roomNumber).filter(Boolean);
          return (
            <li key={r.reservationId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => onOpen(r.reservationId)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-slate-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isGroup && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleExpand(r.reservationId); }}
                      className="rounded p-1 hover:bg-slate-200 shrink-0"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                    </span>
                  )}
                  {isGroup && <Users className="h-4 w-4 text-indigo-500 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {r.organizerGuestName}
                      {r.groupReference && <span className="ml-1.5 text-xs font-bold text-slate-400">· {r.groupReference}</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
                      {rooms.length > 0 && <span> · Rm {rooms.join(', ')}</span>}
                    </div>
                  </div>
                </div>
                <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', STATUS_BADGE[r.overallStatus] || STATUS_BADGE.PENDING)}>
                  {r.overallStatus.replace('_', ' ')}
                </span>
              </button>

              {isGroup && isExpanded && (
                <ul className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                  {r.bookings.map((b: BookingSummaryDto) => (
                    <li key={b.bookingId} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{b.guestName}</div>
                        <div className="text-slate-500">{b.unitName} · Room {b.roomNumber || <span className="italic">unassigned</span>}</div>
                      </div>
                      <span className={cn('shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold', b.cancelled ? STATUS_BADGE.CANCELLED : (STATUS_BADGE[r.overallStatus] || STATUS_BADGE.PENDING))}>
                        {b.cancelled ? 'CANCELLED' : r.overallStatus.replace('_', ' ')}
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
