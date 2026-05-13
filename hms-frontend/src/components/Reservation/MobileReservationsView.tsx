import { useEffect, useState } from 'react';
import { Calendar, List } from 'lucide-react';
import reservationApi from '../../api/reservationApi';
import type { GroupBookingSummaryDto } from '../../api/reservationApi';
import MobileListView from './MobileListView';
import MobileCalendarView from './MobileCalendarView';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type MobileMode = 'list' | 'calendar';

interface Props {
  propertyId: string;
  onOpen: (reservationId: string) => void;
  onNewBooking: () => void;
}

export default function MobileReservationsView({ propertyId, onOpen, onNewBooking }: Props) {
  const [mode, setMode] = useState<MobileMode>('calendar');
  const [reservations, setReservations] = useState<GroupBookingSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reservationApi.getReservations(propertyId)
      .then(data => { if (!cancelled) setReservations(data || []); })
      .catch(e => console.error(e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  return (
    <div className="pb-6">
      {/* Mode toggle + New Booking */}
      <div className="mb-5 flex items-center justify-center gap-2">
        <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
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
        <button
          type="button"
          onClick={onNewBooking}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
        >
          + New
        </button>
      </div>

      {mode === 'list' && (
        <MobileListView
          reservations={reservations}
          loading={loading}
          onOpen={onOpen}
        />
      )}
      {mode === 'calendar' && (
        <MobileCalendarView
          propertyId={propertyId}
          onOpenReservation={onOpen}
        />
      )}
    </div>
  );
}
