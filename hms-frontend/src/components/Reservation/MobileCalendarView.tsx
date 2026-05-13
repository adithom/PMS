import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import availabilityApi from '../../api/availabilityApi';
import bookingApi from '../../api/bookingApi';
import type { TapeChartDto, BookingStatus } from '../../types';
import { addDays, dayLabel, dateStr, diffDays, shortDate, toDS } from '../../utils/dateHelpers';
import { STATUS_COLORS } from '../Booking/TapeChartConstants';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const NUM_DAYS = 7;
const CELL_H = 40;
const MOBILE_LABEL_W = 48;
const MIN_CELL_W = 80;

type Bar = {
  bookingId: string;
  guestName: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  isGhost: boolean;
  reservationId?: string;
  groupReference?: string;
};

const GROUP_TINTS = [
  'border-indigo-400',
  'border-emerald-400',
  'border-amber-400',
  'border-fuchsia-400',
  'border-cyan-400',
  'border-rose-400',
];
function tintForReservation(resId?: string): string | null {
  if (!resId) return null;
  let h = 0;
  for (let i = 0; i < resId.length; i++) h = (h * 31 + resId.charCodeAt(i)) | 0;
  return GROUP_TINTS[Math.abs(h) % GROUP_TINTS.length];
}

interface Props {
  propertyId: string;
  onOpenReservation: (reservationId: string) => void;
}

export default function MobileCalendarView({ propertyId, onOpenReservation }: Props) {
  const [winStart, setWinStart] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const dateCols = useMemo(() => Array.from({ length: NUM_DAYS }, (_, i) => addDays(winStart, i)), [winStart]);
  const winStartStr = useMemo(() => toDS(winStart), [winStart]);
  const winEndStr   = useMemo(() => toDS(addDays(winStart, NUM_DAYS - 1)), [winStart]);
  const todayStr    = useMemo(() => toDS(new Date()), []);

  const [data, setData]     = useState<TapeChartDto | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const cellW = containerWidth > 0
    ? Math.max(MIN_CELL_W, Math.floor((containerWidth - MOBILE_LABEL_W) / NUM_DAYS))
    : MIN_CELL_W;

  const attachScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    ro.observe(el);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tc = await availabilityApi.getTapeChart(propertyId, winStartStr, winEndStr, true);
      setData(tc);
    } catch (e) { console.error('[MobileCalendarView] fetch failed', e); }
    finally { setLoading(false); }
  }, [propertyId, winStartStr, winEndStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groups = useMemo(() => {
    if (!data) return [];
    const m = new Map<string, typeof data.rooms>();
    for (const r of data.rooms) {
      const u = r.unitName || 'Unassigned';
      if (!m.has(u)) m.set(u, []);
      m.get(u)!.push(r);
    }
    return Array.from(m.entries()).map(([unit, rms]) => ({ type: unit, rooms: rms }));
  }, [data]);

  const barsByRoom = useMemo(() => {
    const m: Record<string, Bar[]> = {};
    if (!data) return m;
    for (const ra of data.realAssignments) {
      if (ra.status === 'CANCELLED') continue;
      (m[ra.roomNumber] ??= []).push({
        bookingId: ra.bookingId, guestName: '', status: 'CONFIRMED',
        startDate: ra.startDate, endDate: ra.endDate, isGhost: false,
      });
    }
    for (const g of data.ghostAssignments) {
      (m[g.roomNumber] ??= []).push({
        bookingId: g.bookingId, guestName: g.guestName, status: g.bookingStatus,
        startDate: g.startDate, endDate: g.endDate, isGhost: true,
        reservationId: g.reservationId, groupReference: g.groupReference,
      });
    }
    return m;
  }, [data]);

  const [bookingMeta, setBookingMeta] = useState<Map<string, { guestName: string; status: BookingStatus; reservationId?: string }>>(new Map());
  useEffect(() => {
    if (!data) return;
    const ids = data.realAssignments.map(ra => ra.bookingId).filter(Boolean);
    if (ids.length === 0) return;
    (async () => {
      try {
        const bks = await bookingApi.getRange(propertyId, winStartStr, winEndStr);
        const map = new Map<string, any>();
        for (const b of bks) {
          if (!b.id) continue;
          map.set(b.id, { guestName: b.guestName, status: b.status, reservationId: b.reservationId });
        }
        setBookingMeta(map);
      } catch (e) { console.error(e); }
    })();
  }, [data, propertyId, winStartStr, winEndStr]);

  const enrichedBarsByRoom = useMemo(() => {
    const m: Record<string, Bar[]> = {};
    for (const [rn, bars] of Object.entries(barsByRoom)) {
      m[rn] = bars.map(b => {
        if (b.isGhost) return b;
        const meta = bookingMeta.get(b.bookingId);
        return meta ? { ...b, guestName: meta.guestName, status: meta.status, reservationId: meta.reservationId } : b;
      });
    }
    return m;
  }, [barsByRoom, bookingMeta]);

  const navigate = (delta: number) => setWinStart(addDays(winStart, delta));
  const goToday  = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setWinStart(d); };

  const visibleRoomCount = groups.reduce((acc, g) => acc + g.rooms.length, 0);
  const gridW    = MOBILE_LABEL_W + NUM_DAYS * cellW;
  const chartMinH = Math.max(visibleRoomCount, 8) * CELL_H + 50;

  const btnSm = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50';

  return (
    <div>
      {/* Two-row toolbar */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className={btnSm} onClick={() => navigate(-NUM_DAYS)}>
            <ChevronLeft className="h-3.5 w-3.5" />Prev
          </button>
          <button type="button" className={btnSm} onClick={goToday}>Today</button>
          <button type="button" className={btnSm} onClick={() => navigate(NUM_DAYS)}>
            Next<ChevronRight className="h-3.5 w-3.5" />
          </button>
          <input
            type="date"
            value={winStartStr}
            onChange={e => { if (e.target.value) setWinStart(new Date(e.target.value + 'T00:00:00')); }}
            className={btnSm + ' cursor-pointer'}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">
            {shortDate(winStart)} — {shortDate(addDays(winStart, NUM_DAYS - 1))}
          </span>
          {loading && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
        </div>
      </div>

      {/* Grid */}
      <div ref={attachScrollRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative" style={{ width: gridW, minHeight: chartMinH }}>
          {/* Header */}
          <div className="sticky top-0 z-[20] flex border-b border-slate-200 bg-slate-50">
            <div className="sticky left-0 z-[25] shrink-0 border-r border-slate-200 bg-slate-50 px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500" style={{ width: MOBILE_LABEL_W }}>
              Room
            </div>
            {dateCols.map((d, i) => {
              const ds = toDS(d);
              const isToday = ds === todayStr;
              return (
                <div key={i}
                  className={cn(
                    'shrink-0 border-r border-slate-200 px-0.5 py-2 text-center text-[9px] font-bold uppercase tracking-wider',
                    isToday ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'
                  )}
                  style={{ width: cellW }}>
                  <div>{dayLabel(d)}</div>
                  <div className="mt-0.5 text-[10px] font-bold text-slate-700">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {groups.map(g => (
            <div key={g.type}>
              <div className="border-b border-slate-200 bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                {g.type} · {g.rooms.length}
              </div>
              {g.rooms.map(room => {
                const rSlots = enrichedBarsByRoom[room.number] || [];
                return (
                  <div key={room.id} className="relative flex border-b border-slate-100" style={{ height: CELL_H }}>
                    <div className="sticky left-0 z-[15] shrink-0 border-r border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-700 truncate" style={{ width: MOBILE_LABEL_W }}>
                      {room.number}
                    </div>
                    {dateCols.map((_, i) => (
                      <div key={i} className="shrink-0 border-r border-slate-100" style={{ width: cellW }} />
                    ))}

                    {rSlots.map(bar => {
                      const ci = dateStr(bar.startDate);
                      const co = dateStr(bar.endDate);
                      const unClampedStart = diffDays(winStartStr, ci);
                      const unClampedEnd   = diffDays(winStartStr, co);
                      const visStart = Math.max(0, unClampedStart);
                      const visEnd   = Math.min(NUM_DAYS, unClampedEnd);
                      if (visEnd <= 0 || visStart >= NUM_DAYS) return null;
                      const leftPx  = MOBILE_LABEL_W + visStart * cellW + 1;
                      const widthPx = (visEnd - visStart) * cellW - 2;
                      if (widthPx <= 0) return null;
                      const bleedsLeft  = unClampedStart < 0;
                      const bleedsRight = unClampedEnd > NUM_DAYS;
                      const sc   = STATUS_COLORS[bar.status] || STATUS_COLORS.PENDING;
                      const tint = tintForReservation(bar.reservationId);
                      return (
                        <div
                          key={`${bar.bookingId}-${bar.startDate}`}
                          onClick={() => { if (bar.reservationId) onOpenReservation(bar.reservationId); }}
                          className={cn(
                            'absolute flex items-center px-1 cursor-pointer overflow-hidden shadow-sm transition-all active:brightness-90',
                            bar.isGhost ? 'border-2 border-dashed opacity-80' : 'border',
                            tint,
                            bleedsLeft && bleedsRight ? 'rounded-none' :
                            bleedsLeft  ? 'rounded-r-md rounded-l-none' :
                            bleedsRight ? 'rounded-l-md rounded-r-none' :
                            'rounded-md',
                            sc.bar, sc.text,
                          )}
                          style={{ left: leftPx, width: widthPx, height: CELL_H - 6, top: 3, zIndex: 5 }}
                          title={`${bar.guestName || 'Guest'} · ${bar.status.replace('_', ' ')} · ${ci} → ${co}`}
                        >
                          <span className="text-[10px] font-bold truncate">{bar.guestName || 'Guest'}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {!loading && groups.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">No rooms found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
