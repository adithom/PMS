import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import bookingApi from '../../api/bookingApi';
import type { Booking } from '../../types';

interface GuestSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectBooking: (booking: Booking) => void;
    propertyId: string;
}

export default function GuestSearchModal({ isOpen, onClose, onSelectBooking, propertyId }: GuestSearchModalProps) {
    const [query, setQuery] = useState('');
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && propertyId) {
            loadActiveBookings();
        }
    }, [isOpen, propertyId]);

    const loadActiveBookings = async () => {
        setLoading(true);
        setError(null);
        try {
            const allBookings = await bookingApi.getByProperty(propertyId);
            const active = allBookings.filter(b => b.status === 'CHECKED_IN');
            setBookings(active);
        } catch {
            setError('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    const filteredBookings = bookings.filter(b => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            b.guestName?.toLowerCase().includes(q) ||
            b.roomNumber?.toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q)
        );
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900">Select Guest / Room</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                    <input
                        type="text"
                        placeholder="Search by guest name or room number..."
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="overflow-y-auto flex-1 px-6 py-4">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400 text-sm">Loading bookings...</div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">No active bookings found.</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredBookings.map(booking => (
                                <div
                                    key={booking.id}
                                    className="border border-gray-200 rounded-xl p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all flex justify-between items-center group"
                                    onClick={() => onSelectBooking(booking)}
                                >
                                    <div>
                                        <div className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                                            {booking.guestName}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-0.5">
                                            Room <span className="font-medium text-gray-700">{booking.roomNumber || 'Unassigned'}</span>
                                            <span className="mx-1.5 text-gray-300">·</span>
                                            Check-out: {booking.checkOut}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                                        booking.status === 'CHECKED_IN'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {booking.status === 'CHECKED_IN' ? 'Checked In' : 'Confirmed'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
