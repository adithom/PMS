import { useState, useEffect } from 'react';
import posApi from '../../api/posApi';
import GuestSearchModal from './GuestSearchModal';
import type { MealType, PosTicket } from '../../types/pos';
import type { Booking } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  propertyId: string;
  onTicketCreated: (ticket: PosTicket) => void;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast' },
  { value: 'LUNCH',     label: 'Lunch' },
  { value: 'DINNER',    label: 'Dinner' },
  { value: 'SNACK',     label: 'Snack' },
];

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  return 'DINNER';
}

export default function OpenTicketModal({ isOpen, onClose, locationId, propertyId, onTicketCreated }: Props) {
  const [tab, setTab] = useState<'walk-in' | 'hotel-guest'>('walk-in');
  const [guestName, setGuestName] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('walk-in');
      setGuestName('');
      setSelectedBooking(null);
      setMealType(defaultMealType());
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (tab === 'walk-in' && !guestName.trim()) {
      setError('Guest name is required');
      return;
    }
    if (tab === 'hotel-guest' && !selectedBooking) {
      setError('Please select a hotel guest');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await posApi.openTicket({
        posLocationId: locationId,
        bookingId: tab === 'hotel-guest' ? selectedBooking!.id : undefined,
        guestName: tab === 'walk-in' ? guestName.trim() : undefined,
        mealType,
      });
      onTicketCreated(ticket);
    } catch {
      setError('Failed to open ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Open Ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Guest type tabs */}
          <div className="flex rounded-xl border border-gray-200 p-1 bg-gray-50 gap-1">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'walk-in' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setTab('walk-in'); setSelectedBooking(null); setError(null); }}
            >Walk-in</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'hotel-guest' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setTab('hotel-guest'); setGuestName(''); setError(null); }}
            >Hotel Guest</button>
          </div>

          {/* Guest input */}
          {tab === 'walk-in' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Guest Name</label>
              <input
                type="text"
                placeholder="Enter guest name"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>
          ) : (
            <div>
              {selectedBooking ? (
                <div className="border border-emerald-200 rounded-xl p-3.5 bg-emerald-50 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-emerald-900">{selectedBooking.guestName}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Room {selectedBooking.roomNumber || 'Unassigned'}</div>
                  </div>
                  <button onClick={() => setSelectedBooking(null)}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline">Change</button>
                </div>
              ) : (
                <button onClick={() => setShowGuestPicker(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all font-medium">
                  + Select Hotel Guest
                </button>
              )}
            </div>
          )}

          {/* Meal type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type</label>
            <div className="grid grid-cols-4 gap-2">
              {MEAL_TYPES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMealType(m.value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    mealType === m.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mealType === 'SNACK' && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Snack is never covered by meal plans and will always be billed.
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={submitting}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            {submitting ? 'Opening...' : 'Open Ticket'}
          </button>
        </div>
      </div>

      <GuestSearchModal
        isOpen={showGuestPicker}
        onClose={() => setShowGuestPicker(false)}
        onSelectBooking={b => { setSelectedBooking(b); setShowGuestPicker(false); }}
        propertyId={propertyId}
      />
    </div>
  );
}
