import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Pencil } from 'lucide-react';
import propertyApi from '../api/propertyApi';
import roomApi from '../api/roomApi';
import unitApi from '../api/unitApi';
import availabilityApi from '../api/availabilityApi';
import mealPlanApi from '../api/mealPlanApi';
import type { Property, Room, UnitDto, MealPlan, MealPlanType } from '../types';
import { useAuth } from '../contexts/AuthContext';

import BookingForm from "../components/Booking/BookingForm";
import LoadingSpinner from '../components/LoadingSpinner';
import ModalShell from '../components/ModalShell';
import PropertyForm from '../components/PropertyForm';
import RoomDetailsView from '../components/RoomDetailView';
import RoomForm from '../components/RoomEditForm';
import UnitForm from '../components/UnitForm';

/* ────────────────────────────────────────────────────────────── */
/* Types                                                        */
/* ────────────────────────────────────────────────────────────── */

type RoomDisplayStatus = 'VACANT' | 'OCCUPIED' | 'SCHEDULED' | 'MAINTENANCE' | 'INACTIVE';

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
  | { type: 'view_property'; property: Property }
  | { type: 'add_property' }
  | { type: 'edit_property'; property: Property }
  | { type: 'delete_property'; property: Property }
  | { type: 'add_unit'; property: Property }
  | { type: 'edit_unit'; property: Property; unit: UnitDto }
  | null;

type RoomCountSummary = Record<RoomDisplayStatus, number>;

/* ────────────────────────────────────────────────────────────── */
/* Constants & Design Tokens                                    */
/* ────────────────────────────────────────────────────────────── */

const ROOM_STATUSES: RoomDisplayStatus[] = ['VACANT', 'OCCUPIED', 'SCHEDULED', 'INACTIVE', 'MAINTENANCE'];

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
  SCHEDULED: {
    label: 'Scheduled',
    description: 'Arriving today/tomorrow',
    tile: 'border-sky-200 bg-sky-50 hover:border-sky-400 hover:shadow-md',
    chip: 'bg-sky-100 text-sky-700 border border-sky-200',
    swatch: 'bg-sky-400',
    stat: 'bg-sky-50 border-sky-200',
    dot: 'bg-sky-400',
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

/* ────────────────────────────────────────────────────────────── */
/* Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const getRoomId = (room: Room): string | null =>
  (room as { roomId?: string; id?: string }).roomId ??
  (room as { roomId?: string; id?: string }).id ??
  null;

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
  return { VACANT: 0, OCCUPIED: 0, SCHEDULED: 0, MAINTENANCE: 0, INACTIVE: 0 };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Rooms() {
  const { user } = useAuth();
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [properties, setProperties] = useState<Property[]>([]);
  const [roomsByProperty, setRoomsByProperty] = useState<Record<string, Room[]>>({});
  const [roomDisplayStatus, setRoomDisplayStatus] = useState<Record<string, RoomDisplayStatus>>({});
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, UnitDto[]>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RoomsDialog>(null);

  const [unitsForManage, setUnitsForManage] = useState<UnitDto[]>([]);
  const [loadingUnitsManage, setLoadingUnitsManage] = useState(false);
  const [unitsManageError, setUnitsManageError] = useState<string | null>(null);

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loadingMealPlans, setLoadingMealPlans] = useState(false);
  const [editingPlan, setEditingPlan] = useState<{ type: MealPlanType; adultPrice: string; childrenPrice: string } | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextProperties = await propertyApi.getAll();
      const [unitResults, roomResults] = await Promise.all([
        Promise.all(
          nextProperties.map(async (property) => {
            try {
              const units = await propertyApi.getUnits(property.id);
              return [property.id, units] as const;
            } catch {
              return [property.id, []] as const;
            }
          }),
        ),
        Promise.all(
          nextProperties.map(async (property) => {
            const rooms = await roomApi.getByProperty(property.id);
            return [property.id, rooms ?? []] as const;
          }),
        ),
      ]);

      const nextUnitsByProperty = Object.fromEntries(unitResults);
      const nextRoomsByProperty = Object.fromEntries(roomResults);
      const statusData: Record<string, RoomDisplayStatus> = {};

      // Base status from room hardware state
      for (const property of nextProperties) {
        for (const room of nextRoomsByProperty[property.id] ?? []) {
          const roomId = getRoomId(room);
          if (!roomId) continue;
          if (room.status === 'INACTIVE') statusData[roomId] = 'INACTIVE';
          else if (room.status === 'IN_MAINTENANCE' || room.status === 'QUEUED_FOR_MAINTENANCE') statusData[roomId] = 'MAINTENANCE';
          else statusData[roomId] = 'VACANT';
        }
      }

      // Overlay booking-derived status using the occupancy report API
      // which returns BookedRoomDto with roomId + bookingStatus
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      const [todayReports, tomorrowReports] = await Promise.all([
        Promise.all(
          nextProperties.map(async (property) => {
            try { return await availabilityApi.getOccupancyReport(property.id, today); }
            catch { return null; }
          }),
        ),
        Promise.all(
          nextProperties.map(async (property) => {
            try { return await availabilityApi.getOccupancyReport(property.id, tomorrow); }
            catch { return null; }
          }),
        ),
      ]);

      // Today: CHECKED_IN → OCCUPIED, CONFIRMED/PENDING → SCHEDULED
      for (const report of todayReports) {
        if (!report) continue;
        for (const booked of report.bookedRoomsList ?? []) {
          const current = statusData[booked.roomId];
          if (current === 'INACTIVE' || current === 'MAINTENANCE') continue;

          if (booked.bookingStatus === 'CHECKED_IN') {
            statusData[booked.roomId] = 'OCCUPIED';
          } else if (
            (booked.bookingStatus === 'CONFIRMED' || booked.bookingStatus === 'PENDING') &&
            current !== 'OCCUPIED'
          ) {
            statusData[booked.roomId] = 'SCHEDULED';
          }
        }
      }

      // Tomorrow: only upgrade VACANT → SCHEDULED (never downgrade OCCUPIED)
      for (const report of tomorrowReports) {
        if (!report) continue;
        for (const booked of report.bookedRoomsList ?? []) {
          const current = statusData[booked.roomId];
          if (current === 'INACTIVE' || current === 'MAINTENANCE' || current === 'OCCUPIED') continue;

          if (booked.bookingStatus === 'CONFIRMED' || booked.bookingStatus === 'PENDING') {
            statusData[booked.roomId] = 'SCHEDULED';
          }
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
      s.SCHEDULED += sec.summary.SCHEDULED;
      s.MAINTENANCE += sec.summary.MAINTENANCE;
      s.INACTIVE += sec.summary.INACTIVE;
    }
    return s;
  }, [propertySections]);

  const totalRooms = propertySections.reduce((sum, sec) => sum + (sec.property.totalRooms ?? 0), 0);
  const activeInventory = Math.max(totalRooms - overviewSummary.INACTIVE, 0);
  const occupiedPct = activeInventory > 0 ? Math.round((overviewSummary.OCCUPIED / activeInventory) * 100) : 0;

  const addRoomPropertyId = dialog?.type === 'add' ? dialog.propertyId : null;
  const bookingTarget = dialog?.type === 'booking' ? dialog.selection : null;
  const editTarget = dialog?.type === 'edit' ? dialog.selection : null;
  const deleteTarget = dialog?.type === 'delete' ? dialog.selection : null;
  const actionTarget = dialog?.type === 'actions' ? dialog.selection : null;
  const selectedRoom = dialog && 'selection' in dialog ? dialog.selection : null;
  const selectedRoomStatus = selectedRoom ? resolveRoomDisplayStatus(selectedRoom.room, roomDisplayStatus) : null;

  const managedProperty =
    dialog?.type === 'view_property' ? dialog.property :
    dialog?.type === 'edit_property' ? dialog.property :
    dialog?.type === 'delete_property' ? dialog.property :
    dialog?.type === 'add_unit' ? dialog.property :
    dialog?.type === 'edit_unit' ? dialog.property :
    null;

  // Generate today/tomorrow dynamically for new bookings
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), []);
  const tomorrowStr = useMemo(() => new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), []);

  const handleRefresh = () => void loadData();
  const handleRoomClick = (room: Room, propertyId: string) => setDialog({ type: 'actions', selection: { room, propertyId } });
  const handleAddRoom = (propertyId: string) => setDialog({ type: 'add', propertyId });
  const handleEditRoom = (selection: RoomSelection) => setDialog({ type: 'edit', selection });
  const handleCreateBooking = (selection: RoomSelection) => setDialog({ type: 'booking', selection });
  
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

  const loadUnitsForManage = async (propertyId: string) => {
    setLoadingUnitsManage(true);
    setUnitsManageError(null);
    try {
      const units = await propertyApi.getUnits(propertyId);
      setUnitsForManage(units || []);
    } catch {
      setUnitsForManage([]);
      setUnitsManageError('Failed to load units');
    } finally {
      setLoadingUnitsManage(false);
    }
  };

  const loadMealPlans = async (propertyId: string) => {
    setLoadingMealPlans(true);
    try {
      const data = await mealPlanApi.getByProperty(propertyId);
      setMealPlans(data || []);
    } catch {
      setMealPlans([]);
    } finally {
      setLoadingMealPlans(false);
    }
  };

  const handleManageProperty = (property: Property) => {
    setDialog({ type: 'view_property', property });
    setEditingPlan(null);
    void loadUnitsForManage(property.id);
    void loadMealPlans(property.id);
  };

  const handleSaveMealPlan = async () => {
    if (!editingPlan || dialog?.type !== 'view_property') return;
    const adultPrice = parseFloat(editingPlan.adultPrice);
    if (isNaN(adultPrice) || adultPrice <= 0) return;
    const childrenPrice = parseFloat(editingPlan.childrenPrice) || 0;
    setSavingPlan(true);
    try {
      const existing = mealPlans.find(p => p.mealPlanType === editingPlan.type);
      if (existing) {
        await mealPlanApi.update(dialog.property.id, existing.id, { pricePerNight: adultPrice, childrenPricePerNight: childrenPrice });
      } else {
        await mealPlanApi.create(dialog.property.id, { mealPlanType: editingPlan.type, pricePerNight: adultPrice, childrenPricePerNight: childrenPrice });
      }
      await loadMealPlans(dialog.property.id);
      setEditingPlan(null);
    } catch (err: any) {
      alert(`Failed to save meal plan: ${err.message}`);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    try {
      if (dialog?.type === 'edit_property') {
        await propertyApi.update(dialog.property.id, data);
      } else {
        await propertyApi.create(data);
      }
      setDialog(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleDeleteProperty = async () => {
    if (dialog?.type !== 'delete_property') return;
    try {
      await propertyApi.delete(dialog.property.id);
      setDialog(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSaveUnit = async (data: { name: string; sortOrder: number }) => {
    if (dialog?.type !== 'add_unit' && dialog?.type !== 'edit_unit') return;
    const prop = dialog.property;
    try {
      if (dialog.type === 'edit_unit') {
        await unitApi.partialUpdate(prop.id, dialog.unit.id, data);
      } else {
        await unitApi.create(prop.id, data);
      }
      setDialog({ type: 'view_property', property: prop });
      await loadUnitsForManage(prop.id);
    } catch (err: any) {
      alert(`Failed to save unit: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <LoadingSpinner text="Syncing live availability…" />
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
      <div className="mx-auto max-w-7xl px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Administration</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Inventory
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Occupancy</span>
              <span className="text-xl font-extrabold text-slate-900">{occupiedPct}%</span>
              <span className="text-xs font-medium text-slate-400">({overviewSummary.OCCUPIED}/{activeInventory})</span>
            </div>
            <button type="button" className={btnSecondary} onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {isManager && (
              <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'add_property' })}>
                + Add Property
              </button>
            )}
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
        <div className="mt-8 grid grid-cols-6 gap-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-5 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Properties</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{propertySections.length}</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-5 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalRooms}</p>
          </div>
          {(['VACANT', 'OCCUPIED', 'SCHEDULED', 'INACTIVE'] as RoomDisplayStatus[]).map((s) => (
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
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />{property.totalRooms ?? rooms.length} Rooms
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
                <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                  {isManager && (
                    <button type="button" className={btnSecondary} onClick={() => handleManageProperty(property)}>
                      Manage
                    </button>
                  )}
                  <button type="button" className={btnPrimary} onClick={() => handleAddRoom(property.id)}>
                    + Add Room
                  </button>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                {rooms.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
                    <p className="text-sm font-medium text-slate-400">No rooms configured for this property.</p>
                    <button type="button" className={cn(btnSecondary, 'mt-4')} onClick={() => handleAddRoom(property.id)}>
                      + Add First Room
                    </button>
                  </div>
                ) : (
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
                          <div className="flex justify-end p-2.5 pb-0">
                            <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', meta.chip)}>
                              {meta.label}
                            </span>
                          </div>

                          <div className="flex flex-1 flex-col items-center justify-center px-3 py-2">
                            <span className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
                              {room.number}
                            </span>
                            <span className="mt-1 text-[10px] font-medium text-slate-400">
                              {room.type || 'Standard'}
                            </span>
                          </div>

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
      {/* MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {actionTarget ? (
        <ModalShell title={`Room ${actionTarget.room.number}`} subtitle={actionTarget.room.type || 'Standard'} onClose={() => setDialog(null)}>
          <RoomDetailsView
            room={actionTarget.room}
            statusLabel={selectedRoomStatus ? STATUS_META[selectedRoomStatus].label : 'Unknown'}
            statusDescription={selectedRoomStatus ? STATUS_META[selectedRoomStatus].description : ''}
            statusStatClass={selectedRoomStatus ? STATUS_META[selectedRoomStatus].stat : ''}
            onEdit={() => handleEditRoom(actionTarget)}
            onBook={() => handleCreateBooking(actionTarget)}
          />
        </ModalShell>
      ) : null}

      {bookingTarget ? (
        <ModalShell title={`Create Booking — Room ${bookingTarget.room.number}`} size="wide" onClose={() => setDialog(null)}>
          <BookingForm
            propertyId={bookingTarget.propertyId}
            room={bookingTarget.room}
            initialCheckIn={todayStr}
            initialCheckOut={tomorrowStr}
            onSuccess={async () => { setDialog(null); await loadData(); }}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      ) : null}

      {editTarget ? (
        <ModalShell title={`Edit Room ${editTarget.room.number}`} onClose={() => setDialog(null)}>
          <RoomForm
            propertyId={editTarget.propertyId}
            initialRoom={editTarget.room}
            units={unitsByProperty[editTarget.propertyId] || []}
            onSuccess={async () => { setDialog(null); await loadData(); }}
            onCancel={() => setDialog(null)}
          />
          {/* We insert the Delete Button beneath the form */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
             <button type="button" className={btnDanger} onClick={() => setDialog({ type: 'delete', selection: editTarget })}>
               Delete Room
             </button>
          </div>
        </ModalShell>
      ) : null}

      {addRoomPropertyId ? (
        <ModalShell title="Add New Room" onClose={() => setDialog(null)}>
           <RoomForm
            propertyId={addRoomPropertyId}
            units={unitsByProperty[addRoomPropertyId] || []}
            onSuccess={async () => { setDialog(null); await loadData(); }}
            onCancel={() => setDialog(null)}
          />
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

      {/* ── Property Management Modals (ADMIN/MANAGER only) ── */}

      {dialog?.type === 'view_property' && managedProperty && (
        <ModalShell title={managedProperty.name} subtitle={managedProperty.code} onClose={() => { setDialog(null); setEditingPlan(null); }}>
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Address</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{managedProperty.address || 'Not specified'}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Country</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{managedProperty.country}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Rooms</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{managedProperty.totalRooms}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  Units ({unitsForManage.length})
                </h3>
                <button type="button" onClick={() => setDialog({ type: 'add_unit', property: managedProperty })}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  + Add Unit
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {loadingUnitsManage ? (
                  <p className="animate-pulse py-4 text-xs text-slate-400">Loading units...</p>
                ) : unitsManageError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 py-4 text-center">
                    <p className="text-xs font-medium text-rose-600">{unitsManageError}</p>
                  </div>
                ) : unitsForManage.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-100 py-6 text-center">
                    <p className="text-xs font-medium text-slate-400">No units configured yet.</p>
                  </div>
                ) : (
                  unitsForManage.map((unit) => (
                    <button key={unit.id} type="button"
                      onClick={() => setDialog({ type: 'edit_unit', property: managedProperty, unit })}
                      className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{unit.name}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                          Order: {unit.sortOrder} &nbsp;•&nbsp; Rooms: {unit.totalRooms}
                        </p>
                      </div>
                      <div className="text-slate-300 group-hover:text-slate-600">
                        <Pencil className="h-4 w-4" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Meal Plans Section */}
            <div>
              <div className="border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900">Meal Plans</h3>
              </div>
              <div className="mt-3 space-y-2">
                {loadingMealPlans ? (
                  <p className="animate-pulse py-4 text-xs text-slate-400">Loading meal plans...</p>
                ) : (
                  (['CP', 'MAP', 'AP'] as MealPlanType[]).map((planType) => {
                    const plan = mealPlans.find(p => p.mealPlanType === planType);
                    const isEditing = editingPlan?.type === planType;
                    const PLAN_LABELS: Record<MealPlanType, string> = {
                      CP: 'Continental Plan',
                      MAP: 'Modified American Plan',
                      AP: 'All Inclusive',
                    };
                    return (
                      <div key={planType} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{planType}</p>
                          <p className="text-[11px] font-medium text-slate-400">{PLAN_LABELS[planType]}</p>
                        </div>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-20 shrink-0">Adult/person</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                value={editingPlan!.adultPrice}
                                onChange={e => setEditingPlan({ ...editingPlan!, adultPrice: e.target.value })}
                                disabled={savingPlan}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') void handleSaveMealPlan(); if (e.key === 'Escape') setEditingPlan(null); }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-20 shrink-0">Child/person</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                value={editingPlan!.childrenPrice}
                                onChange={e => setEditingPlan({ ...editingPlan!, childrenPrice: e.target.value })}
                                disabled={savingPlan}
                                onKeyDown={e => { if (e.key === 'Enter') void handleSaveMealPlan(); if (e.key === 'Escape') setEditingPlan(null); }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                                onClick={() => void handleSaveMealPlan()}
                                disabled={savingPlan}
                              >
                                {savingPlan ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-slate-400 hover:text-slate-600"
                                onClick={() => setEditingPlan(null)}
                                disabled={savingPlan}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : plan ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                ₹{plan.pricePerNight.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="ml-1 text-[11px] font-medium text-slate-400">adult/night</span>
                              </p>
                              <p className="text-xs text-slate-400">
                                ₹{(plan.childrenPricePerNight ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span className="ml-1 text-[11px]">child/night</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                              onClick={() => setEditingPlan({ type: planType, adultPrice: String(plan.pricePerNight), childrenPrice: String(plan.childrenPricePerNight ?? 0) })}
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-bold text-slate-400 hover:text-emerald-600"
                            onClick={() => setEditingPlan({ type: planType, adultPrice: '', childrenPrice: '' })}
                          >
                            Set price
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
              <button type="button" className={btnDanger}
                onClick={() => setDialog({ type: 'delete_property', property: managedProperty })}>
                Delete Property
              </button>
              <button type="button" className={btnPrimary}
                onClick={() => setDialog({ type: 'edit_property', property: managedProperty })}>
                Edit Property Info
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {(dialog?.type === 'add_property' || dialog?.type === 'edit_property') && (
        <ModalShell
          title={dialog.type === 'add_property' ? 'Add New Property' : `Edit ${dialog.property.name}`}
          onClose={() => setDialog(null)}
        >
          <PropertyForm
            property={dialog.type === 'edit_property' ? dialog.property : null}
            onSave={handleSaveProperty}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      )}

      {(dialog?.type === 'add_unit' || dialog?.type === 'edit_unit') && managedProperty && (
        <ModalShell
          title={dialog.type === 'add_unit' ? 'Add New Unit' : `Edit ${dialog.unit.name}`}
          subtitle={managedProperty.name}
          onClose={() => setDialog({ type: 'view_property', property: managedProperty })}
        >
          <UnitForm
            propertyId={managedProperty.id}
            unit={dialog.type === 'edit_unit' ? dialog.unit : null}
            onSave={handleSaveUnit}
            onCancel={() => setDialog({ type: 'view_property', property: managedProperty })}
          />
        </ModalShell>
      )}

      {dialog?.type === 'delete_property' && managedProperty && (
        <ModalShell
          title={`Delete ${managedProperty.name}?`}
          onClose={() => setDialog({ type: 'view_property', property: managedProperty })}
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. You are permanently removing this property and all its associations.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className={btnSecondary}
                onClick={() => setDialog({ type: 'view_property', property: managedProperty })}>
                Cancel
              </button>
              <button type="button" className={btnDanger} onClick={handleDeleteProperty}>
                Confirm Deletion
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}