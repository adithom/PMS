import { useCallback, useEffect, useMemo, useState } from 'react';
import guestApi from '../api/guestApi';
import bookingApi from '../api/bookingApi';
import propertyApi from '../api/propertyApi';
import type { Guest, Booking, Property } from '../types';

import LoadingSpinner from '../components/LoadingSpinner';
import ModalShell from '../components/ModalShell';
import GuestForm from '../components/GuestForm';

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

interface BookingWithProperty extends Booking {
  propertyName?: string;
  propertyCode?: string;
}

interface GuestWithStats extends Guest {
  totalStays?: number;
  allBookings?: BookingWithProperty[];
}

type DialogState =
  | { type: 'view_bookings'; guest: GuestWithStats }
  | { type: 'add_guest' }
  | { type: 'edit_guest'; guest: GuestWithStats }
  | { type: 'delete_guest'; guest: GuestWithStats }
  | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'CONFIRMED': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CHECKED_IN': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CHECKED_OUT': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'NO_SHOW': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ────────────────────────────────────────────────────────────── */
/* Page Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Guests() {
  const [guests, setGuests] = useState<GuestWithStats[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);

  /* ═══════════════════════════════════════════════════════════ */
  /* Optimized Data Loading (Just profiles, no nested loops)     */
  /* ═══════════════════════════════════════════════════════════ */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fire exactly TWO API calls, simultaneously.
      const [allProperties, guestsData] = await Promise.all([
        propertyApi.getAll(),
        guestApi.getAll()
      ]);
      
      setProperties(allProperties || []);
      setGuests(guestsData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load guests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Lazy Load Bookings (Fires ONLY when a guest is clicked)     */
  /* ═══════════════════════════════════════════════════════════ */
  
  const handleViewBookings = async (guest: GuestWithStats) => {
    // 1. Open the modal immediately so the UI feels snappy
    setDialog({ type: 'view_bookings', guest: { ...guest, allBookings: [] } });
    setLoadingBookings(true);

    try {
      let allBookings: BookingWithProperty[] = [];
      
      // 2. Fetch bookings for THIS guest only
      await Promise.all(
        properties.map(async (property) => {
          try {
            const bookings = await bookingApi.getByGuest(property.id, guest.id);
            const bookingsWithProperty = bookings.map(b => ({
              ...b,
              propertyName: property.name,
              propertyCode: property.code
            }));
            allBookings = [...allBookings, ...bookingsWithProperty];
          } catch {
            // Skip properties with errors or no bookings
          }
        })
      );
      
      const totalStays = allBookings.filter(b => 
        b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT'
      ).length;
      
      // 3. Update the modal with the loaded data
      setDialog(prev => prev?.type === 'view_bookings' 
        ? { type: 'view_bookings', guest: { ...guest, allBookings, totalStays } } 
        : prev
      );
    } catch (err) {
      console.error("Failed to fetch guest bookings", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Client-Side Filtering                                       */
  /* ═══════════════════════════════════════════════════════════ */
  
  const filteredGuests = useMemo(() => {
    if (!searchQuery.trim()) return guests;
    const query = searchQuery.toLowerCase();
    return guests.filter(g =>
      g.fullName.toLowerCase().includes(query) ||
      (g.email || '').toLowerCase().includes(query) ||
      (g.phone || '').includes(query) ||
      (g.docId || '').toLowerCase().includes(query)
    );
  }, [guests, searchQuery]);

  /* ═══════════════════════════════════════════════════════════ */
  /* Actions                                                     */
  /* ═══════════════════════════════════════════════════════════ */

  const handleSaveGuest = async (data: Partial<Guest>) => {
    try {
      if (dialog?.type === 'edit_guest') {
        await guestApi.partialUpdate(dialog.guest.id, data);
      } else {
        await guestApi.create(data as any);
      }
      setDialog(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to save guest: ${err.message}`);
    }
  };

  const handleDeleteGuest = async () => {
    if (dialog?.type !== 'delete_guest') return;
    try {
      await guestApi.delete(dialog.guest.id);
      setDialog(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* Rendering                                                   */
  /* ═══════════════════════════════════════════════════════════ */

  if (loading && guests.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <LoadingSpinner text="Loading guest directory..." />
      </div>
    );
  }

  const activeGuest = dialog && 'guest' in dialog ? dialog.guest : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
      <div className="mx-auto max-w-7xl px-8 pt-8 sm:px-12 lg:px-16">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Client Management</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Guest Directory
            </h1>
          </div>
          <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'add_guest' })}>
            + Add Guest
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* ─── Search Bar ─── */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="w-full max-w-md">
            <input
              type="text"
              placeholder="Search by name, email, phone, or Doc ID..."
              className={inputCls}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden sm:block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {filteredGuests.length} Profiles
            </span>
          </div>
        </div>

        {/* ─── Guests Grid ─── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGuests.length === 0 && !loading && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No guests match your search.' : 'No guests registered yet.'}
              </p>
            </div>
          )}

          {filteredGuests.map((guest) => (
            <div
              key={guest.id}
              className="group flex cursor-pointer flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none"
              onClick={() => handleViewBookings(guest)}
            >
              <div>
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-700">
                    {guest.fullName}
                  </h3>
                </div>
                
                <div className="mt-3 space-y-1.5 text-[11px] font-medium text-slate-500">
                  {guest.email && <p><span className="font-bold text-slate-400">Email:</span> {guest.email}</p>}
                  {guest.phone && <p><span className="font-bold text-slate-400">Phone:</span> {guest.phone}</p>}
                  {guest.docId && <p><span className="font-bold text-slate-400">Doc ID:</span> {guest.docId}</p>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDialog({ type: 'edit_guest', guest }); }}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDialog({ type: 'delete_guest', guest }); }}
                  className="rounded-md bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* 1. View Guest Bookings */}
      {dialog?.type === 'view_bookings' && activeGuest && (
        <ModalShell title={activeGuest.fullName} subtitle="Booking History" size="wide" onClose={() => setDialog(null)}>
          
          {loadingBookings ? (
            <div className="py-12 text-center text-sm font-medium text-slate-400 animate-pulse">
              Retrieving booking history...
            </div>
          ) : !activeGuest.allBookings || activeGuest.allBookings.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-100 py-12 text-center">
              <p className="text-sm font-medium text-slate-400">This guest has no recorded bookings.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeGuest.allBookings
                .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
                .map((booking) => (
                  <div key={booking.id} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{booking.propertyName}</h4>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{booking.propertyCode}</p>
                      </div>
                      <span className={cn('rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider', getStatusColor(booking.status))}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-y-2 text-[11px] font-medium text-slate-500">
                      <p><span className="font-bold text-slate-400">Room:</span> {(booking as any).roomNumber || '—'}</p>
                      <p><span className="font-bold text-slate-400">Unit:</span> {(booking as any).unitName || '—'}</p>
                      <p><span className="font-bold text-slate-400">In:</span> {formatDate(booking.checkIn)}</p>
                      <p><span className="font-bold text-slate-400">Out:</span> {formatDate(booking.checkOut)}</p>
                      <p><span className="font-bold text-slate-400">Guests:</span> {booking.adults}A, {booking.children}C</p>
                      <p><span className="font-bold text-slate-400">Total:</span> {booking.currency} {booking.totalPrice?.toFixed(2) || '0.00'}</p>
                    </div>

                    {booking.specialRequests && (
                      <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 text-[11px] text-amber-800">
                        <strong className="block text-[10px] uppercase tracking-wider text-amber-600/70 mb-0.5">Notes</strong>
                        {booking.specialRequests}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* 2. Add / Edit Guest Form */}
      {(dialog?.type === 'add_guest' || dialog?.type === 'edit_guest') && (
        <ModalShell title={dialog.type === 'add_guest' ? 'Add New Guest' : `Edit ${dialog.guest.fullName}`} onClose={() => setDialog(null)}>
          <GuestForm
            guest={dialog.type === 'edit_guest' ? dialog.guest : null}
            onSave={handleSaveGuest}
            onCancel={() => setDialog(null)}
          />
        </ModalShell>
      )}

      {/* 3. Delete Confirmation */}
      {dialog?.type === 'delete_guest' && activeGuest && (
        <ModalShell title={`Delete ${activeGuest.fullName}?`} onClose={() => setDialog(null)}>
          <div className="space-y-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <strong>Warning:</strong> This action cannot be undone. You are permanently removing this guest profile.
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" className={btnSecondary} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="button" className={btnDanger} onClick={handleDeleteGuest}>
                Confirm Deletion
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}