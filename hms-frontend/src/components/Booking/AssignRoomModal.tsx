import React, { useState, useEffect } from 'react';
import ModalShell from '../ModalShell';
import availabilityApi from '../../api/availabilityApi';
import type { AvailableRoomDto } from '../../api/availabilityApi';
import bookingApi from '../../api/bookingApi';

interface AssignRoomModalProps {
  propertyId: string;
  bookingId: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignRoomModal({ propertyId, bookingId, unitId, checkIn, checkOut, onClose, onAssigned }: AssignRoomModalProps) {
  const [rooms, setRooms] = useState<AvailableRoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const availableRooms = await availabilityApi.searchAvailableRoomsByUnit(unitId, checkIn, checkOut);
        setRooms(availableRooms);
      } catch (err: any) {
        setError(err.message || "Failed to fetch available rooms");
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [unitId, checkIn, checkOut]);

  const handleAssign = async () => {
    if (!selectedRoomId) return;
    setSubmitting(true);
    setError('');
    try {
      await bookingApi.assignRoom(propertyId, bookingId, selectedRoomId);
      onAssigned();
    } catch (err: any) {
      setError(err.message || "Failed to assign room");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell isOpen={true} onClose={onClose} title="Assign Room" className="max-w-md">
      <div className="p-6">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>}
        
        <div className="mb-4 text-sm text-slate-600">
          Select an available room for the check-in dates: {checkIn} to {checkOut}
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Finding available rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-8 text-amber-600 bg-amber-50 rounded-lg">
            No rooms available for this unit type during the selected dates.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
            {rooms.map(room => (
              <label 
                key={room.roomId} 
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedRoomId === room.roomId ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <input 
                  type="radio" 
                  name="roomSelection" 
                  value={room.roomId} 
                  checked={selectedRoomId === room.roomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-slate-800">Room {room.roomNumber}</div>
                  <div className="text-xs text-slate-500">Capacity: {room.capacity}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            disabled={submitting}
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleAssign}
            disabled={!selectedRoomId || submitting}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Assigning...' : 'Assign Room'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
