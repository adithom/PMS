import React, { useState, useEffect } from 'react';
import ModalShell from '../ModalShell';
import taskApi from '../../api/taskApi';
import type { Room, Guest, Booking } from '../../types';
import { format } from 'date-fns';
import AssignRoomModal from './AssignRoomModal';

interface TaskListModalProps {
  propertyId: string;
  onClose: () => void;
  onBookingUpdated?: () => void;
}

export default function TaskListModal({ propertyId, onClose, onBookingUpdated }: TaskListModalProps) {
  const [loading, setLoading] = useState(true);
  const [maintenanceRooms, setMaintenanceRooms] = useState<Room[]>([]);
  const [birthdays, setBirthdays] = useState<Guest[]>([]);
  const [unassigned, setUnassigned] = useState<Booking[]>([]);

  // Assign Room Modal State
  const [bookingToAssign, setBookingToAssign] = useState<Booking | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const [rooms, guests, bookings] = await Promise.all([
        taskApi.getMaintenanceRooms(propertyId),
        taskApi.getBirthdays(propertyId),
        taskApi.getUnassignedCheckins(propertyId)
      ]);
      setMaintenanceRooms(rooms);
      setBirthdays(guests);
      setUnassigned(bookings);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchTasks();
    }
  }, [propertyId]);

  const handleRoomAssigned = () => {
    setBookingToAssign(null);
    fetchTasks();
    if (onBookingUpdated) onBookingUpdated();
  };

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Daily Tasks" className="max-w-3xl">
      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading tasks...</div>
      ) : (
        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          
          {/* Maintenance Rooms */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Rooms in Maintenance
            </h3>
            {maintenanceRooms.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No rooms currently in maintenance.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {maintenanceRooms.map(room => (
                  <div key={room.roomId} className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                    <div className="font-medium text-orange-900">Room {room.number}</div>
                    <div className="text-xs text-orange-700">{room.type}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Birthdays */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              Today's Birthdays (In-House)
            </h3>
            {birthdays.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No guests celebrating birthdays today.</p>
            ) : (
              <ul className="space-y-3">
                {birthdays.map(guest => (
                  <li key={guest.id} className="flex justify-between p-4 bg-pink-50 border border-pink-100 rounded-lg">
                    <div>
                      <div className="font-medium text-pink-900">{guest.fullName}</div>
                      <div className="text-xs text-pink-700">{guest.email || guest.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-pink-800">Date of Birth</div>
                      <div className="text-sm text-pink-900">{guest.dateOfBirth}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Unassigned Check-ins */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Upcoming Unassigned Check-ins
            </h3>
            {unassigned.length === 0 ? (
              <p className="text-slate-500 text-sm italic">All upcoming check-ins have rooms assigned.</p>
            ) : (
              <ul className="space-y-3">
                {unassigned.map(booking => (
                  <li key={booking.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <div>
                      <div className="font-medium text-blue-900">{booking.guestName}</div>
                      <div className="text-xs text-blue-700">
                        {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d')} ({booking.unitName})
                      </div>
                    </div>
                    <button 
                      onClick={() => setBookingToAssign(booking)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Assign Room
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      )}

      {/* Assign Room Modal Layer */}
      {bookingToAssign && bookingToAssign.id && (
        <AssignRoomModal
          propertyId={propertyId}
          bookingId={bookingToAssign.id}
          unitId={bookingToAssign.unitId}
          checkIn={bookingToAssign.checkIn}
          checkOut={bookingToAssign.checkOut}
          onClose={() => setBookingToAssign(null)}
          onAssigned={handleRoomAssigned}
        />
      )}
    </ModalShell>
  );
}
