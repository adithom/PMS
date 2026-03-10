import { useState, useEffect } from 'react';
import propertyApi from '../api/propertyApi';
import roomApi from '../api/roomApi';
import type { RoomAvailabilityCheckDto } from '../api/roomApi';
import type { Property, Room, RoomStatus, UnitDto } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import RoomBookingForm from '../components/RoomBookingForm'; 
const BookingForm = RoomBookingForm;

type RoomDisplayStatus = 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' | 'INACTIVE';

// helper: unify id field (some APIs return `id`, availability uses `roomId`)
const getRoomId = (room: Room) => (room as any).roomId ?? (room as any).id ?? null;

export default function Rooms() {
  const [showAddFormFor, setShowAddFormFor] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomsByProperty, setRoomsByProperty] = useState<Record<string, Room[]>>({});
  const [roomDisplayStatus, setRoomDisplayStatus] = useState<Record<string, RoomDisplayStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<{ room: Room; propertyId: string } | null>(null);
  const [bookingRoom, setBookingRoom] = useState<{ room: Room; propertyId: string } | null>(null); // << added
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Room>>({
    number: '',
    type: '',
    capacity: 2,
    baseRate: 0,
    status: 'ACTIVE' as RoomStatus
  });

  // Form data for creating a new room
  const [newRoomData, setNewRoomData] = useState({
    unitId: '',
    number: '',
    type: '',
    capacity: 2,
    baseRate: 0,
    status: 'ACTIVE' as RoomStatus,
    lastMaintained: ''
  });

  // Units per property for the dropdown
  const [unitsByProperty, setUnitsByProperty] = useState<Record<string, UnitDto[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const props = await propertyApi.getAll();
      setProperties(props);

      const unitsData: Record<string, UnitDto[]> = {};
      for (const p of props) {
        try {
          const units = await propertyApi.getUnits(p.id);
          unitsData[p.id] = units;
        } catch (err) {
          unitsData[p.id] = [];
        }
      }
      setUnitsByProperty(unitsData);


      const roomsData: Record<string, Room[]> = {};
      const statusData: Record<string, RoomDisplayStatus> = {};

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // Fetch rooms in parallel for all properties
      const roomsPromises = props.map(p => roomApi.getByProperty(p.id));
      const roomsResults = await Promise.all(roomsPromises);
      props.forEach((p, idx) => roomsData[p.id] = roomsResults[idx] || []);

      // For each property fetch availability in bulk where possible (parallel)
      const availabilityPromises = props.map(async (p) => {
        try {
          const avail = await roomApi.searchAvailableRooms(p.id, today, tomorrow);
          return { propertyId: p.id, avail };
        } catch (err) {
          return { propertyId: p.id, avail: null };
        }
      });

      const availResults = await Promise.all(availabilityPromises);

      // First, mark rooms that come from AvailabilitySearchDto.availableRoomsList as AVAILABLE
      for (const res of availResults) {
        const avail: any = (res as any).avail;
        if (!avail) continue;
        if (Array.isArray(avail.availableRoomsList)) {
          for (const r of avail.availableRoomsList) {
            const rid = r.roomId?.toString();
            if (rid) statusData[rid] = 'AVAILABLE';
          }
        }
      }

      // Now for any room that still doesn't have a status, fall back to checking per-room availability
      const perPropertyChecks = props.map(async (p) => {
        const rooms = roomsData[p.id] || [];
        const checkPromises = rooms.map(async (room) => {
          const rid = getRoomId(room);
          if (!rid) return;
          if (statusData[rid]) return;

          if (room.status === 'IN_MAINTENANCE' || room.status === 'QUEUED_FOR_MAINTENANCE') {
            statusData[rid] = 'MAINTENANCE';
            return;
          }
          if (room.status === 'INACTIVE') {
            statusData[rid] = 'INACTIVE';
            return;
          }

          try {
            const availability: RoomAvailabilityCheckDto = await roomApi.checkRoomAvailability(rid, today, tomorrow);
            if (availability.isAvailable) {
              statusData[rid] = 'AVAILABLE';
            } else {
              const reason = (availability.reason || '').toUpperCase();
              if (reason === 'IN_MAINTENANCE' || reason === 'MAINTENANCE') statusData[rid] = 'MAINTENANCE';
              else if (reason === 'INACTIVE') statusData[rid] = 'INACTIVE';
              else statusData[rid] = 'BOOKED';
            }
          } catch {
            statusData[rid] = 'AVAILABLE';
          }
        });

        await Promise.all(checkPromises);
      });

      await Promise.all(perPropertyChecks);

      // ensure every room has a status
      for (const p of props) {
        for (const r of roomsData[p.id] || []) {
          const rid = getRoomId(r);
          if (!rid) continue;
          if (!statusData[rid]) {
            statusData[rid] = r.status === 'INACTIVE' ? 'INACTIVE' : 'AVAILABLE';
          }
        }
      }

      setRoomsByProperty(roomsData);
      setRoomDisplayStatus(statusData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomClick = (room: Room, propertyId: string) => {
    setSelectedRoom({ room, propertyId });
    setShowActionDialog(true);
  };

  // open booking form for the selected room
  const handleCreateBooking = () => {
  // open booking modal for the currently selected room
  if (!selectedRoom) return;
  setShowActionDialog(false);
  setBookingRoom({ room: selectedRoom.room, propertyId: selectedRoom.propertyId });
};


  const handleEditRoom = () => {
    if (!selectedRoom) return;
    setEditFormData({
      number: selectedRoom.room.number,
      type: selectedRoom.room.type,
      capacity: selectedRoom.room.capacity,
      baseRate: selectedRoom.room.baseRate,
      status: selectedRoom.room.status
    });
    setShowActionDialog(false);
    setShowEditForm(true);
  };

  const handleUpdateRoom = async () => {
    if (!selectedRoom) return;
    const rid = getRoomId(selectedRoom.room);
    if (!rid) {
      setError('Cannot determine room id for update');
      return;
    }

    try {
      await roomApi.partialUpdate(selectedRoom.propertyId, rid, editFormData);
      setShowEditForm(false);
      setSelectedRoom(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    const rid = getRoomId(selectedRoom.room);
    if (!rid) {
      setError('Cannot determine room id for delete');
      return;
    }

    try {
      await roomApi.delete(selectedRoom.propertyId, rid);
      setShowDeleteConfirm(false);
      setShowEditForm(false);
      setSelectedRoom(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddRoom = (propertyId: string) => {
    setShowAddFormFor(propertyId);
    setNewRoomData({
      unitId: '',
      number: '',
      type: '',
      capacity: 2,
      baseRate: 0,
      status: 'ACTIVE' as RoomStatus,
      lastMaintained: ''
    });
  };

  const handleCreateRoom = async () => {
    if (!showAddFormFor) return;

    try {
      const payload: any = {
        number: newRoomData.number,
        type: newRoomData.type,
        capacity: newRoomData.capacity,
        baseRate: newRoomData.baseRate,
        status: newRoomData.status
      };
      
      if (newRoomData.unitId) {
        payload.unitId = newRoomData.unitId;
      }

      await roomApi.create(showAddFormFor, payload);
      setShowAddFormFor(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const getRoomColor = (status: RoomDisplayStatus): string => {
    switch (status) {
      case 'AVAILABLE':
        return '#d1fae5';
      case 'BOOKED':
        return 'white';
      case 'MAINTENANCE':
      case 'INACTIVE':
        return '#fecdd3';
      default:
        return 'white';
    }
  };

  const getRoomLabel = (status: RoomDisplayStatus): string | null => {
    switch (status) {
      case 'BOOKED': return 'Booked';
      case 'MAINTENANCE': return 'Maintenance';
      case 'INACTIVE': return 'Inactive';
      default: return null;
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={loadData} />;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Rooms</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#d1fae5', border: '2px solid #333' }} />
            <span>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: 'white', border: '2px solid #333' }} />
            <span>Booked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#fecdd3', border: '2px solid #333' }} />
            <span>Maintenance/Inactive</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {properties.map((property) => {
          const rooms = roomsByProperty[property.id] || [];

          return (
            <div key={property.id} style={{
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}>
              <div style={{ position: 'relative', marginBottom: '1rem', height: '60px' }}>
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
    }}
  >
    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>
      {property.name}
    </h2>
    <p style={{ margin: '0.25rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
      {property.code} • {rooms.length} rooms
    </p>
  </div>
  <button
    onClick={() => handleAddRoom(property.id)}
    style={{
      position: 'absolute',
      right: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      padding: '0.5rem 1rem',
      background: '#2563eb',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: 500,
      transition: 'background 0.2s',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
    onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
  >
    + Add Room
  </button>
</div>



              <div style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                {rooms.map((room) => {
                  const rid = getRoomId(room);
                  const displayStatus = rid ? (roomDisplayStatus[rid] ?? 'AVAILABLE') : (room.status === 'INACTIVE' ? 'INACTIVE' : 'AVAILABLE');
                  const roomColor = getRoomColor(displayStatus);
                  const roomLabel = getRoomLabel(displayStatus);

                  return (
                    <button
                      key={rid ?? room.number}
                      onClick={() => handleRoomClick(room, property.id)}
                      style={{
                        width: '80px',
                        height: '65px',
                        border: '2px solid #334155',
                        borderRadius: '8px',
                        background: roomColor,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>{room.number}</div>
                      {roomLabel && (
                        <div style={{ fontSize: '0.7rem', color: '#881337', marginTop: '0.25rem' }}>
                          {roomLabel}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showActionDialog && selectedRoom && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowActionDialog(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '350px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
              Room {selectedRoom.room.number}
            </h3>
            <div style={{ marginBottom: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              {(() => {
                const rid = getRoomId(selectedRoom.room);
                const displayStatus = rid ? (roomDisplayStatus[rid] ?? 'AVAILABLE') : 'UNKNOWN';
                let statusColor = '#9333ea';
                if (displayStatus === 'AVAILABLE') statusColor = '#16a34a';
                else if (displayStatus === 'BOOKED') statusColor = '#dc2626';

                return (
                  <p style={{ margin: '0.25rem 0' }}>
                    Status: <span style={{ color: statusColor, fontWeight: 600 }}>
                      {displayStatus}
                    </span>
                  </p>
                );
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleCreateBooking}
                style={{
                  padding: '0.875rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                Create Booking
              </button>
              <button
                onClick={handleEditRoom}
                style={{
                  padding: '0.875rem',
                  background: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#475569'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#64748b'}
              >
                Edit Room
              </button>
              <button
                onClick={() => setShowActionDialog(false)}
                style={{
                  padding: '0.875rem',
                  background: 'white',
                  color: '#475569',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking form modal - opened when bookingRoom is set */}
      {/* Booking form modal - opened when bookingRoom is set */}
{bookingRoom && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}
    onClick={() => setBookingRoom(null)}
  >
    <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 800 }}>
      <BookingForm
        propertyId={bookingRoom.propertyId ?? null}
        room={bookingRoom.room ?? null}
        onSuccess={async (createdBooking) => {
          // refresh rooms/availability after booking created
          await loadData();
          setBookingRoom(null);
        }}
        onCancel={() => setBookingRoom(null)}
      />
    </div>
  </div>
)}


      {showEditForm && selectedRoom && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowEditForm(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '450px',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }}>
              Edit Room {selectedRoom.room.number}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Room Number *
                </label>
                <input
                  type="text"
                  value={editFormData.number}
                  onChange={(e) => setEditFormData({ ...editFormData, number: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Type *
                </label>
                <input
                  type="text"
                  value={editFormData.type}
                  onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  placeholder="e.g., Deluxe, Suite"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    Capacity *
                  </label>
                  <input
                    type="number"
                    value={editFormData.capacity}
                    onChange={(e) => setEditFormData({ ...editFormData, capacity: parseInt(e.target.value) })}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    Base Rate *
                  </label>
                  <input
                    type="number"
                    value={editFormData.baseRate}
                    onChange={(e) => setEditFormData({ ...editFormData, baseRate: parseFloat(e.target.value) })}
                    min="0"
                    step="100"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as RoomStatus })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="IN_MAINTENANCE">In Maintenance</option>
                  <option value="QUEUED_FOR_MAINTENANCE">Queued for Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={handleUpdateRoom}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                Update
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddFormFor && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowAddFormFor(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              minWidth: '450px',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }}>
              Add New Room
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Unit
                </label>
                <select
                  value={newRoomData.unitId}
                  onChange={(e) => setNewRoomData({ ...newRoomData, unitId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">No Unit (Optional)</option>
                  {(unitsByProperty[showAddFormFor] || []).map((unit: any) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Room Number *
                </label>
                <input
                  type="text"
                  value={newRoomData.number}
                  onChange={(e) => setNewRoomData({ ...newRoomData, number: e.target.value })}
                  placeholder="e.g., 101"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Type
                </label>
                <input
                  type="text"
                  value={newRoomData.type}
                  onChange={(e) => setNewRoomData({ ...newRoomData, type: e.target.value })}
                  placeholder="e.g., Deluxe, Suite"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    Capacity *
                  </label>
                  <input
                    type="number"
                    value={newRoomData.capacity}
                    onChange={(e) => setNewRoomData({ ...newRoomData, capacity: parseInt(e.target.value) })}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    Base Rate *
                  </label>
                  <input
                    type="number"
                    value={newRoomData.baseRate}
                    onChange={(e) => setNewRoomData({ ...newRoomData, baseRate: parseFloat(e.target.value) })}
                    min="0"
                    step="100"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                  Status
                </label>
                <select
                  value={newRoomData.status}
                  onChange={(e) => setNewRoomData({ ...newRoomData, status: e.target.value as RoomStatus })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="IN_MAINTENANCE">In Maintenance</option>
                  <option value="QUEUED_FOR_MAINTENANCE">Queued for Maintenance</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={handleCreateRoom}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                Create Room
              </button>
              <button
                onClick={() => setShowAddFormFor(null)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'white',
                  color: '#475569',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedRoom && (
        <ConfirmDialog
          title="Delete Room"
          message={`Are you sure you want to delete room ${selectedRoom.room.number}? This action cannot be undone.`}
          onConfirm={handleDeleteRoom}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
