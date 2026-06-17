import { useEffect, useState } from 'react';
import { Calendar, List, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import propertyApi from '../api/propertyApi';
import type { Property } from '../types';
import ReservationsList from '../components/Reservation/ReservationsList';
import ReservationCalendar from '../components/Reservation/ReservationCalendar';
import MobileReservationsView from '../components/Reservation/MobileReservationsView';
import ReservationDetailModal from '../components/Reservation/ReservationDetailModal';
import GroupBookingModal from '../components/Booking/GroupBookingModal';
import AssignRoomModal from '../components/Booking/AssignRoomModal';
import BookingForm from '../components/Booking/BookingForm';
import ModalShell from '../components/ModalShell';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 639px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700';
const btnSecondary = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50';

type Mode = 'calendar' | 'list';

export default function Reservations() {
  const isMobile = useIsMobile();
  const { user, selectedPropId, setSelectedPropId } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [mode, setMode] = useState<Mode>('calendar');
  const [openReservationId, setOpenReservationId] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignRoomCtx, setAssignRoomCtx] = useState<{ id: string; unitId: string; checkIn: string; checkOut: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ps = await propertyApi.getAll();
        const all = ps || [];
        const filtered = user?.role === 'ADMIN'
          ? all
          : all.filter(p => user?.properties?.some(up => up.id === p.id));
        setProperties(filtered);
        if (filtered.length && (!selectedPropId || !filtered.find(p => p.id === selectedPropId))) {
          setSelectedPropId(filtered[0].id);
        }
      } catch (e) { console.error(e); }
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      <div className={cn('mx-auto max-w-[1800px] pt-6 sm:pt-8', isMobile ? 'px-3' : 'px-8 sm:px-12 lg:px-16')}>
        {/* Header */}
        {isMobile ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Property</span>
            <select value={selectedPropId ?? ''} onChange={e => setSelectedPropId(e.target.value || null)}
              className="border-none bg-transparent text-sm font-semibold text-slate-900 outline-none">
              {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Reservations Desk</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Reservations</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Property</span>
                <select value={selectedPropId ?? ''} onChange={e => setSelectedPropId(e.target.value || null)}
                  className="border-none bg-transparent text-sm font-semibold text-slate-900 outline-none">
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <button type="button" className={btnSecondary} onClick={() => setShowGroupModal(true)}>
                <Users className="h-4 w-4 text-indigo-500" />
                New Group Booking
              </button>
              <button type="button" className={btnPrimary} onClick={() => setShowForm(true)}>
                + New Booking
              </button>
            </div>
          </div>
        )}

        <div className="mt-6">
          {!selectedPropId && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Select a property to view reservations.
            </div>
          )}

          {/* Mobile view */}
          {selectedPropId && isMobile && (
            <MobileReservationsView
              key={`mobile-${selectedPropId}-${refreshKey}`}
              propertyId={selectedPropId}
              onOpen={id => setOpenReservationId(id)}
              onNewBooking={() => setShowForm(true)}
            />
          )}

          {/* Desktop view */}
          {selectedPropId && !isMobile && (
            <>
              <div className="mb-6 flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
                <button type="button"
                  className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                    mode === 'calendar' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100')}
                  onClick={() => setMode('calendar')}>
                  <Calendar className="h-3.5 w-3.5" />Calendar
                </button>
                <button type="button"
                  className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all',
                    mode === 'list' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100')}
                  onClick={() => setMode('list')}>
                  <List className="h-3.5 w-3.5" />List
                </button>
              </div>
              {mode === 'calendar' && (
                <ReservationCalendar
                  key={`cal-${selectedPropId}-${refreshKey}`}
                  propertyId={selectedPropId}
                  onOpenReservation={id => setOpenReservationId(id)}
                  onAssignRoom={ctx => setAssignRoomCtx(ctx)}
                />
              )}
              {mode === 'list' && (
                <ReservationsList
                  key={`list-${selectedPropId}-${refreshKey}`}
                  propertyId={selectedPropId}
                  onOpen={id => setOpenReservationId(id)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {openReservationId && selectedPropId && (
        <ReservationDetailModal
          propertyId={selectedPropId}
          reservationId={openReservationId}
          onClose={() => setOpenReservationId(null)}
          onUpdated={() => setRefreshKey(k => k + 1)}
        />
      )}
      {showGroupModal && selectedPropId && (
        <GroupBookingModal
          propertyId={selectedPropId}
          onClose={() => setShowGroupModal(false)}
          onSuccess={() => { setShowGroupModal(false); setRefreshKey(k => k + 1); }}
        />
      )}
      {showForm && selectedPropId && (
        <ModalShell title="Create Booking" size="wide" onClose={() => setShowForm(false)}>
          <BookingForm
            propertyId={selectedPropId}
            onSuccess={() => { setShowForm(false); setRefreshKey(k => k + 1); }}
            onCancel={() => setShowForm(false)}
          />
        </ModalShell>
      )}
      {assignRoomCtx && selectedPropId && (
        <AssignRoomModal
          propertyId={selectedPropId}
          bookingId={assignRoomCtx.id}
          unitId={assignRoomCtx.unitId}
          checkIn={assignRoomCtx.checkIn}
          checkOut={assignRoomCtx.checkOut}
          onClose={() => setAssignRoomCtx(null)}
          onAssigned={() => { setAssignRoomCtx(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
