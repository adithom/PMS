import React, { useState } from 'react';
import bookingApi from '../../api/bookingApi';
import BookingForm from './BookingForm';
import EarlyCheckoutModal from './EarlyCheckoutModal';
import ModalShell from '../ModalShell';
import type { Booking, BookingStatus } from '../../types';

/* ────────────────────────────────────────────────────────────── */
/* Types & Tokens                                               */
/* ────────────────────────────────────────────────────────────── */

type StatType = 'incoming' | 'inhouse' | 'checkouts' | 'all';

interface BookingsListProps {
  bookings: Booking[];
  propertyId: string;
  listType: StatType;
  onClose: () => void;
  onUpdate: () => void;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const btnSecondary = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50';
const btnDanger = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-all hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50';
const btnSuccess = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';
const btnAction = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50';
const btnConfirmDanger = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50';
const btnConfirmPrimary = 'inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';

const getStatusColor = (status: BookingStatus) => {
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
  return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
    .toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
};

const getTodayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/* ────────────────────────────────────────────────────────────── */
/* Component                                                    */
/* ────────────────────────────────────────────────────────────── */

export default function BookingsList({ bookings, propertyId, listType, onClose, onUpdate }: BookingsListProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [earlyCheckoutBooking, setEarlyCheckoutBooking] = useState<Booking | null>(null);
  
  const [confirmAction, setConfirmAction] = useState<'checkin' | 'checkout' | 'cancel' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTitle = () => {
    switch (listType) {
      case 'incoming': return 'Arrivals';
      case 'inhouse': return 'In-House Guests';
      case 'checkouts': return 'Departures';
      case 'all': default: return 'All Bookings';
    }
  };

  const triggerConfirm = (booking: Booking, action: 'checkin' | 'checkout' | 'cancel') => {
    // Intercept checkout to check if it's an Early Checkout
    if (action === 'checkout') {
      const today = getTodayStr();
      const checkOutDate = booking.checkOut.split('T')[0];
      if (today < checkOutDate) {
        setEarlyCheckoutBooking(booking);
        return; // Don't show standard confirmation dialog
      }
    }

    setSelectedBooking(booking);
    setConfirmAction(action);
    setShowConfirmDialog(true);
  };

  const confirmActionHandler = async () => {
    if (!selectedBooking || !confirmAction) return;

    if (confirmAction === 'checkin') {
      setLoading(true); setError(null);
      try {
        if (!selectedBooking.id) throw new Error('Booking ID is missing.');
        await bookingApi.checkIn(propertyId, selectedBooking.id);
        await onUpdate();
        setShowConfirmDialog(false);
        setSelectedBooking(null);
        setConfirmAction(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (confirmAction === 'checkout') {
      setLoading(true); setError(null);
      try {
        if (!selectedBooking.id) throw new Error('Booking ID is missing.');
        // Call the proper standard checkOut endpoint instead of standard updateStatus
        await bookingApi.checkOut(propertyId, selectedBooking.id);
        await onUpdate();
        setShowConfirmDialog(false);
        setSelectedBooking(null);
        setConfirmAction(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (confirmAction === 'cancel') {
      setLoading(true); setError(null);
      try {
        if (!selectedBooking.id) throw new Error('Booking ID is missing.');
        await bookingApi.updateStatus(propertyId, selectedBooking.id, 'CANCELLED');
        await onUpdate();
        setShowConfirmDialog(false);
        setSelectedBooking(null);
        setConfirmAction(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      {/* 1. Main List Modal */}
      <ModalShell 
        title={getTitle()} 
        subtitle={`${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'}`} 
        size="wide" 
        onClose={onClose}
      >
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
              <span className="text-4xl">📋</span>
              <p className="mt-4 text-sm font-medium text-slate-400">No bookings found for this category.</p>
            </div>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all sm:flex-row sm:items-start">
                
                {/* Info Section */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{(booking as any).guestName || 'Guest'}</h3>
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', getStatusColor(booking.status))}>
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 text-[11px] font-medium text-slate-500 sm:grid-cols-3">
                    <p><span className="font-bold text-slate-400">Room:</span> {(booking as any).roomNumber || 'Not assigned'}</p>
                    <p><span className="font-bold text-slate-400">Unit:</span> {(booking as any).unitName || 'N/A'}</p>
                    <p><span className="font-bold text-slate-400">Total:</span> {booking.currency} {booking.totalPrice?.toFixed(2) || '0.00'}</p>
                    <p><span className="font-bold text-slate-400">In:</span> {formatDate(booking.checkIn)}</p>
                    <p><span className="font-bold text-slate-400">Out:</span> {formatDate(booking.checkOut)}</p>
                    <p><span className="font-bold text-slate-400">Guests:</span> {booking.adults}A, {booking.children}C</p>
                  </div>

                  {booking.specialRequests && (
                    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 text-[11px] text-amber-800">
                      <strong className="block text-[10px] uppercase tracking-wider text-amber-600/70 mb-0.5">Special Requests</strong>
                      {booking.specialRequests}
                    </div>
                  )}
                </div>

                {/* Action Buttons Section */}
                <div className="flex shrink-0 flex-col gap-2 sm:w-32 border-t border-slate-100 pt-4 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                  {booking.status === 'CONFIRMED' && (
                    <button onClick={() => triggerConfirm(booking, 'checkin')} className={btnSuccess}>Check In</button>
                  )}
                  {booking.status === 'CHECKED_IN' && (
                    <button onClick={() => triggerConfirm(booking, 'checkout')} className={btnAction}>Check Out</button>
                  )}
                  {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                    <button onClick={() => triggerConfirm(booking, 'cancel')} className={btnDanger}>Cancel</button>
                  )}
                  {booking.status !== 'CANCELLED' && booking.status !== 'CHECKED_OUT' && (
                    <button onClick={() => { setSelectedBooking(booking); setShowEditForm(true); }} className={btnSecondary}>Edit</button>
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      </ModalShell>

      {/* 2. Edit Booking Form Modal */}
      {showEditForm && selectedBooking && (
        <ModalShell title={`Edit Booking — ${(selectedBooking as any).guestName}`} size="wide" onClose={() => { setShowEditForm(false); setSelectedBooking(null); }}>
          <BookingForm
            propertyId={propertyId}
            booking={selectedBooking}
            onSuccess={() => { setShowEditForm(false); setSelectedBooking(null); onUpdate(); }}
            onCancel={() => { setShowEditForm(false); setSelectedBooking(null); }}
          />
        </ModalShell>
      )}

      {/* 3. Confirm Dialog Modal */}
      {showConfirmDialog && selectedBooking && (
        <ModalShell 
          title={confirmAction === 'checkin' ? 'Confirm Check-in' : confirmAction === 'checkout' ? 'Confirm Check-out' : 'Cancel Booking'} 
          onClose={() => { setShowConfirmDialog(false); setSelectedBooking(null); setConfirmAction(null); setError(null); }}
        >
          <div className="space-y-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              {confirmAction === 'checkin' && `Are you sure you want to check in ${(selectedBooking as any).guestName || 'this guest'}?`}
              {confirmAction === 'checkout' && `Are you sure you want to check out ${(selectedBooking as any).guestName || 'this guest'}?`}
              {confirmAction === 'cancel' && `Are you sure you want to cancel the booking for ${(selectedBooking as any).guestName || 'this guest'}? This action cannot be undone.`}
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className={btnSecondary} disabled={loading}
                onClick={() => { setShowConfirmDialog(false); setSelectedBooking(null); setConfirmAction(null); setError(null); }}>
                Back
              </button>
              <button type="button" className={confirmAction === 'cancel' ? btnConfirmDanger : btnConfirmPrimary} onClick={confirmActionHandler} disabled={loading}>
                {loading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* 4. Early Checkout Modal */}
      {earlyCheckoutBooking && earlyCheckoutBooking.id && (
        <EarlyCheckoutModal
          propertyId={propertyId}
          bookingId={earlyCheckoutBooking.id}
          onClose={() => setEarlyCheckoutBooking(null)}
          onSuccess={() => { setEarlyCheckoutBooking(null); onUpdate(); }}
        />
      )}
    </>
  );
}