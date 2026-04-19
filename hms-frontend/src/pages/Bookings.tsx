// src/pages/Bookings.tsx — Gantt-chart tape chart
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import propertyApi from '../api/propertyApi';
import roomApi from '../api/roomApi';
import bookingApi from '../api/bookingApi';
import availabilityApi from '../api/availabilityApi';
import BookingForm from '../components/Booking/BookingForm';
import BookingsList from '../components/Booking/BookingsList';
import GroupBookingModal from '../components/Booking/GroupBookingModal';
import EarlyCheckoutModal from '../components/Booking/EarlyCheckoutModal';
import RoomShiftModal from '../components/Booking/RoomShiftModal';
import TaskListModal from '../components/Booking/TaskListModal';
import BookingFoliosModal from '../components/Booking/BookingFoliosModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ModalShell from '../components/ModalShell';
import ConfirmModal from '../components/ConfirmModal';
import { PlaneLanding, FileText, List, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Property, Room, Booking, RoomAssignmentDto } from '../types';
import { toDS, addDays, diffDays, shortDate, dayLabel, dateStr, fmtDate } from '../utils/dateHelpers';
import { getRoomId } from '../utils/roomHelpers';
import {
  CELL_W, CELL_H, LABEL_W, MIN_CHART_ROWS,
  STATUS_COLORS, cn, btnPrimary, btnSecondary,
} from '../components/Booking/TapeChartConstants';

//todo: fix occupancy rate status bars

type StatType = 'incoming' | 'inhouse' | 'checkouts' | 'all';
type AssignmentSlot = { booking: Booking; assignment: RoomAssignmentDto };

type PendingAction = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'primary';
  doFn: () => Promise<void>;
};

/* ────────────────────────────────────────────────────────────── */
/* Context Menu                                                  */
/* ────────────────────────────────────────────────────────────── */

function CtxMenu({ state, propertyId, onClose, onAction, onEarlyCheckout, onEditBooking, onShiftRoom, onShowFolio }: {
  state: { x: number; y: number; booking: Booking } | null;
  propertyId: string;
  onClose: () => void;
  onAction: () => void;
  onEarlyCheckout: (bookingId: string) => void;
  onEditBooking: (booking: Booking) => void;
  onShiftRoom: (booking: Booking) => void;
  onShowFolio: (bookingId: string, guestName: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  if (!state) return null;
  const { x, y, booking } = state;
  const sc = STATUS_COLORS[booking.status] ?? STATUS_COLORS.PENDING;
  const guestName = booking.guestName || 'Guest';

  type Act = {
    label: string;
    doFn: () => Promise<void>;
    danger?: boolean;
    confirm?: { title: string; message: string; confirmLabel: string };
  };
  const acts: Act[] = [];
  
  if (booking.id) {
    const editableStatuses: Booking['status'][] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];
    if (editableStatuses.includes(booking.status)) {
      acts.push({ label: '✎ Edit Booking', doFn: async () => { onEditBooking(booking); onClose(); } });
    }

    acts.push({ label: '⊞ Show Folio', doFn: async () => { onShowFolio(booking.id!, guestName); onClose(); } });

    switch (booking.status) {
      case 'PENDING':
        acts.push({
          label: '✓ Confirm Booking',
          doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'CONFIRMED'); onAction(); },
          confirm: { title: 'Confirm Booking', message: `Are you sure you want to confirm the booking for ${guestName}?`, confirmLabel: 'Confirm Booking' },
        });
        acts.push({
          label: '✕ Cancel Booking',
          doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'CANCELLED'); onAction(); },
          danger: true,
          confirm: { title: 'Cancel Booking', message: `Are you sure you want to cancel the booking for ${guestName}? This action cannot be undone.`, confirmLabel: 'Cancel Booking' },
        });
        break;
      case 'CONFIRMED':
        acts.push({
          label: '✓ Check-in Guest',
          doFn: async () => { await bookingApi.checkIn(propertyId, booking.id!); onAction(); },
          confirm: { title: 'Confirm Check-in', message: `Are you sure you want to check in ${guestName}?`, confirmLabel: 'Check In' },
        });
        acts.push({
          label: '⊘ Mark No Show',
          doFn: async () => { await bookingApi.updateStatus(propertyId, booking.id!, 'NO_SHOW'); onAction(); },
          danger: true,
          confirm: { title: 'Mark as No Show', message: `Are you sure you want to mark ${guestName} as a no-show?`, confirmLabel: 'Mark No Show' },
        });
        break;
      case 'CHECKED_IN': {
        const outDate = dateStr(booking.checkOut);
        const today = toDS(new Date());

        acts.push({ label: '⇄ Shift Room', doFn: async () => { onShiftRoom(booking); onClose(); } });

        if (today < outDate) {
          acts.push({
            label: '⏱ Early Checkout',
            doFn: async () => { onEarlyCheckout(booking.id!); onClose(); }
          });
        } else {
          acts.push({
            label: '⏎ Check-out Guest',
            doFn: async () => { await bookingApi.checkOut(propertyId, booking.id!); onAction(); },
            confirm: { title: 'Confirm Check-out', message: `Are you sure you want to check out ${guestName}?`, confirmLabel: 'Check Out' },
          });
        }
        break;
      }
    }
  }

  return (
    <>
    {!pendingAction && <div ref={ref} className="fixed z-[60] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 300) }}>
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-bold text-slate-900 truncate">{guestName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase', sc.bar, sc.text)}>{booking.status.replace('_', ' ')}</span>
          <span className="text-[11px] text-slate-400">Room {booking.roomNumber || '—'}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
        </p>
      </div>
      <div className="py-1">
        {acts.length === 0 && <p className="px-4 py-2 text-xs text-slate-400">No actions available</p>}
        {acts.map(a => (
          <button key={a.label} type="button"
            className={cn('w-full px-4 py-2 text-left text-sm transition-colors hover:bg-slate-50', a.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (a.confirm) {
                setPendingAction({
                  title: a.confirm.title,
                  message: a.confirm.message,
                  confirmLabel: a.confirm.confirmLabel,
                  variant: a.danger ? 'danger' : 'primary',
                  doFn: a.doFn,
                });
              } else {
                a.doFn().catch(err => {
                  console.error(`Action "${a.label}" failed:`, err);
                  alert(`Failed to perform action. Check your developer console for details.`);
                });
                onClose();
              }
            }}>
            {a.label}
          </button>
        ))}
      </div>
    </div>}

    {pendingAction && (
      <ConfirmModal
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel={pendingAction.confirmLabel}
        variant={pendingAction.variant}
        loading={confirmLoading}
        onConfirm={async () => {
          setConfirmLoading(true);
          try {
            await pendingAction.doFn();
            setPendingAction(null);
            onClose();
          } catch (err) {
            console.error('Confirm action failed:', err);
            alert('Failed to perform action. Check your developer console for details.');
            setPendingAction(null);
          } finally {
            setConfirmLoading(false);
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Drag Overlay                                                  */
/* ────────────────────────────────────────────────────────────── */

function DragOverlay({ drag, cellW }: { drag: { rid: string; startCol: number; endCol: number; rowTop: number } | null; cellW: number }) {
  if (!drag) return null;
  const from = Math.min(drag.startCol, drag.endCol);
  const to = Math.max(drag.startCol, drag.endCol);
  const left = LABEL_W + from * cellW;
  const width = (to - from + 1) * cellW;
  return (
    <div className="pointer-events-none absolute z-[15] rounded border-2 border-blue-400 bg-blue-100/40"
      style={{ left, top: drag.rowTop, width, height: CELL_H }} />
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Bookings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);

  const [numDays, setNumDays] = useState(7);
  const [winStart, setWinStart] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const dateCols = useMemo(() => Array.from({ length: numDays }, (_, i) => addDays(winStart, i)), [winStart, numDays]);
  const winStartStr = useMemo(() => toDS(winStart), [winStart]);
  const winEndStr = useMemo(() => toDS(addDays(winStart, numDays - 1)), [winStart, numDays]);
  const todayStr = useMemo(() => toDS(new Date()), []);

  const [bookingBuffer, setBookingBuffer] = useState<Booking[]>([]);
  const [bufferRange, setBufferRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedDateStr = useMemo(() => toDS(selectedDate), [selectedDate]);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);

  const rangeBookings = useMemo(() => {
    if (!bufferRange) return [];
    return bookingBuffer;
  }, [bookingBuffer, bufferRange]);

  const [occMap, setOccMap] = useState<Record<string, number>>({});
  const [inCount, setInCount] = useState(0);
  const [houseCount, setHouseCount] = useState(0);
  const [outCount, setOutCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<{ x: number; y: number; booking: Booking } | null>(null);
  
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [shiftRoomBooking, setShiftRoomBooking] = useState<Booking | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [earlyCheckoutBookingId, setEarlyCheckoutBookingId] = useState<string | null>(null);
  const [viewFolioBooking, setViewFolioBooking] = useState<{ id: string; guestName: string } | null>(null);
  const [showList, setShowList] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  
  const [listType, setListType] = useState<StatType>('all');
  const [pfRoom, setPfRoom] = useState<Room | null>(null);

  const [drag, setDrag] = useState<{ rid: string; startCol: number; endCol: number; rowTop: number } | null>(null);
  const dragRef = useRef<{ rid: string; startCol: number; endCol: number; rowTop: number } | null>(null);
  const dragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const cellW = containerWidth > 0 ? Math.max(CELL_W / 2, Math.floor((containerWidth - LABEL_W) / numDays)) : CELL_W;

  const attachScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    roRef.current = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    roRef.current.observe(el);
  }, []);

  const prefillCheckIn = useRef('');
  const prefillCheckOut = useRef('');
  const fetchIdRef = useRef(0);
  const assignmentCacheRef = useRef<Map<string, RoomAssignmentDto[]>>(new Map());
  const [assignmentMap, setAssignmentMap] = useState<Map<string, RoomAssignmentDto[]>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        const ps = await propertyApi.getAll();
        setProperties(ps || []);
        if (ps?.length) setSelectedPropId(ps[0].id);
      } catch (e) { console.error(e); }
    })();
  }, []);

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

  const fetchBuffer = useCallback(async (propId: string, visStart: string, visEnd: string) => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    try {
      const [bks, daily] = await Promise.all([
        bookingApi.getRange(propId, visStart, visEnd),
        availabilityApi.getDailyAvailability(propId, visStart, visEnd).catch(() => []),
      ]);
      if (id !== fetchIdRef.current) return;
      setBookingBuffer(bks);
      setBufferRange({ from: visStart, to: visEnd });

      const cache = assignmentCacheRef.current;
      const newIds = (bks || []).map(b => b.id!).filter(Boolean);
      for (const k of cache.keys()) { if (!newIds.includes(k)) cache.delete(k); }
      const uncached = newIds.filter(bid => !cache.has(bid));
      if (uncached.length > 0) {
        const results = await Promise.allSettled(
          uncached.map(bid =>
            bookingApi.getRoomAssignments(propId, bid).then(a => ({ bid, assignments: a || [] }))
          )
        );
        if (id !== fetchIdRef.current) return;
        for (const r of results) {
          if (r.status === 'fulfilled') cache.set(r.value.bid, r.value.assignments);
        }
      }
      setAssignmentMap(new Map(cache));

      const m: Record<string, number> = {};
      daily.forEach(d => { m[d.date] = d.occupancyRate; });
      setOccMap(m);
    } catch {
      if (id !== fetchIdRef.current) return;
      setBookingBuffer([]);
      setBufferRange({ from: visStart, to: visEnd });
      setOccMap({});
    } finally {
      if (id === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPropId) return;
    fetchBuffer(selectedPropId, winStartStr, winEndStr);
  }, [selectedPropId, winStartStr, winEndStr, fetchBuffer]);

  useEffect(() => { setBufferRange(null); setBookingBuffer([]); }, [selectedPropId]);
  useEffect(() => { assignmentCacheRef.current.clear(); setAssignmentMap(new Map()); }, [selectedPropId]);

  useEffect(() => {
    if (!selectedPropId) return;
    const ds = toDS(selectedDate);
    (async () => {
      try {
        const bks = await bookingApi.getByDate(selectedPropId, ds, true);
        setDayBookings(bks || []);
        const active = (b: Booking) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW';
        setInCount(bks.filter(b => dateStr(b.checkIn) === ds && active(b)).length);
        setHouseCount(bks.filter(b => active(b) && b.status !== 'CHECKED_OUT' && ds >= dateStr(b.checkIn) && ds < dateStr(b.checkOut)).length);
        setOutCount(bks.filter(b => dateStr(b.checkOut) === ds && active(b)).length);
      } catch { setDayBookings([]); setInCount(0); setHouseCount(0); setOutCount(0); }
    })();
  }, [selectedPropId, selectedDate]);

  const groups = useMemo(() => {
    const m = new Map<string, Room[]>();
    for (const r of rooms) { const u = r.unitName || 'Unassigned'; if (!m.has(u)) m.set(u, []); m.get(u)!.push(r); }
    return Array.from(m.entries()).map(([unit, rms]) => ({ type: unit, rooms: rms }));
  }, [rooms]);

  const byRoomNumber = useMemo(() => {
    const m: Record<string, AssignmentSlot[]> = {};
    for (const bk of rangeBookings) {
      const assignments = assignmentMap.get(bk.id!);
      if (assignments && assignments.length > 0) {
        for (const assignment of assignments) {
          if (assignment.status === 'CANCELLED') continue;
          const rn = assignment.roomNumber;
          if (rn) (m[rn] ??= []).push({ booking: bk, assignment });
        }
      } else {
        // Fallback: no assignments fetched — synthesise from booking fields
        const rn = bk.roomNumber || '';
        if (!rn) continue;
        (m[rn] ??= []).push({
          booking: bk,
          assignment: {
            id: `fallback-${bk.id}`,
            bookingId: bk.id!,
            roomId: bk.roomId || '',
            roomNumber: rn,
            unitName: bk.unitName,
            startDate: bk.checkIn,
            endDate: bk.checkOut,
            status: 'ACTIVE',
          },
        });
      }
    }
    return m;
  }, [rangeBookings, assignmentMap]);

  const toggle = useCallback((t: string) => setCollapsed(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; }), []);
  const openForm = useCallback((room: Room | null, ci: string, co: string) => {
    setPfRoom(room); prefillCheckIn.current = ci; prefillCheckOut.current = co; setShowForm(true);
  }, []);
  const navigate = useCallback((off: number) => setWinStart(p => addDays(p, off)), []);
  const goToday = useCallback(() => { const d = new Date(); d.setHours(0, 0, 0, 0); setWinStart(d); setSelectedDate(new Date()); }, []);
  const refresh = useCallback(async () => {
    if (!selectedPropId) return;
    assignmentCacheRef.current.clear();
    await fetchBuffer(selectedPropId, winStartStr, winEndStr);
  }, [selectedPropId, winStartStr, winEndStr, fetchBuffer]);
  const statClick = useCallback((t: StatType) => { setListType(t); setShowList(true); }, []);

  const handleDragStart = useCallback((rid: string, col: number, rowTop: number) => {
    const d = { rid, startCol: col, endCol: col, rowTop };
    console.log('[DRAG] start', d);
    dragging.current = true; dragRef.current = d; setDrag(d);
  }, []);
  const handleDragMove = useCallback((rid: string, col: number) => {
    if (!dragging.current || !dragRef.current) return;
    if (dragRef.current.rid !== rid || dragRef.current.endCol === col) return;
    const updated = { ...dragRef.current, endCol: col };
    console.log('[DRAG] move', { rid, col, updated });
    dragRef.current = updated;
    setDrag(updated);
  }, []);
  const handleDragEnd = useCallback(() => {
    console.log('[DRAG] end called', { isDragging: dragging.current, dragRef: dragRef.current });
    if (!dragging.current) return;
    dragging.current = false;
    const prev = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!prev) return;
    const { rid, startCol, endCol } = prev;
    const from = Math.min(startCol, endCol), to = Math.max(startCol, endCol);
    const room = rooms.find(r => (getRoomId(r) || r.number) === rid);
    console.log('[DRAG] end result', { rid, from, to, roomFound: !!room, roomsCount: rooms.length });
    if (room && to > from) setTimeout(() => openForm(room, toDS(dateCols[from]), toDS(dateCols[to])), 0);
  }, [rooms, dateCols, openForm]);

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

  const visibleRoomCount = useMemo(() => {
    let count = 0;
    for (const g of groups) { count++; if (!collapsed.has(g.type)) count += g.rooms.length; }
    return count;
  }, [groups, collapsed]);

  if (loading && rooms.length === 0) {
    return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50"><LoadingSpinner text="Loading tape chart…" /></div>;
  }

  const gridW = LABEL_W + numDays * cellW;
  const chartMinH = Math.max(visibleRoomCount, MIN_CHART_ROWS) * CELL_H + 70;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      <div className="mx-auto max-w-[1800px] px-8 pt-8 sm:px-12 lg:px-16">
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
            <button type="button" className={btnSecondary} onClick={() => setShowTasksModal(true)}>
              <List className="h-4 w-4 text-emerald-500" />
              Daily Tasks
            </button>
            <button type="button" className={btnSecondary} onClick={() => setShowGroupModal(true)}>
              <Users className="h-4 w-4 text-indigo-500" />
              New Group Block
            </button>
            <button type="button" className={btnPrimary} onClick={() => openForm(null, '', '')}>
              + New Booking
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-6">
          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" className={btnSecondary} onClick={() => navigate(-numDays)}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button type="button" className={btnSecondary} onClick={goToday}>Today</button>
              <button type="button" className={btnSecondary} onClick={() => navigate(numDays)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm font-semibold text-slate-600">{shortDate(winStart)} — {shortDate(addDays(winStart, numDays - 1))}</span>
            {loading && <span className="text-xs text-slate-400 animate-pulse">Refreshing…</span>}
            <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button type="button"
                className={cn('rounded-lg px-4 py-1.5 text-xs font-bold transition-all',
                  numDays === 7 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}
                onClick={() => setNumDays(7)}>
                7d
              </button>
              <button type="button"
                className={cn('rounded-lg px-4 py-1.5 text-xs font-bold transition-all',
                  numDays === 14 ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}
                onClick={() => setNumDays(14)}>
                14d
              </button>
            </div>
          </div>
          <div className="hidden lg:block w-72 shrink-0" />
        </div>

        <div className="mt-6 flex gap-6">
          <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div ref={attachScrollRef}
              className="relative flex-1 overflow-y-auto"
              style={{ minHeight: chartMinH, maxHeight: 'calc(100vh - 300px)' }}
              onMouseUp={handleDragEnd}
              onMouseLeave={() => { if (dragging.current) handleDragEnd(); }}>

              <DragOverlay drag={drag} cellW={cellW} />

              <div style={{ minWidth: gridW, minHeight: chartMinH }}>
                <div className="sticky top-0 z-20 flex" style={{ minWidth: gridW }}>
                  <div className="sticky left-0 z-30 flex items-end border-b border-r border-slate-200 bg-slate-50 px-4 py-2"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rooms</span>
                  </div>
                  {dateCols.map(d => {
                    const ds = toDS(d);
                    const isT = ds === todayStr;
                    const isSel = ds === selectedDateStr;
                    const occ = occMap[ds];
                    return (
                      <div key={ds} style={{ width: cellW, minWidth: cellW }}
                        className={cn('flex flex-col items-center justify-end border-b border-r border-slate-200 px-1 pb-1 pt-2 cursor-pointer transition-colors',
                          isT && 'bg-blue-100', isSel && !isT && 'bg-blue-100 shadow-[inset_2px_0_0_0_#93c5fd,inset_-2px_0_0_0_#93c5fd]', !isT && !isSel && 'bg-slate-50')}
                        onClick={() => setSelectedDate(d)}>
                        <span className={cn('text-[10px] font-semibold', isT ? 'text-blue-600' : 'text-slate-400')}>{dayLabel(d)}</span>
                        <span className={cn('text-sm font-bold', isT ? 'text-blue-700' : 'text-slate-700')}>{d.getDate()}</span>
                        <span className="text-[9px] text-slate-400">{d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short' })}</span>
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

                {groups.map(g => {
                  const isC = collapsed.has(g.type);
                  return (
                    <div key={g.type}>
                      <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2 cursor-pointer select-none"
                        style={{ minWidth: gridW }} onClick={() => toggle(g.type)}>
                        <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', !isC && 'rotate-90')} />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.type}</span>
                        <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{g.rooms.length}</span>
                      </div>

                      {!isC && g.rooms.map(room => {
                        const rid = getRoomId(room);
                        const rSlots = byRoomNumber[room.number] || [];

                        return (
                          <div key={rid || room.number} className="relative flex" style={{ height: CELL_H, minWidth: gridW }}>
                            <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r border-slate-200 bg-white px-4"
                              style={{ width: LABEL_W, minWidth: LABEL_W, height: CELL_H }}>
                              <span className="text-sm font-bold text-slate-800">{room.number}</span>
                              <span className="text-[10px] text-slate-400 truncate">{room.type || ''}</span>
                            </div>

                            {dateCols.map((d, ci) => {
                              const ds = toDS(d);
                              const isT = ds === todayStr;
                              const isSel = ds === selectedDateStr;
                              return (
                                <div key={ds}
                                  className={cn('border-b border-r border-slate-100 transition-colors',
                                    isT && 'bg-blue-50/30',
                                    isSel && !isT && 'bg-blue-50/70 shadow-[inset_2px_0_0_0_#93c5fd,inset_-2px_0_0_0_#93c5fd]',
                                    !isT && !isSel && 'hover:bg-slate-50/80')}
                                  style={{ width: cellW, minWidth: cellW, height: CELL_H }}
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

                            {rSlots.map(slot => {
                              const { booking: bk, assignment } = slot;
                              const ci = dateStr(assignment.startDate);
                              const co = dateStr(assignment.endDate);
                              const isNoShow = bk.status === 'NO_SHOW';
                              const allAssignments = assignmentMap.get(bk.id!) || [];
                              const isShifted = allAssignments.filter(a => a.status !== 'CANCELLED').length > 1;
                              const isCompleted = assignment.status === 'COMPLETED';
                              const isShiftedIn = isShifted && !isCompleted;

                              const unClampedStartOff = diffDays(winStartStr, ci);
                              const unClampedEndOff = diffDays(winStartStr, co);
                              
                              const unClampedTotalEndOff = unClampedEndOff + 1;

                              // Visual start/end constrained to the visible 0..numDays window
                              const visStartOff = Math.max(0, unClampedStartOff);
                              
                              // NO_SHOW is forced to exactly 0.5 cells wide.
                              const visEndOff = Math.min(numDays, isNoShow ? unClampedStartOff + 0.5 : unClampedTotalEndOff);

                              if (visEndOff <= 0 || visStartOff >= numDays) return null;

                              const leftPx = LABEL_W + visStartOff * cellW + 2;
                              const widthPx = (visEndOff - visStartOff) * cellW - 4;
                              if (widthPx <= 0) return null;

                              const bleedsLeft = unClampedStartOff < 0;
                              const bleedsRight = isNoShow ? false : (unClampedTotalEndOff > numDays);
                              const bookingBleedsRight = unClampedEndOff + 1 > numDays;

                              const sc = STATUS_COLORS[bk.status] ?? STATUS_COLORS.PENDING;
                              const guestName = bk.guestName || 'Guest';

                              return (
                                <div key={assignment.id}
                                  className={cn(
                                    'absolute flex overflow-hidden shadow-sm cursor-pointer transition-all hover:shadow-md hover:brightness-95 border',
                                    isNoShow ? 'bg-rose-100 border-rose-300' : 'bg-white',
                                    bk.status === 'CHECKED_IN' ? 'border-green-300' :
                                    bk.status === 'CONFIRMED' ? 'border-blue-300' :
                                    bk.status === 'PENDING' ? 'border-amber-300' :
                                    bk.status === 'CANCELLED' ? 'border-gray-300' :
                                    'border-slate-300',
                                    bleedsLeft && bleedsRight ? 'rounded-none' :
                                    bleedsLeft ? 'rounded-r-md rounded-l-none' :
                                    bleedsRight ? 'rounded-l-md rounded-r-none' :
                                    'rounded-md',
                                    isShifted && isCompleted && 'opacity-75',
                                  )}
                                  style={{
                                    left: leftPx,
                                    width: widthPx,
                                    height: isNoShow ? CELL_H - 16 : CELL_H - 8,
                                    top: isNoShow ? 8 : 4,
                                    zIndex: isNoShow ? 4 : 5
                                  }}
                                  title={(() => {
                                    const base = `${guestName} • ${bk.status.replace('_', ' ')} • ${ci} → ${co}`;
                                    const allA = assignmentMap.get(bk.id!) || [];
                                    if (isCompleted) {
                                      const next = allA.find(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
                                      return next ? `${base} (Continued in Room ${next.roomNumber})` : base;
                                    }
                                    if (isShiftedIn) {
                                      const prev = allA.find(a => a.status === 'COMPLETED');
                                      return prev ? `${base} (Moved from Room ${prev.roomNumber})` : base;
                                    }
                                    return base;
                                  })()}
                                  onClick={e => { e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, booking: bk }); }}
                                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, booking: bk }); }}>

                                  {/* NO SHOW View */}
                                  {isNoShow && (
                                    <div className={cn('flex w-full items-center justify-center h-full', sc.text, sc.bar)}>
                                      <span className="text-[9px] font-bold">NO SHOW</span>
                                    </div>
                                  )}

                                  {/* Guest Stay */}
                                  {!isNoShow && (
                                    <div style={{ width: widthPx }}
                                         className={cn("h-full flex items-center px-2 gap-0.5 relative shrink-0", sc.bar, sc.text)}>
                                      {bleedsLeft
                                        ? <span className="text-[10px] opacity-70 shrink-0">◂</span>
                                        : <PlaneLanding className="w-[11px] h-[11px] shrink-0 opacity-80" title="Arrival" />
                                      }
                                      {isShiftedIn && !bleedsLeft && (
                                        <span className="text-[10px] opacity-75 shrink-0" title="Moved from another room">↩</span>
                                      )}
                                      <span className="text-[11px] font-bold truncate flex-1 min-w-0">{guestName}</span>
                                      {bk.specialRequests && (
                                        <FileText className="w-[10px] h-[10px] shrink-0 opacity-75" title={bk.specialRequests} />
                                      )}
                                      {bookingBleedsRight && <span className="text-[10px] opacity-70 shrink-0">▸</span>}
                                      {isShifted && isCompleted && !bookingBleedsRight && (
                                        <span className="text-[10px] opacity-75 shrink-0" title="Continued in another room">▶</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {selectedDateStr === todayStr ? 'Today' : 'Selected Date'}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {selectedDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })}
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

      {editBooking && selectedPropId && (
        <ModalShell title={`Edit Booking — ${editBooking.guestName}`} size="wide" onClose={() => setEditBooking(null)}>
          <BookingForm
            propertyId={selectedPropId}
            booking={editBooking}
            onSuccess={async () => { setEditBooking(null); await refresh(); }}
            onCancel={() => setEditBooking(null)}
          />
        </ModalShell>
      )}
      {showForm && (
        <ModalShell title="Create Booking" subtitle={pfRoom ? `Room ${pfRoom.number}` : undefined} size="wide" onClose={() => setShowForm(false)}>
          <BookingForm 
            propertyId={selectedPropId} room={pfRoom}
            initialCheckIn={prefillCheckIn.current} initialCheckOut={prefillCheckOut.current} 
            onSuccess={async () => { setShowForm(false); await refresh(); }} onCancel={() => setShowForm(false)} 
          />
        </ModalShell>
      )}
      {showGroupModal && selectedPropId && (
        <GroupBookingModal propertyId={selectedPropId} onClose={() => setShowGroupModal(false)}
          onSuccess={async () => { setShowGroupModal(false); await refresh(); }} />
      )}
      {showTasksModal && selectedPropId && (
        <TaskListModal 
          propertyId={selectedPropId} 
          onClose={() => setShowTasksModal(false)} 
          onBookingUpdated={refresh} 
        />
      )}
      {shiftRoomBooking && selectedPropId && (
        <RoomShiftModal
          propertyId={selectedPropId}
          booking={shiftRoomBooking}
          onClose={() => setShiftRoomBooking(null)}
          onSuccess={async () => { setShiftRoomBooking(null); await refresh(); }}
        />
      )}
      {earlyCheckoutBookingId && selectedPropId && (
        <EarlyCheckoutModal propertyId={selectedPropId} bookingId={earlyCheckoutBookingId}
          onClose={() => setEarlyCheckoutBookingId(null)} onSuccess={async () => { setEarlyCheckoutBookingId(null); await refresh(); }} />
      )}
      {viewFolioBooking && selectedPropId && (
        <BookingFoliosModal
          propertyId={selectedPropId}
          bookingId={viewFolioBooking.id}
          guestName={viewFolioBooking.guestName}
          onClose={() => setViewFolioBooking(null)}
        />
      )}
      {showList && selectedPropId && (
        <BookingsList bookings={getFiltered()} propertyId={selectedPropId} listType={listType}
          onClose={() => setShowList(false)} onUpdate={refresh} />
      )}
      {selectedPropId && (
        <CtxMenu state={ctx} propertyId={selectedPropId} onClose={() => setCtx(null)}
          onAction={refresh} onEarlyCheckout={setEarlyCheckoutBookingId}
          onEditBooking={setEditBooking} onShiftRoom={setShiftRoomBooking}
          onShowFolio={(id, name) => setViewFolioBooking({ id, guestName: name })} />
      )}
    </div>
  );
}