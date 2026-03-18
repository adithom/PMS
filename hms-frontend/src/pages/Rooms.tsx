import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import propertyApi from '../api/propertyApi';
import roomApi from '../api/roomApi';
import type { RoomAvailabilityCheckDto } from '../api/roomApi';
import type { Property, Room, RoomStatus, UnitDto } from '../types';
import RoomBookingForm from '../components/RoomBookingForm';

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                        */
/* ────────────────────────────────────────────────────────────── */

type RoomDisplayStatus = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';

type RoomSelection = {
  room: Room;
  propertyId: string;
};

type RoomsDialog =
  | { type: 'actions'; selection: RoomSelection }
  | { type: 'edit'; selection: RoomSelection }
  | { type: 'delete'; selection: RoomSelection }
  | { type: 'booking'; selection: RoomSelection }
  | { type: 'add'; propertyId: string }
  | null;

type NewRoomFormData = {
  unitId: string;
  number: string;
  type: string;
  capacity: number;
  baseRate: number;
  status: RoomStatus;
};

type RoomCountSummary = Record<RoomDisplayStatus, number>;

/* ────────────────────────────────────────────────────────────── */
/*  Constants & Design Tokens                                    */
/* ────────────────────────────────────────────────────────────── */

const EMPTY_EDIT_FORM: Partial<Room> = {
  number: '',
  type: '',
  capacity: 2,
  baseRate: 0,
  status: 'ACTIVE',
};

const ROOM_STATUSES: RoomDisplayStatus[] = ['VACANT', 'OCCUPIED', 'INACTIVE', 'MAINTENANCE'];

const STATUS_META: Record<
  RoomDisplayStatus,
  {
    label: string;
    description: string;
    tile: string;
    chip: string;
    swatch: string;
    stat: string;
    dot: string;
  }
> = {
  VACANT: {
    label: 'Vacant',
    description: 'Ready to assign',
    tile: 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md',
    chip: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    swatch: 'bg-emerald-500',
    stat: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  OCCUPIED: {
    label: 'Occupied',
    description: 'Guest checked in',
    tile: 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-md',
    chip: 'bg-emerald-200 text-emerald-800 border border-emerald-300',
    swatch: 'bg-emerald-600',
    stat: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  INACTIVE: {
    label: 'Inactive',
    description: 'Not sellable',
    tile: 'border-amber-200 bg-amber-50 hover:border-amber-400 hover:shadow-md opacity-80',
    chip: 'bg-amber-100 text-amber-700 border border-amber-200',
    swatch: 'bg-amber-400',
    stat: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-400',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    description: 'Blocked upkeep',
    tile: 'border-slate-300 bg-slate-100 hover:border-slate-400 hover:shadow-md opacity-80',
    chip: 'bg-slate-200 text-slate-600 border border-slate-300',
    swatch: 'bg-slate-400',
    stat: 'bg-slate-100 border-slate-200',
    dot: 'bg-slate-400',
  },
};

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700';

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const getRoomId = (room: Room): string | null =>
  (room as { roomId?: string; id?: string }).roomId ??
  (room as { roomId?: string; id?: string }).id ??
  null;

function createEmptyRoomForm(): NewRoomFormData {
  return { unitId: '', number: '', type: '', capacity: 2, baseRate: 0, status: 'ACTIVE' };
}

function createEditFormData(room: Room): Partial<Room> {
  return {
    number: room.number,
    type: room.type,
    capacity: room.capacity,
    baseRate: room.baseRate,
    status: room.status,
  };
}

function getFallbackDisplayStatus(room: Room): RoomDisplayStatus {
  if (room.status === 'INACTIVE') return 'INACTIVE';
  if (room.status === 'IN_MAINTENANCE' || room.status === 'QUEUED_FOR_MAINTENANCE')
    return 'MAINTENANCE';
  return 'VACANT';
}

function resolveRoomDisplayStatus(
  room: Room,
  lookup: Record<string, RoomDisplayStatus>,
): RoomDisplayStatus {
  const id = getRoomId(room);
  if (id && lookup[id]) return lookup[id];
  return getFallbackDisplayStatus(room);
}

function createEmptySummary(): RoomCountSummary {
  return { VACANT: 0, OCCUPIED: 0, MAINTENANCE: 0, INACTIVE: 0 };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ────────────────────────────────────────────────────────────── */
/*  ModalShell                                                   */
/* ────────────────────────────────────────────────────────────── */

function ModalShell({
  title,
  subtitle,
  size = 'regular',
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  size?: 'regular' | 'wide';
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl',
          size === 'wide' ? 'max-w-5xl' : 'max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Rooms() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomsByProperty, setRoomsByProperty] = useState<Record<string, Room[]>>({});
  const [roomDisplayStatus, setRoomDisplayStatus] = useState<Record<string, RoomDisplayStatus>>({});
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, UnitDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RoomsDialog>(null);
  const [editFormData, setEditFormData] = useState<Partial<Room>>(EMPTY_EDIT_FORM);
  const [newRoomData, setNewRoomData] = useState<NewRoomFormData>(createEmptyRoomForm());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextProperties = await propertyApi.getAll();
      const unitResults = await Promise.all(
        nextProperties.map(async (property) => {
          try {
            const units = await propertyApi.getUnits(property.id);
            return [property.id, units] as const;
          } catch {
            return [property.id, []] as const;
          }
        }),
      );
      const roomResults = await Promise.all(
        nextProperties.map(async (property) => {
          const rooms = await roomApi.getByProperty(property.id);
          return [property.id, rooms ?? []] as const;
        }),
      );
      const nextUnitsByProperty = Object.fromEntries(unitResults);
      const nextRoomsByProperty = Object.fromEntries(roomResults);
      const statusData: Record<string, RoomDisplayStatus> = {};
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const availabilityResults = await Promise.all(
        nextProperties.map(async (property) => {
          try {
            const availability = await roomApi.searchAvailableRooms(property.id, today, tomorrow);
            return [property.id, availability] as const;
          } catch {
            return [property.id, null] as const;
          }
        }),
      );
      for (const [, availability] of availabilityResults) {
        if (!availability?.availableRoomsList) continue;
        for (const room of availability.availableRoomsList) {
          if (room.roomId) statusData[room.roomId] = 'VACANT';
        }
      }
      await Promise.all(
        nextProperties.map(async (property) => {
          const rooms = nextRoomsByProperty[property.id] ?? [];
          await Promise.all(
            rooms.map(async (room) => {
              const roomId = getRoomId(room);
              if (!roomId || statusData[roomId]) return;
              if (room.status === 'INACTIVE') { statusData[roomId] = 'INACTIVE'; return; }
              if (room.status === 'IN_MAINTENANCE' || room.status === 'QUEUED_FOR_MAINTENANCE') {
                statusData[roomId] = 'MAINTENANCE'; return;
              }
              try {
                const avail: RoomAvailabilityCheckDto = await roomApi.checkRoomAvailability(roomId, today, tomorrow);
                if (avail.isAvailable) { statusData[roomId] = 'VACANT'; return; }
                const reason = (avail.reason || '').toUpperCase();
                if (reason === 'INACTIVE') statusData[roomId] = 'INACTIVE';
                else if (reason === 'IN_MAINTENANCE' || reason === 'MAINTENANCE') statusData[roomId] = 'MAINTENANCE';
                else statusData[roomId] = 'OCCUPIED';
              } catch {
                statusData[roomId] = getFallbackDisplayStatus(room);
              }
            }),
          );
        }),
      );
      for (const property of nextProperties) {
        for (const room of nextRoomsByProperty[property.id] ?? []) {
          const roomId = getRoomId(room);
          if (!roomId) continue;
          if (room.status === 'INACTIVE') statusData[roomId] = 'INACTIVE';
          else if (room.status === 'IN_MAINTENANCE' || room.status === 'QUEUED_FOR_MAINTENANCE') statusData[roomId] = 'MAINTENANCE';
          else if (!statusData[roomId]) statusData[roomId] = 'VACANT';
        }
      }
      setProperties(nextProperties);
      setUnitsByProperty(nextUnitsByProperty);
      setRoomsByProperty(nextRoomsByProperty);
      setRoomDisplayStatus(statusData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const propertySections = useMemo(() => {
    return properties.map((property) => {
      const rooms = [...(roomsByProperty[property.id] ?? [])].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }),
      );
      const summary = createEmptySummary();
      for (const room of rooms) summary[resolveRoomDisplayStatus(room, roomDisplayStatus)] += 1;
      const activeInventory = Math.max(rooms.length - summary.INACTIVE, 0);
      const occupancyRate = activeInventory > 0 ? Math.round((summary.OCCUPIED / activeInventory) * 100) : 0;
      return { property, rooms, summary, occupancyRate };
    });
  }, [properties, roomDisplayStatus, roomsByProperty]);

  const overviewSummary = useMemo(() => {
    const s = createEmptySummary();
    for (const sec of propertySections) {
      s.VACANT += sec.summary.VACANT;
      s.OCCUPIED += sec.summary.OCCUPIED;
      s.MAINTENANCE += sec.summary.MAINTENANCE;
      s.INACTIVE += sec.summary.INACTIVE;
    }
    return s;
  }, [propertySections]);

  const totalRooms = overviewSummary.VACANT + overviewSummary.OCCUPIED + overviewSummary.MAINTENANCE + overviewSummary.INACTIVE;
  const activeInventory = Math.max(totalRooms - overviewSummary.INACTIVE, 0);
  const occupiedPct = activeInventory > 0 ? Math.round((overviewSummary.OCCUPIED / activeInventory) * 100) : 0;

  const addRoomPropertyId = dialog?.type === 'add' ? dialog.propertyId : null;
  const bookingTarget = dialog?.type === 'booking' ? dialog.selection : null;
  const editTarget = dialog?.type === 'edit' ? dialog.selection : null;
  const deleteTarget = dialog?.type === 'delete' ? dialog.selection : null;
  const actionTarget = dialog?.type === 'actions' ? dialog.selection : null;
  const selectedRoom = dialog && 'selection' in dialog ? dialog.selection : null;
  const selectedRoomStatus = selectedRoom ? resolveRoomDisplayStatus(selectedRoom.room, roomDisplayStatus) : null;

  const handleRefresh = () => void loadData();
  const handleRoomClick = (room: Room, propertyId: string) =>
    setDialog({ type: 'actions', selection: { room, propertyId } });
  const handleAddRoom = (propertyId: string) => {
    setNewRoomData(createEmptyRoomForm());
    setDialog({ type: 'add', propertyId });
  };
  const handleEditRoom = (selection: RoomSelection) => {
    setEditFormData(createEditFormData(selection.room));
    setDialog({ type: 'edit', selection });
  };
  const handleCreateBooking = (selection: RoomSelection) =>
    setDialog({ type: 'booking', selection });
  const handleUpdateRoom = async () => {
    if (!editTarget) return;
    const roomId = getRoomId(editTarget.room);
    if (!roomId) { setError('Cannot determine room id for update'); return; }
    try {
      await roomApi.partialUpdate(editTarget.propertyId, roomId, editFormData);
      setDialog(null);
      await loadData();
    } catch (err) { setError((err as Error).message); }
  };
  const handleDeleteRoom = async () => {
    if (!deleteTarget) return;
    const roomId = getRoomId(deleteTarget.room);
    if (!roomId) { setError('Cannot determine room id for delete'); return; }
    try {
      await roomApi.delete(deleteTarget.propertyId, roomId);
      setDialog(null);
      await loadData();
    } catch (err) { setError((err as Error).message); }
  };
  const handleCreateRoom = async () => {
    if (!addRoomPropertyId) return;
    try {
      const payload: Partial<Room> & { unitId?: string } = {
        number: newRoomData.number,
        type: newRoomData.type,
        capacity: newRoomData.capacity,
        baseRate: newRoomData.baseRate,
        status: newRoomData.status,
      };
      if (newRoomData.unitId) payload.unitId = newRoomData.unitId;
      await roomApi.create(addRoomPropertyId, payload);
      setDialog(null);
      await loadData();
    } catch (err) { setError((err as Error).message); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          <p className="text-sm font-medium text-slate-500">Syncing live availability…</p>
        </div>
      </div>
    );
  }

  if (error && properties.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-xl">⚠️</div>
          <h1 className="text-lg font-bold text-slate-900">Unable to load rooms</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button type="button" className={cn(btnPrimary, 'mt-6')} onClick={handleRefresh}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      {/* Single padding wrapper — matches your nav's horizontal breathing room */}
      <div className="mx-auto max-w-7xl px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Front Desk</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Rooms &amp; Inventory
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Occupancy</span>
              <span className="text-xl font-extrabold text-slate-900">{occupiedPct}%</span>
              <span className="text-xs font-medium text-slate-400">({overviewSummary.OCCUPIED}/{activeInventory})</span>
            </div>
            <button type="button" className={btnSecondary} onClick={handleRefresh}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* ─── Legend ─── */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {ROOM_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].swatch)} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {/* ─── Overview Stats ─── */}
        {/* 5 equal columns, full width — no max-width, so it fills like the rest of the page */}
        <div className="mt-8 grid grid-cols-5 gap-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-5 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Properties</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{propertySections.length}</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-5 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalRooms}</p>
          </div>
          {(['VACANT', 'OCCUPIED', 'INACTIVE'] as RoomDisplayStatus[]).map((s) => (
            <div key={s} className={cn('flex flex-col items-center justify-center rounded-xl border py-5 text-center shadow-sm', STATUS_META[s].stat)}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{STATUS_META[s].label}</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{overviewSummary[s]}</p>
            </div>
          ))}
        </div>

        {/* ─── Property Sections ─── */}
        <div className="mt-10 space-y-8">
          {propertySections.map(({ property, rooms, summary, occupancyRate }) => (
            <section key={property.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* Property header */}
              <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{property.name}</h2>
                    <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {property.code}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {property.address || 'No address specified'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />{rooms.length} Rooms
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META.VACANT.dot)} />{summary.VACANT} Vacant
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_META.OCCUPIED.dot)} />{summary.OCCUPIED} Occupied
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{occupancyRate}% Occupancy
                    </span>
                  </div>
                </div>
                <button type="button" className={cn(btnPrimary, 'shrink-0 self-start sm:self-center')} onClick={() => handleAddRoom(property.id)}>
                  + Add Room
                </button>
              </div>

              {/* Room grid */}
              <div className="px-6 py-6 sm:px-8">
                {rooms.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
                    <p className="text-sm font-medium text-slate-400">No rooms configured for this property.</p>
                    <button type="button" className={cn(btnSecondary, 'mt-4')} onClick={() => handleAddRoom(property.id)}>
                      + Add First Room
                    </button>
                  </div>
                ) : (
                  /*
                    auto-fill: each card is at least 110px wide, stretches to fill remaining space.
                    Cards distribute evenly — no dead space on the right ever.
                    The card uses flex-col so status chip / room number / footer are always
                    in their own rows, none of them can collide with a border.
                  */
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}
                  >
                    {rooms.map((room) => {
                      const displayStatus = resolveRoomDisplayStatus(room, roomDisplayStatus);
                      const meta = STATUS_META[displayStatus];
                      const roomId = getRoomId(room);

                      return (
                        <button
                          key={roomId ?? room.number}
                          type="button"
                          className={cn(
                            'group flex flex-col rounded-xl border-2 transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2',
                            meta.tile,
                          )}
                          style={{ minHeight: '130px' }}
                          onClick={() => handleRoomClick(room, property.id)}
                        >
                          {/* Row 1 — status chip, right-aligned, padded from all edges */}
                          <div className="flex justify-end p-2.5 pb-0">
                            <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', meta.chip)}>
                              {meta.label}
                            </span>
                          </div>

                          {/* Row 2 — room number + type, vertically centred in remaining space */}
                          <div className="flex flex-1 flex-col items-center justify-center px-3 py-2">
                            <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                              {room.number}
                            </span>
                            <span className="mt-1 text-[10px] font-medium text-slate-400">
                              {room.type || 'Standard'}
                            </span>
                          </div>

                          {/* Row 3 — Pax left, Rate right; px-3 pb-3 keeps both away from borders */}
                          <div className="flex items-center justify-between px-3 pb-3 pt-1">
                            <span className="text-[10px] font-semibold text-slate-400">
                              {room.capacity}&thinsp;<span className="font-normal">Pax</span>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">
                              {formatCurrency(room.baseRate)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/*  MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {actionTarget ? (
        <ModalShell title={`Room ${actionTarget.room.number}`} subtitle={actionTarget.room.type || 'Standard'} onClose={() => setDialog(null)}>
          <div className="space-y-6">
            <div className={cn('rounded-xl border p-4', selectedRoomStatus ? STATUS_META[selectedRoomStatus].stat : 'border-slate-200 bg-slate-50')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Status</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{selectedRoomStatus ? STATUS_META[selectedRoomStatus].label : 'Unknown'}</p>
                </div>
                <span className="text-sm font-medium text-slate-500">{selectedRoomStatus ? STATUS_META[selectedRoomStatus].description : ''}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Capacity</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{actionTarget.room.capacity} guests</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Base Rate</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(actionTarget.room.baseRate)}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned Unit</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{actionTarget.room.unitName || 'Direct room'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inventory State</p>
                  <p className="mt-1 text-base font-semibold capitalize text-slate-900">
                    {actionTarget.room.status.toLowerCase().replaceAll('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" className={btnSecondary} onClick={() => handleEditRoom(actionTarget)}>Edit Room</button>
              <button type="button" className={btnPrimary} onClick={() => handleCreateBooking(actionTarget)}>Create Booking</button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {bookingTarget ? (
        <ModalShell title={`Create Booking — Room ${bookingTarget.room.number}`} size="wide" onClose={() => setDialog(null)}>
          <RoomBookingForm
            propertyId={bookingTarget.propertyId}
            room={bookingTarget.room}
            onSuccess={async () => { setDialog(null); await loadData(); }}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      ) : null}

      {editTarget ? (
        <ModalShell title={`Edit Room ${editTarget.room.number}`} onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Room number</span>
                <input className={inputCls} type="text" value={editFormData.number ?? ''} onChange={(e) => setEditFormData((c) => ({ ...c, number: e.target.value }))} />
              </label>
              <label>
                <span className={labelCls}>Type</span>
                <input className={inputCls} type="text" value={editFormData.type ?? ''} placeholder="e.g. Deluxe Suite" onChange={(e) => setEditFormData((c) => ({ ...c, type: e.target.value }))} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Capacity</span>
                <input className={inputCls} type="number" min="1" value={editFormData.capacity ?? 1} onChange={(e) => setEditFormData((c) => ({ ...c, capacity: Number(e.target.value) || 1 }))} />
              </label>
              <label>
                <span className={labelCls}>Base Rate (₹)</span>
                <input className={inputCls} type="number" min="0" step="100" value={editFormData.baseRate ?? 0} onChange={(e) => setEditFormData((c) => ({ ...c, baseRate: Number(e.target.value) || 0 }))} />
              </label>
            </div>
            <label>
              <span className={labelCls}>Status</span>
              <select className={inputCls} value={editFormData.status ?? 'ACTIVE'} onChange={(e) => setEditFormData((c) => ({ ...c, status: e.target.value as RoomStatus }))}>
                <option value="ACTIVE">Active</option>
                <option value="IN_MAINTENANCE">In Maintenance</option>
                <option value="QUEUED_FOR_MAINTENANCE">Queued for Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row">
              <button type="button" className={btnDanger} onClick={() => setDialog({ type: 'delete', selection: editTarget })}>Delete Room</button>
              <div className="flex justify-end gap-3">
                <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>Cancel</button>
                <button type="button" className={btnPrimary} onClick={handleUpdateRoom}>Save Changes</button>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {addRoomPropertyId ? (
        <ModalShell title="Add New Room" onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <label>
              <span className={labelCls}>Unit Association</span>
              <select className={inputCls} value={newRoomData.unitId} onChange={(e) => setNewRoomData((c) => ({ ...c, unitId: e.target.value }))}>
                <option value="">No Unit / Direct Room</option>
                {(unitsByProperty[addRoomPropertyId] ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Room number</span>
                <input className={inputCls} type="text" value={newRoomData.number} onChange={(e) => setNewRoomData((c) => ({ ...c, number: e.target.value }))} placeholder="101" />
              </label>
              <label>
                <span className={labelCls}>Type</span>
                <input className={inputCls} type="text" value={newRoomData.type} onChange={(e) => setNewRoomData((c) => ({ ...c, type: e.target.value }))} placeholder="Deluxe, Suite" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Capacity</span>
                <input className={inputCls} type="number" min="1" value={newRoomData.capacity} onChange={(e) => setNewRoomData((c) => ({ ...c, capacity: Number(e.target.value) || 1 }))} />
              </label>
              <label>
                <span className={labelCls}>Base Rate (₹)</span>
                <input className={inputCls} type="number" min="0" step="100" value={newRoomData.baseRate} onChange={(e) => setNewRoomData((c) => ({ ...c, baseRate: Number(e.target.value) || 0 }))} />
              </label>
            </div>
            <label>
              <span className={labelCls}>Initial Status</span>
              <select className={inputCls} value={newRoomData.status} onChange={(e) => setNewRoomData((c) => ({ ...c, status: e.target.value as RoomStatus }))}>
                <option value="ACTIVE">Active</option>
                <option value="IN_MAINTENANCE">In Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>Cancel</button>
              <button type="button" className={btnPrimary} onClick={handleCreateRoom}>Create Room</button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell title={`Delete Room ${deleteTarget.room.number}?`} onClose={() => setDialog({ type: 'edit', selection: deleteTarget })}>
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. You are permanently removing this room from inventory.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary} onClick={() => setDialog({ type: 'edit', selection: deleteTarget })}>Cancel</button>
              <button type="button" className={btnDanger} onClick={handleDeleteRoom}>Confirm Deletion</button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}