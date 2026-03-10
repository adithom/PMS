import React, { useState, useEffect } from 'react';
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
    // const [error, setError] = useState<string | null>(null);

    // Load active bookings for property on mount
    useEffect(() => {
        if (isOpen && propertyId) {
            loadActiveBookings();
        }
    }, [isOpen, propertyId]);

    const loadActiveBookings = async () => {
        setLoading(true);
        try {
            // Ideally we should have an endpoint to search bookings by guest name or room number
            // For now, let's fetch all bookings and filter client-side or use existing list endpoint
            const allBookings = await bookingApi.getAll(propertyId);
            // Filter for active bookings (checked in)
            const active = allBookings.filter(b => b.status === 'CHECKED_IN' || b.status === 'CONFIRMED');
            setBookings(active);
        } catch (err) {
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">Select Guest / Room</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 border-b border-gray-200">
                    <input
                        type="text"
                        placeholder="Search by guest name or room number..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading bookings...</div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No active bookings found.</div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredBookings.map(booking => (
                                <div
                                    key={booking.id}
                                    className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center"
                                    onClick={() => onSelectBooking(booking)}
                                >
                                    <div>
                                        <div className="font-semibold text-gray-800">{booking.guestName}</div>
                                        <div className="text-sm text-gray-600">
                                            Room: <span className="font-medium">{booking.roomNumber || 'Unassigned'}</span> •
                                            Check-out: {booking.checkOut}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${booking.status === 'CHECKED_IN' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {booking.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
