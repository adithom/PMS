// src/pages/Bookings.tsx — Gantt-chart tape chart (v3 — matched to BookingDto)
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import propertyApi from '../api/propertyApi';
import roomApi from '../api/roomApi';
import bookingApi from '../api/bookingApi';
import availabilityApi from '../api/availabilityApi';
import BookingForm from '../components/BookingForm';
import BookingsList from '../components/BookingsList';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Property, Room, Booking } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Design Tokens                                                */
/* ────────────────────────────────────────────────────────────── */

const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/* ────────────────────────────────────────────────────────────── */
/* Constants                                                    */
/* ────────────────────────────────────────────────────────────── */

const CELL_W = 110;
const CELL_H = 40;
const LABEL_W = 160;
const MIN_CHART_ROWS = 18; // Ensures chart fills viewport even with few rooms

// Buffer: fetch extra days before/after for smooth scroll
const BUFFER_BEFORE = 15;
const BUFFER_AFTER = 16;
const REFETCH_THRESHOLD = 3;
const NAV_DEBOUNCE_MS = 300;
const SCROLL_EDGE_PX = 80; // Trigger edge-scroll when within this many px of edge
const SCROLL_COOLDOWN_MS = 600; // Prevent rapid fire edge-scroll
const SCROLL_STEP_DAYS = 2; // How many days to advance per edge-scroll trigger

/*
 * Light, translucent status colors matched to BookingDto.status enum:
 * PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
 */
const STATUS_COLORS: Record<string, { bar: string; text: string; label: string; legend: string }> = {
  CONFIRMED:   { bar: 'bg-blue-200/70',    text: 'text-blue-900',     legend: 'bg-blue-300',    label: 'Confirmed' },
  CHECKED_IN:  { bar: 'bg-green-200/70',   text: 'text-green-900',    legend: 'bg-green-300',   label: 'Checked In' },
  PENDING:     { bar: 'bg-amber-200/70',   text: 'text-amber-900',    legend: 'bg-amber-300',   label: 'Pending' },
  CHECKED_OUT: { bar: 'bg-slate-200/70',   text: 'text-slate-700',    legend: 'bg-slate-300',   label: 'Checked Out' },
  CANCELLED:   { bar: 'bg-gray-200/50',    text: 'text-gray-500',     legend: 'bg-gray-300',    label: 'Cancelled' },
  NO_SHOW:     { bar: 'bg-red-200/60',     text: 'text-red-800',      legend: 'bg-red-300',     label: 'No Show' },
};

/* ────────────────────────────────────────────────────────────── */
/* Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

const toDS = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const addDays = (d: Date, n: number): Date => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const diffDays = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
const getRoomId = (room: Room): string => (room as any).roomId ?? (room as any).id ?? '';
const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

/**
 * Extract the date string from a BookingDto date field.
 * The backend sends LocalDate as "yyyy-MM-dd" (no T).
 * But just in case there's a timestamp, strip it.
 */
const dateStr = (v: string): string => v.split('T')[0];

type StatType = 'incoming' | 'inhouse' | 'checkouts' | 'all';

/* ────────────────────────────────────────────────────────────── */
/* ModalShell                                                   */
/* ────────────────────────────────────────────────────────────── */

function ModalShell({ title, subtitle, size = 'regular', children, onClose }: {
  title: string; subtitle?: string; size?: 'regular' | 'wide'; children: ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cn('w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl', size === 'wide' ? 'max-w-5xl' : 'max-w-lg')} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Context Menu                                                  */
/* ────────────────────────────────────────────────────────────── */

type CtxState = { x: number; y: number; booking: Booking } | null;

function CtxMenu({ state, propertyId, onClose, onAction }: {
  state: CtxState; propertyId: string; onClose: () => void; onAction: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
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
        acts.push({ label: '✓ Confirm Booking', doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'CONFIRMED'); onAction(); } });
        acts.push({ label: '✕ Cancel Booking', doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'CANCELLED'); onAction(); }, danger: true });
        break;
      case 'CONFIRMED':
        acts.push({ label: '✓ Check-in Guest', doFn: async () => { await bookingApi.checkIn(propertyId, booking.id!); onAction(); } });
        acts.push({ label: '⊘ Mark No Show', doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'NO_SHOW'); onAction(); }, danger: true });
        break;
      case 'CHECKED_IN':
        acts.push({ label: '⏎ Check-out Guest', doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'CHECKED_OUT'); onAction(); } });
        break;
      // CHECKED_OUT, CANCELLED, NO_SHOW → no actions
    }
  }

  return (
    <div ref={ref} className="fixed z-[60] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 300) }}>
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-bold text-slate-900 truncate">{guestName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', sc.bar, sc.text)}>{booking.status.replace('_', ' ')}</span>
          <span className="text-[11px] text-slate-400">Room {booking.roomNumber || '—'}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {dateStr(booking.checkIn)} → {dateStr(booking.checkOut)}
        </p>
      </div>
      <div className="py-1">
        {acts.length === 0 && <p className="px-4 py-2 text-xs text-slate-400">No actions available</p>}
        {acts.map(a => (
          <button key={a.label} type="button"
            className={cn('w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50', a.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700')}
            onClick={async () => { await a.doFn(); onClose(); }}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Drag Overlay                                                  */
/* ────────────────────────────────────────────────────────────── */

function DragOverlay({ drag }: {
  drag: { rid: string; startCol: number; endCol: number; rowTop: number } | null;
}) {
  if (!drag) return null;
  const from = Math.min(drag.startCol, drag.endCol);
  const to = Math.max(drag.startCol, drag.endCol);
  const left = LABEL_W + from * CELL_W;
  const width = (to - from + 1) * CELL_W;
  return (
    <div className="pointer-events-none absolute z-[15] rounded border-2 border-blue-400 bg-blue-100/40"
      style={{ left, top: drag.rowTop, width, height: CELL_H }} />
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Bookings() {
  // ── Property / Rooms
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);

  // ── Date window
  const [numDays, setNumDays] = useState(14);
  const [winStart, setWinStart] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const dateCols = useMemo(() => Array.from({ length: numDays }, (_, i) => addDays(winStart, i)), [winStart, numDays]);
  const winStartStr = useMemo(() => toDS(winStart), [winStart]);
  const winEndStr = useMemo(() => toDS(addDays(winStart, numDays - 1)), [winStart, numDays]);
  const todayStr = useMemo(() => toDS(new Date()), []);

  // ── Bookings buffer (overscroll strategy)
  const [bookingBuffer, setBookingBuffer] = useState<Booking[]>([]);
  const [bufferRange, setBufferRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);

  const rangeBookings = useMemo(() => {
    if (!bufferRange) return [];
    return bookingBuffer;
  }, [bookingBuffer, bufferRange]);

  // ── Occupancy buffer
  const [occMap, setOccMap] = useState<Record<string, number>>({});

  // ── Daily stats
  const [inCount, setInCount] = useState(0);
  const [houseCount, setHouseCount] = useState(0);
  const [outCount, setOutCount] = useState(0);

  // ── UI
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<CtxState>(null);
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [listType, setListType] = useState<StatType>('all');
  const [pfRoom, setPfRoom] = useState<Room | null>(null);

  // ── Drag state
  const [drag, setDrag] = useState<{ rid: string; startCol: number; endCol: number; rowTop: number } | null>(null);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Prefill dates
  const prefillCheckIn = useRef('');
  const prefillCheckOut = useRef('');

  // ── Debounce
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchIdRef = useRef(0);

  /* ── Load properties ── */
  useEffect(() => {
    (async () => {
      try {
        const ps = await propertyApi.getAll();
        setProperties(ps || []);
        if (ps?.length) setSelectedPropId(ps[0].id);
      } catch (e) { console.error(e); }
    })();
  }, []);

  /* ── Load rooms ── */
  useEffect(() => {
    if (!selectedPropId) return;
    (async () => {
      try {
        const rs = await roomApi.getByProperty(selectedPropId);
        const sorted = (rs || []).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));
        setRooms(sorted);
        const prop = properties.find(p => p.id === selectedPropId);
        setTotalRooms(prop?.totalRooms ?? sorted.length);
      } catch (e) { console.error(e); }
    })();
  }, [selectedPropId, properties]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Buffered data loading                                      */
  /* ═══════════════════════════════════════════════════════════ */

  const fetchBuffer = useCallback(async (propId: string, visStart: string, visEnd: string, immediate = false) => {
    const bufFrom = toDS(addDays(new Date(visStart + 'T00:00:00'), -BUFFER_BEFORE));
    const bufTo = toDS(addDays(new Date(visEnd + 'T00:00:00'), BUFFER_AFTER));

    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);

    const doFetch = async () => {
      const id = ++fetchIdRef.current;
      setLoading(true);
      try {
        const [bks, daily] = await Promise.all([
          bookingApi.getRange(propId, bufFrom, bufTo),
          availabilityApi.getDailyAvailability(propId, bufFrom, bufTo).catch(() => []),
        ]);
        if (id !== fetchIdRef.current) return;
        setBookingBuffer(bks);
        setBufferRange({ from: bufFrom, to: bufTo });
        const m: Record<string, number> = {};
        daily.forEach(d => { m[d.date] = d.occupancyRate; });
        setOccMap(m);
      } catch {
        if (id !== fetchIdRef.current) return;
        setBookingBuffer([]);
        setBufferRange({ from: bufFrom, to: bufTo });
        setOccMap({});
      } finally {
        if (id === fetchIdRef.current) setLoading(false);
      }
    };

    if (immediate) { await doFetch(); }
    else { fetchTimerRef.current = setTimeout(doFetch, NAV_DEBOUNCE_MS); }
  }, []);

  useEffect(() => () => { if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current); }, []);

  useEffect(() => {
    if (!selectedPropId) return;
    if (!bufferRange) { fetchBuffer(selectedPropId, winStartStr, winEndStr, true); return; }
    const dL = diffDays(bufferRange.from, winStartStr);
    const dR = diffDays(winEndStr, bufferRange.to);
    if (dL < REFETCH_THRESHOLD || dR < REFETCH_THRESHOLD) {
      fetchBuffer(selectedPropId, winStartStr, winEndStr);
    }
  }, [selectedPropId, winStartStr, winEndStr, bufferRange, fetchBuffer]);

  useEffect(() => { setBufferRange(null); }, [selectedPropId]);

  /* ── Daily stats ── */
  useEffect(() => {
    if (!selectedPropId) return;
    const ds = toDS(selectedDate);
    (async () => {
      try {
        const bks = await bookingApi.getByDate(selectedPropId, ds, true);
        setDayBookings(bks || []);
        setInCount(bks.filter(b => dateStr(b.checkIn) === ds && b.status === 'CONFIRMED').length);
        setHouseCount(bks.filter(b => b.status === 'CHECKED_IN' && ds >= dateStr(b.checkIn) && ds < dateStr(b.checkOut)).length);
        setOutCount(bks.filter(b => dateStr(b.checkOut) === ds && (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT')).length);
      } catch { setDayBookings([]); setInCount(0); setHouseCount(0); setOutCount(0); }
    })();
  }, [selectedPropId, selectedDate]);

  /* ── Grouped rooms ── */
  const groups = useMemo(() => {
    const m = new Map<string, Room[]>();
    for (const r of rooms) { const t = r.type || 'Standard'; if (!m.has(t)) m.set(t, []); m.get(t)!.push(r); }
    return Array.from(m.entries()).map(([type, rms]) => ({ type, rooms: rms }));
  }, [rooms]);

  /* ── Bookings by room NUMBER (matches BookingDto.roomNumber → Room.number) ── */
  const byRoomNumber = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    for (const b of rangeBookings) {
      // BookingDto has roomNumber (e.g. "101"), NOT roomId.
      const rn = b.roomNumber || '';
      if (rn) { (m[rn] ??= []).push(b); }
    }
    return m;
  }, [rangeBookings]);

  /* ── Handlers ── */
  const toggle = useCallback((t: string) => setCollapsed(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }), []);
  const openForm = useCallback((room: Room | null, ci: string, co: string) => {
    setPfRoom(room); prefillCheckIn.current = ci; prefillCheckOut.current = co; setShowForm(true);
  }, []);
  const navigate = useCallback((off: number) => setWinStart(p => addDays(p, off)), []);
  const goToday = useCallback(() => { const d = new Date(); d.setHours(0, 0, 0, 0); setWinStart(d); setSelectedDate(new Date()); }, []);
  const refresh = useCallback(async () => {
    if (!selectedPropId) return;
    await fetchBuffer(selectedPropId, winStartStr, winEndStr, true);
  }, [selectedPropId, winStartStr, winEndStr, fetchBuffer]);
  const statClick = useCallback((t: StatType) => { setListType(t); setShowList(true); }, []);

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((rid: string, col: number, rowTop: number) => {
    dragging.current = true; setDrag({ rid, startCol: col, endCol: col, rowTop });
  }, []);
  const handleDragMove = useCallback((rid: string, col: number) => {
    if (!dragging.current) return;
    setDrag(p => { if (!p || p.rid !== rid || p.endCol === col) return p; return { ...p, endCol: col }; });
  }, []);
  const handleDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDrag(prev => {
      if (!prev) return null;
      const { rid, startCol, endCol } = prev;
      const from = Math.min(startCol, endCol), to = Math.max(startCol, endCol);
      const room = rooms.find(r => getRoomId(r) === rid);
      if (room && to > from) setTimeout(() => openForm(room, toDS(dateCols[from]), toDS(addDays(dateCols[to], 1))), 0);
      return null;
    });
  }, [rooms, dateCols, openForm]);

  /* ── Scroll-based edge navigation (with cooldown) ── */
  const scrollCooldownRef = useRef(false);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || scrollCooldownRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    let step = 0;
    if (scrollWidth - scrollLeft - clientWidth < SCROLL_EDGE_PX) step = SCROLL_STEP_DAYS;
    else if (scrollLeft < SCROLL_EDGE_PX) step = -SCROLL_STEP_DAYS;
    if (step !== 0) {
      scrollCooldownRef.current = true;
      navigate(step);
      setTimeout(() => { scrollCooldownRef.current = false; }, SCROLL_COOLDOWN_MS);
    }
  }, [navigate]);

  const getFiltered = useCallback((): Booking[] => {
    const ds = toDS(selectedDate);
    switch (listType) {
      case 'incoming': return dayBookings.filter(b => dateStr(b.checkIn) === ds && b.status === 'CONFIRMED');
      case 'inhouse': return dayBookings.filter(b => b.status === 'CHECKED_IN' && ds >= dateStr(b.checkIn) && ds < dateStr(b.checkOut));
      case 'checkouts': return dayBookings.filter(b => dateStr(b.checkOut) === ds && (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT'));
      default: return dayBookings;
    }
  }, [selectedDate, listType, dayBookings]);

  const occRate = totalRooms > 0 ? (houseCount / totalRooms) * 100 : 0;

  // How many visible room rows (for min-height)
  const visibleRoomCount = useMemo(() => {
    let count = 0;
    for (const g of groups) {
      count++; // group header
      if (!collapsed.has(g.type)) count += g.rooms.length;
    }
    return count;
  }, [groups, collapsed]);

  /* ── Loading screen ── */
  if (loading && rooms.length === 0) {
    return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50"><LoadingSpinner text="Loading tape chart…" /></div>;
  }

  const gridW = LABEL_W + numDays * CELL_W;
  // Ensure chart fills viewport even with few rooms
  const chartMinH = Math.max(visibleRoomCount, MIN_CHART_ROWS) * CELL_H + 70; // +70 for header row

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      <div className="mx-auto max-w-[1800px] px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Header ─── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Front Desk</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Tape Chart</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Property</span>
              <select value={selectedPropId ?? ''} onChange={e => setSelectedPropId(e.target.value || null)}
                className="border-none bg-transparent text-sm font-semibold text-slate-900 outline-none">
                {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <button type="button" className={btnPrimary} onClick={() => openForm(null, '', '')}>+ Create Booking</button>
          </div>
        </div>

        {/* ─── Top Date Nav ─── */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button type="button" className={btnSecondary} onClick={() => navigate(-numDays)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Prev
            </button>
            <button type="button" className={btnSecondary} onClick={goToday}>Today</button>
            <button type="button" className={btnSecondary} onClick={() => navigate(numDays)}>
              Next
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
          </div>
          <span className="text-sm font-semibold text-slate-600">{shortDate(winStart)} — {shortDate(addDays(winStart, numDays - 1))}</span>
          {loading && <span className="text-xs text-slate-400 animate-pulse">Refreshing…</span>}
        </div>

        {/* ─── Main: Grid + Sidebar ─── */}
        <div className="mt-6 flex gap-6">

          {/* ─── Gantt Grid (flex column so bottom bar sticks) ─── */}
          <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* Scrollable area — tall to fill viewport */}
            <div ref={scrollRef}
              className="relative flex-1 overflow-auto"
              style={{ minHeight: chartMinH, maxHeight: 'calc(100vh - 300px)' }}
              onMouseUp={handleDragEnd}
              onMouseLeave={() => { if (dragging.current) handleDragEnd(); }}
              onScroll={handleScroll}>

              <DragOverlay drag={drag} />

              <div style={{ minWidth: gridW, minHeight: chartMinH }}>

                {/* ─── Header Row ─── */}
                <div className="sticky top-0 z-20 flex" style={{ minWidth: gridW }}>
                  <div className="sticky left-0 z-30 flex items-end border-b border-r border-slate-200 bg-slate-50 px-4 py-2"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rooms</span>
                  </div>
                  {dateCols.map(d => {
                    const ds = toDS(d);
                    const isT = ds === todayStr;
                    const isSel = ds === toDS(selectedDate);
                    const occ = occMap[ds];
                    return (
                      <div key={ds} style={{ width: CELL_W, minWidth: CELL_W }}
                        className={cn('flex flex-col items-center justify-end border-b border-r border-slate-200 px-1 pb-1 pt-2 cursor-pointer transition-colors',
                          isT && 'bg-blue-50/80', isSel && !isT && 'bg-emerald-50/60', !isT && !isSel && 'bg-slate-50')}
                        onClick={() => setSelectedDate(d)}>
                        <span className={cn('text-[10px] font-semibold', isT ? 'text-blue-600' : 'text-slate-400')}>{dayLabel(d)}</span>
                        <span className={cn('text-sm font-bold', isT ? 'text-blue-700' : 'text-slate-700')}>{d.getDate()}</span>
                        <span className="text-[9px] text-slate-400">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                        {occ !== undefined && (
                          <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all',
                              occ >= 90 ? 'bg-rose-500' : occ >= 70 ? 'bg-amber-400' : occ >= 40 ? 'bg-emerald-400' : 'bg-emerald-300')}
                              style={{ width: `${Math.min(occ, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ─── Data Rows ─── */}
                {groups.map(g => {
                  const isC = collapsed.has(g.type);
                  return (
                    <div key={g.type}>
                      {/* Group header */}
                      <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2 cursor-pointer select-none"
                        style={{ minWidth: gridW }} onClick={() => toggle(g.type)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', !isC && 'rotate-90')}
                          viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.type}</span>
                        <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{g.rooms.length}</span>
                      </div>

                      {/* Room rows */}
                      {!isC && g.rooms.map(room => {
                        const rid = getRoomId(room);
                        // KEY FIX: BookingDto has roomNumber (e.g. "101"), not roomId (UUID).
                        // Match by room.number which is what the backend sends.
                        const rBks = byRoomNumber[room.number] || [];

                        return (
                          <div key={rid || room.number} className="relative flex" style={{ height: CELL_H, minWidth: gridW }}>
                            {/* Room label */}
                            <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r border-slate-200 bg-white px-4"
                              style={{ width: LABEL_W, minWidth: LABEL_W, height: CELL_H }}>
                              <span className="text-sm font-bold text-slate-800">{room.number}</span>
                              <span className="text-[10px] text-slate-400 truncate">{room.type || ''}</span>
                            </div>

                            {/* Date cells */}
                            {dateCols.map((d, ci) => {
                              const ds = toDS(d);
                              const isT = ds === todayStr;
                              return (
                                <div key={ds}
                                  className={cn('border-b border-r border-slate-100 transition-colors',
                                    isT && 'bg-blue-50/30', !isT && 'hover:bg-slate-50/80')}
                                  style={{ width: CELL_W, minWidth: CELL_W, height: CELL_H }}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const scrollRect = scrollRef.current?.getBoundingClientRect();
                                    const scrollTop = scrollRef.current?.scrollTop ?? 0;
                                    const rowTop = rect.top - (scrollRect?.top ?? 0) + scrollTop;
                                    handleDragStart(rid || room.number, ci, rowTop);
                                  }}
                                  onMouseEnter={() => handleDragMove(rid || room.number, ci)}
                                  onClick={() => {
                                    if (!dragging.current && !drag) openForm(room, toDS(d), toDS(addDays(d, 1)));
                                  }}
                                />
                              );
                            })}

                            {/* ─── Booking bars ─── */}
                            {rBks.map(bk => {
                              const ci = dateStr(bk.checkIn);
                              const co = dateStr(bk.checkOut);

                              // Clamp to visible window
                              const clampedStart = ci < winStartStr ? winStartStr : ci;
                              const clampedEnd = co > toDS(addDays(winStart, numDays)) ? toDS(addDays(winStart, numDays)) : co;

                              const startOff = diffDays(winStartStr, clampedStart);
                              const endOff = diffDays(winStartStr, clampedEnd);
                              if (endOff <= 0 || startOff >= numDays) return null;

                              const leftPx = LABEL_W + startOff * CELL_W + 2;
                              const widthPx = (endOff - startOff) * CELL_W - 4;
                              if (widthPx <= 0) return null;

                              const sc = STATUS_COLORS[bk.status] ?? STATUS_COLORS.PENDING;
                              const bleedsLeft = ci < winStartStr;
                              const bleedsRight = co > toDS(addDays(winStart, numDays));
                              const guestName = bk.guestName || 'Guest';

                              return (
                                <div key={bk.id}
                                  className={cn(
                                    'absolute top-[4px] shadow-sm cursor-pointer transition-all hover:shadow-md hover:brightness-95 border',
                                    sc.bar,
                                    // Subtle border for translucent bars
                                    bk.status === 'CHECKED_IN' ? 'border-green-300' :
                                    bk.status === 'CONFIRMED' ? 'border-blue-300' :
                                    bk.status === 'PENDING' ? 'border-amber-300' :
                                    bk.status === 'CANCELLED' ? 'border-gray-300' :
                                    'border-slate-300',
                                    // Clamped border-radius
                                    bleedsLeft && bleedsRight ? 'rounded-none' :
                                    bleedsLeft ? 'rounded-r-md rounded-l-none' :
                                    bleedsRight ? 'rounded-l-md rounded-r-none' :
                                    'rounded-md',
                                  )}
                                  style={{ left: leftPx, width: widthPx, height: CELL_H - 8, zIndex: 5 }}
                                  title={`${guestName} • ${bk.status.replace('_', ' ')} • ${ci} → ${co}`}
                                  onClick={e => { e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, booking: bk }); }}
                                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, booking: bk }); }}>
                                  <div className={cn('flex items-center h-full px-2 overflow-hidden whitespace-nowrap', sc.text)}>
                                    {bleedsLeft && <span className="mr-1 text-[10px] opacity-70">◂</span>}
                                    <span className="text-[11px] font-bold truncate">{guestName}</span>
                                    {bleedsRight && <span className="ml-auto pl-1 text-[10px] opacity-70">▸</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Empty state */}
                {rooms.length === 0 && (
                  <div className="flex items-center justify-center py-20 text-slate-400">
                    <div className="text-center">
                      <p className="text-lg font-semibold">No rooms found</p>
                      <p className="mt-1 text-sm">Select a different property or add rooms first.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Sticky Bottom Controls ─── */}
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 backdrop-blur-sm px-5 py-3">
              {/* View toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">View</span>
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                  <button type="button"
                    className={cn('rounded-md px-3 py-1.5 text-xs font-bold transition-all',
                      numDays === 7 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                    onClick={() => setNumDays(7)}>
                    7 Days
                  </button>
                  <button type="button"
                    className={cn('rounded-md px-3 py-1.5 text-xs font-bold transition-all',
                      numDays === 14 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                    onClick={() => setNumDays(14)}>
                    14 Days
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button type="button" className={btnSecondary + ' !py-1.5 !text-xs'} onClick={() => navigate(-numDays)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Prev {numDays}d
                </button>
                <button type="button" className={btnSecondary + ' !py-1.5 !text-xs'} onClick={goToday}>Today</button>
                <button type="button" className={btnSecondary + ' !py-1.5 !text-xs'} onClick={() => navigate(numDays)}>
                  Next {numDays}d
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ─── Daily Stats Sidebar ─── */}
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {toDS(selectedDate) === todayStr ? 'Today' : 'Selected Date'}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <button type="button" className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left transition-all hover:shadow-md hover:border-amber-300"
              onClick={() => statClick('incoming')}>
              <p className="text-3xl font-extrabold text-amber-900">{inCount}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-700">Arrivals</p>
            </button>

            <button type="button" className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4 text-left transition-all hover:shadow-md hover:border-blue-300"
              onClick={() => statClick('inhouse')}>
              <p className="text-3xl font-extrabold text-blue-900">{houseCount}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-blue-700">In-House</p>
            </button>

            <button type="button" className="w-full rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition-all hover:shadow-md hover:border-rose-300"
              onClick={() => statClick('checkouts')}>
              <p className="text-3xl font-extrabold text-rose-900">{outCount}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-rose-700">Checkouts</p>
            </button>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-3xl font-extrabold text-emerald-900">{Number.isFinite(occRate) ? occRate.toFixed(1) + '%' : '—'}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-emerald-700">Occupancy</p>
              <p className="mt-1 text-[11px] text-emerald-600">{houseCount} / {totalRooms} rooms</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status Legend</p>
              <div className="space-y-2">
                {Object.entries(STATUS_COLORS).map(([s, c]) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn('h-2.5 w-6 rounded', c.legend)} />
                    <span className="text-xs font-medium text-slate-600">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ MODALS ═══════════════════ */}

      {showForm && (
        <ModalShell title="Create Booking" subtitle={pfRoom ? `Room ${pfRoom.number}` : undefined} size="wide" onClose={() => setShowForm(false)}>
          <BookingForm propertyId={selectedPropId} room={pfRoom}
            onSuccess={async () => { setShowForm(false); await refresh(); }}
            onCancel={() => setShowForm(false)} />
        </ModalShell>
      )}

      {showList && selectedPropId && (
        <BookingsList bookings={getFiltered()} propertyId={selectedPropId} listType={listType}
          onClose={() => setShowList(false)} onUpdate={refresh} />
      )}

      {selectedPropId && <CtxMenu state={ctx} propertyId={selectedPropId} onClose={() => setCtx(null)} onAction={refresh} />}
    </div>
  );
}