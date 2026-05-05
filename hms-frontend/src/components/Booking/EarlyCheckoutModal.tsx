import { useState, useEffect } from 'react';
import bookingApi from '../../api/bookingApi';
import type { Booking } from '../../types';
import ModalShell from '../ModalShell';
import { fmtDate } from '../../utils/dateHelpers';

interface EarlyCheckoutModalProps {
  propertyId: string;
  bookingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

type PolicyType = 'NO_CHANGE' | 'REFUND_UNUSED_NIGHTS' | 'CUSTOM';

export default function EarlyCheckoutModal({ propertyId, bookingId, onClose, onSuccess }: EarlyCheckoutModalProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [newCheckOutDate, setNewCheckOutDate] = useState<string>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // Default to today in IST
  );
  const [policy, setPolicy] = useState<PolicyType>('REFUND_UNUSED_NIGHTS');
  const [customRoomCharge, setCustomRoomCharge] = useState<number | ''>('');

  // Fetch current booking details on mount
  useEffect(() => {
    bookingApi.getById(propertyId, bookingId)
      .then(data => {
        setBooking(data);
        // If today is somehow after the original checkout, cap it.
        const originalOut = data.checkOut.split('T')[0];
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        setNewCheckOutDate(today < originalOut ? today : originalOut);
      })
      .catch(() => setError('Failed to load booking details.'))
      .finally(() => setLoading(false));
  }, [propertyId, bookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newCheckOutDate) {
      setError('Please select the new check-out date.');
      return;
    }

    if (policy === 'CUSTOM' && (customRoomCharge === '' || Number(customRoomCharge) < 0)) {
      setError('Please enter a valid non-negative custom room charge.');
      return;
    }

    setSubmitting(true);
    try {
      await bookingApi.checkoutEarly(propertyId, bookingId, {
        newCheckOutDate,
        policy,
        customRoomCharge: policy === 'CUSTOM' ? Number(customRoomCharge) : undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process early checkout.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ModalShell title="Early Checkout" size="regular" onClose={onClose}>
        <div className="flex h-48 items-center justify-center text-slate-500">
          Loading booking data...
        </div>
      </ModalShell>
    );
  }

  if (!booking) return null;

  const originalCheckOut = booking.checkOut.split('T')[0];
  const isDateValid = newCheckOutDate < originalCheckOut;

  const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50';
  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500';

  return (
    <ModalShell title="Early Checkout" subtitle={`${booking.guestName || 'Guest'} • Room ${booking.roomNumber || 'Unassigned'}`} size="regular" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* 1. Date Selection */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Original Checkout</p>
              <p className="font-semibold text-slate-700">{fmtDate(originalCheckOut)}</p>
            </div>
            <div className="text-slate-300">→</div>
            <div className="text-right">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-1">New Checkout Date</label>
              <input 
                type="date" 
                max={originalCheckOut}
                className={`${inputCls} !w-auto text-right border-rose-200 focus:border-rose-500`}
                value={newCheckOutDate}
                onChange={e => setNewCheckOutDate(e.target.value)}
              />
            </div>
          </div>
          {!isDateValid && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded border border-amber-100">
              Note: The new date must be earlier than the original checkout date to qualify as an early checkout.
            </p>
          )}
        </div>

        {/* 2. Financial Policy */}
        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-slate-500">Folio Financial Policy</label>
          <div className="space-y-3">
            
            {/* Policy: Refund Unused */}
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${
              policy === 'REFUND_UNUSED_NIGHTS' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white">
                {policy === 'REFUND_UNUSED_NIGHTS' && <div className="h-2 w-2 rounded-full bg-rose-600" />}
              </div>
              <input type="radio" className="hidden" checked={policy === 'REFUND_UNUSED_NIGHTS'} onChange={() => setPolicy('REFUND_UNUSED_NIGHTS')} />
              <div>
                <span className="block text-sm font-bold text-slate-900">Refund Unused Nights</span>
                <span className="block text-xs text-slate-500">Automatically voids all room rent charges scheduled on or after the new checkout date.</span>
              </div>
            </label>

            {/* Policy: No Change */}
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${
              policy === 'NO_CHANGE' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white">
                {policy === 'NO_CHANGE' && <div className="h-2 w-2 rounded-full bg-rose-600" />}
              </div>
              <input type="radio" className="hidden" checked={policy === 'NO_CHANGE'} onChange={() => setPolicy('NO_CHANGE')} />
              <div>
                <span className="block text-sm font-bold text-slate-900">Charge Full Amount (No Change)</span>
                <span className="block text-xs text-slate-500">Guest pays for the entire original stay. No charges are removed from the folio.</span>
              </div>
            </label>

            {/* Policy: Custom */}
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${
              policy === 'CUSTOM' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}>
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white">
                {policy === 'CUSTOM' && <div className="h-2 w-2 rounded-full bg-rose-600" />}
              </div>
              <input type="radio" className="hidden" checked={policy === 'CUSTOM'} onChange={() => setPolicy('CUSTOM')} />
              <div className="w-full">
                <span className="block text-sm font-bold text-slate-900">Custom Room Charge (Penalty)</span>
                <span className="block text-xs text-slate-500 mb-2">Manually specify the final total room rent to charge the guest.</span>
                
                {policy === 'CUSTOM' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-400">{booking.currency || 'INR'}</span>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="e.g., 15000"
                      className={inputCls}
                      value={customRoomCharge}
                      onChange={e => setCustomRoomCharge(e.target.value === '' ? '' : Number(e.target.value))}
                      onClick={e => e.stopPropagation()} // Prevent radio click
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5 mt-6">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting || !isDateValid}>
            {submitting ? 'Processing...' : 'Confirm Early Checkout'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}