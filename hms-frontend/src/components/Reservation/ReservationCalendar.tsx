import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import availabilityApi from '../../api/availabilityApi';
import bookingApi from '../../api/bookingApi';
import type { TapeChartDto, BookingStatus } from '../../types';
import { addDays, dayLabel, dateStr, diffDays, shortDate, toDS } from '../../utils/dateHelpers';
import {
  CELL_W, CELL_H, LABEL_W, MIN_CHART_ROWS, STATUS_COLORS, tintForReservation,
} from '../Booking/TapeChartConstants';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnSecondary = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50';

type Bar = {
  // bookingId is the natural key — used for highlight + actions.
  bookingId: string;
  guestName: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  isGhost: boolean;
  reservationId?: string;
  groupReference?: string;
};

interface Props {
  propertyId: string;
  onOpenReservation: (reservationId: string) => void;
  onAssignRoom: (booking: { id: string; unitId: string; checkIn: string; checkOut: string }) => void;
}

export default function ReservationCalendar({ propertyId, onOpenReservation, onAssignRoom }: Props) {
  const [numDays, setNumDays] = useState(7);
  const [winStart, setWinStart] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const dateCols = useMemo(() => Array.from({ length: numDays }, (_, i) => addDays(winStart, i)), [winStart, numDays]);
  const winStartStr = useMemo(() => toDS(winStart), [winStart]);
  const winEndStr = useMemo(() => toDS(addDays(winStart, numDays - 1)), [winStart, numDays]);
  const todayStr = useMemo(() => toDS(new Date()), []);

  const [data, setData] = useState<TapeChartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; bar: Bar } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const cellW = containerWidth > 0 ? Math.max(CELL_W / 2, Math.floor((containerWidth - LABEL_W) / numDays)) : CELL_W;

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
    } catch (e) {
      console.error('[ReservationCalendar] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [propertyId, winStartStr, winEndStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close ctx menu on outside click.
  useEffect(() => {
    if (!ctx) return;
    const h = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtx(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ctx]);

  // Group rooms by unit.
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

  // Build bars by room number.
  const barsByRoom = useMemo(() => {
    const m: Record<string, Bar[]> = {};
    if (!data) return m;
    for (const ra of data.realAssignments) {
      if (ra.status === 'CANCELLED') continue;
      (m[ra.roomNumber] ??= []).push({
        bookingId: ra.bookingId,
        guestName: '',
        status: 'CONFIRMED', // populated below from bookings lookup
        startDate: ra.startDate,
        endDate: ra.endDate,
        isGhost: false,
      });
    }
    for (const g of data.ghostAssignments) {
      (m[g.roomNumber] ??= []).push({
        bookingId: g.bookingId,
        guestName: g.guestName,
        status: g.bookingStatus,
        startDate: g.startDate,
        endDate: g.endDate,
        isGhost: true,
        reservationId: g.reservationId,
        groupReference: g.groupReference,
      });
    }
    return m;
  }, [data]);

  // Real-assignment bars are missing booking info (we need guestName + status + reservationId).
  // Fetch lazily via a side cache. Keep it simple: refetch the booking range to enrich.
  const [bookingMeta, setBookingMeta] = useState<Map<string, { guestName: string; status: BookingStatus; reservationId?: string; unitId: string; checkIn: string; checkOut: string }>>(new Map());
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
          map.set(b.id, {
            guestName: b.guestName,
            status: b.status,
            reservationId: b.reservationId,
            unitId: b.unitId,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
          });
        }
        setBookingMeta(map);
      } catch (e) { console.error(e); }
    })();
  }, [data, propertyId, winStartStr, winEndStr]);

  // Enriched bars (real bars get guestName/status/reservationId attached from bookingMeta).
  const enrichedBarsByRoom = useMemo(() => {
    const m: Record<string, Bar[]> = {};
    for (const [rn, bars] of Object.entries(barsByRoom)) {
      m[rn] = bars.map(b => {
        if (b.isGhost) return b;
        const meta = bookingMeta.get(b.bookingId);
        return meta
          ? { ...b, guestName: meta.guestName, status: meta.status, reservationId: meta.reservationId }
          : b;
      });
    }
    return m;
  }, [barsByRoom, bookingMeta]);

  const navigate = (delta: number) => setWinStart(addDays(winStart, delta));
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setWinStart(d); };

  const visibleRoomCount = groups.reduce((acc, g) => acc + g.rooms.length, 0);
  const gridW = LABEL_W + numDays * cellW;
  const chartMinH = Math.max(visibleRoomCount, MIN_CHART_ROWS) * CELL_H + 70;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button type="button" className={btnSecondary} onClick={() => navigate(-numDays)}>
          <ChevronLeft className="h-4 w-4" />Prev
        </button>
        <button type="button" className={btnSecondary} onClick={goToday}>Today</button>
        <button type="button" className={btnSecondary} onClick={() => navigate(numDays)}>
          Next<ChevronRight className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={winStartStr}
          onChange={e => { if (e.target.value) setWinStart(new Date(e.target.value + 'T00:00:00')); }}
          className={btnSecondary + ' cursor-pointer'}
        />
        <span className="text-sm font-semibold text-slate-600">{shortDate(winStart)} — {shortDate(addDays(winStart, numDays - 1))}</span>
        {loading && <span className="text-xs text-slate-400 animate-pulse">Refreshing…</span>}
        <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button type="button"
            className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
              numDays === 7 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}
            onClick={() => setNumDays(7)}>7d</button>
          <button type="button"
            className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
              numDays === 14 ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100')}
            onClick={() => setNumDays(14)}>14d</button>
        </div>
      </div>

      <div ref={attachScrollRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative" style={{ width: gridW, minHeight: chartMinH }}>
          {/* Header row */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50">
            <div className="shrink-0 border-r border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500" style={{ width: LABEL_W }}>
              Room
            </div>
            {dateCols.map((d, i) => {
              const ds = toDS(d);
              const isToday = ds === todayStr;
              return (
                <div key={i}
                  className={cn(
                    'shrink-0 border-r border-slate-200 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider',
                    isToday ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'
                  )}
                  style={{ width: cellW }}>
                  <div>{dayLabel(d)}</div>
                  <div className="mt-0.5 text-[10px] font-bold text-slate-700">{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {groups.map(g => (
            <div key={g.type}>
              <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 border-b border-slate-200">
                {g.type} · {g.rooms.length}
              </div>
              {g.rooms.map(room => {
                const rSlots = enrichedBarsByRoom[room.number] || [];
                return (
                  <div key={room.id} className="relative flex border-b border-slate-100" style={{ height: CELL_H }}>
                    <div className="shrink-0 border-r border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-bold text-slate-700" style={{ width: LABEL_W }}>
                      {room.number}
                    </div>
                    {dateCols.map((d, i) => (
                      <div key={i} className="shrink-0 border-r border-slate-100" style={{ width: cellW }} />
                    ))}

                    {rSlots.map(bar => {
                      const ci = dateStr(bar.startDate);
                      const co = dateStr(bar.endDate);
                      const unClampedStartOff = diffDays(winStartStr, ci);
                      const unClampedEndOff = diffDays(winStartStr, co);
                      const visStartOff = Math.max(0, unClampedStartOff);
                      const visEndOff = Math.min(numDays, unClampedEndOff);
                      if (visEndOff <= 0 || visStartOff >= numDays) return null;
                      const leftPx = LABEL_W + visStartOff * cellW + 2;
                      const widthPx = (visEndOff - visStartOff) * cellW - 4;
                      if (widthPx <= 0) return null;
                      const bleedsLeft = unClampedStartOff < 0;
                      const bleedsRight = unClampedEndOff > numDays;
                      const sc = STATUS_COLORS[bar.status] || STATUS_COLORS.PENDING;
                      const tint = tintForReservation(bar.reservationId);
                      const isHighlighted = hoverGroup && bar.reservationId === hoverGroup;
                      return (
                        <div
                          key={`${bar.bookingId}-${bar.startDate}`}
                          onMouseEnter={() => bar.reservationId && setHoverGroup(bar.reservationId)}
                          onMouseLeave={() => setHoverGroup(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (bar.reservationId) onOpenReservation(bar.reservationId);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setCtx({ x: e.clientX, y: e.clientY, bar });
                          }}
                          className={cn(
                            'absolute flex items-center px-2 cursor-pointer overflow-hidden shadow-sm transition-all hover:shadow-md hover:brightness-95',
                            bar.isGhost ? 'border-2 border-dashed opacity-80' : 'border',
                            tint && `${tint.split(' ')[0]} ${isHighlighted ? 'ring-2 ' + tint.split(' ')[1] : ''}`,
                            bleedsLeft && bleedsRight ? 'rounded-none' :
                            bleedsLeft ? 'rounded-r-md rounded-l-none' :
                            bleedsRight ? 'rounded-l-md rounded-r-none' :
                            'rounded-md',
                            sc.bar, sc.text,
                          )}
                          style={{ left: leftPx, width: widthPx, height: CELL_H - 8, top: 4, zIndex: 5 }}
                          title={`${bar.guestName || 'Guest'} • ${bar.status.replace('_', ' ')} • ${ci} → ${co}${bar.isGhost ? ' (unassigned — click to view, right-click to pin)' : ''}${bar.groupReference ? ` • Group: ${bar.groupReference}` : ''}`}
                        >
                          <span className="text-[11px] font-bold truncate">{bar.guestName || 'Guest'}</span>
                          {bar.groupReference && <span className="ml-2 shrink-0 text-[9px] opacity-70">⚑ {bar.groupReference}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Context menu */}
      {ctx && (
        <div ref={ctxRef} className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg" style={{ left: ctx.x, top: ctx.y }}>
          <ul className="py-1 text-sm">
            {ctx.bar.reservationId && (
              <li><button type="button"
                className="w-full px-4 py-2 text-left hover:bg-slate-50"
                onClick={() => { onOpenReservation(ctx.bar.reservationId!); setCtx(null); }}
              >◉ View Reservation</button></li>
            )}
            {ctx.bar.isGhost && (
              <li><button type="button"
                className="w-full px-4 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  const meta = bookingMeta.get(ctx.bar.bookingId);
                  if (meta) {
                    onAssignRoom({ id: ctx.bar.bookingId, unitId: meta.unitId, checkIn: meta.checkIn, checkOut: meta.checkOut });
                  } else {
                    // Fallback: use the bar's own dates and look up unit from refetch.
                    bookingApi.getById(propertyId, ctx.bar.bookingId).then(b => {
                      if (b?.id && b.unitId) {
                        onAssignRoom({ id: b.id, unitId: b.unitId, checkIn: b.checkIn, checkOut: b.checkOut });
                      }
                    });
                  }
                  setCtx(null);
                }}
              >⊕ Assign Room…</button></li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
