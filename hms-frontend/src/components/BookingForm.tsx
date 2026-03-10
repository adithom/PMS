// BookingForm.tsx - Updated to use new DTO structure
import React, { useEffect, useState } from 'react';
import propertyApi from '../api/propertyApi';
import guestApi from '../api/guestApi';
import bookingApi, { type BookingCreationDto } from '../api/bookingApi';
import roomApi from '../api/roomApi';
import availabilityApi from '../api/availabilityApi';
import type { Property, Room, UnitDto, Booking } from '../types';
import './BookingForm.css';

type GuestSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

type Props = {
  propertyId?: string | null;
  room?: Room | null;
  booking?: Booking | null;
  onSuccess?: (created: Booking) => void;
  onCancel?: () => void;
};

export default function BookingForm({
  propertyId: propPropertyId = null,
  room: preselectedRoom = null,
  booking = null,
  onSuccess,
  onCancel
}: Props) {
  const isEditMode = !!booking;

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    propPropertyId || (booking?.propertyId ?? null)
  );
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    booking?.unitId ?? null
  );
  const [room, setRoom] = useState<Room | null>(preselectedRoom ?? null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  const [checkIn, setCheckIn] = useState<string>(booking?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState<string>(booking?.checkOut ?? '');
  const [adults, setAdults] = useState<number>(booking?.adults ?? 1);
  const [children, setChildren] = useState<number>(booking?.children ?? 0);
  const [currency, setCurrency] = useState<string>(booking?.currency ?? 'INR');
  const [totalPrice, setTotalPrice] = useState<number>(booking?.totalPrice ?? 0);
  const [paidAmount, setPaidAmount] = useState<number>(booking?.paidAmount ?? 0);
  const [specialRequests, setSpecialRequests] = useState<string>(booking?.specialRequests ?? '');
  const [status, setStatus] = useState<string>(booking?.status ?? 'PENDING');

  const [guestQuery, setGuestQuery] = useState<string>(booking?.guestName ?? '');
  const [guestResults, setGuestResults] = useState<GuestSearchResult[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(booking?.guestId ?? null);

  const [creatingGuest, setCreatingGuest] = useState<boolean>(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState<string>('');
  const [newGuestLastName, setNewGuestLastName] = useState<string>('');
  const [newGuestEmail, setNewGuestEmail] = useState<string>('');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');
  const [newGuestDocId, setNewGuestDocId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  // Load properties
  useEffect(() => {
    (async () => {
      try {
        const props = await propertyApi.getAll();
        setProperties(props || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Load units when property selected
  useEffect(() => {
    const loadUnits = async () => {
      if (!selectedPropertyId) {
        setUnits([]);
        return;
      }
      try {
        const fetchedUnits = await propertyApi.getUnits(selectedPropertyId);
        setUnits(fetchedUnits || []);
      } catch {
        setUnits([]);
      }
    };
    loadUnits();
  }, [selectedPropertyId]);

  // Load rooms when unit selected
  useEffect(() => {
    const loadRooms = async () => {
      if (!selectedPropertyId || !selectedUnitId) {
        setAvailableRooms([]);
        return;
      }
      try {
        const rooms = await roomApi.getByUnit(selectedPropertyId, selectedUnitId);
        setAvailableRooms(rooms || []);

        // If editing and room exists, find and set it from available rooms
        if (isEditMode && booking?.roomNumber) {
          const matchingRoom = rooms.find(r => r.number === booking.roomNumber);
          if (matchingRoom) {
            setRoom(matchingRoom);
          }
        }
      } catch {
        setAvailableRooms([]);
      }
    };
    loadRooms();
  }, [selectedPropertyId, selectedUnitId, booking, isEditMode]);

  // Guest search (only in create mode)
  useEffect(() => {
    if (isEditMode) return;

    if (!guestQuery || guestQuery.length < 2) {
      setGuestResults([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const raw = await guestApi.search(guestQuery);
        if (!mounted) return;
        const normalized: GuestSearchResult[] = (raw || [])
          .map((g: unknown) => {
            const guest = g as Record<string, unknown>;
            const rawId = guest.id ?? guest.uuid ?? guest.guestId ?? guest._id ?? null;
            if (!rawId) return null;
            return {
              id: String(rawId),
              firstName: String(guest.firstName ?? guest.first_name ?? guest.fname ?? ''),
              lastName: String(guest.lastName ?? guest.last_name ?? guest.lname ?? ''),
              email: typeof guest.email === 'string' ? guest.email : undefined,
              phone: typeof guest.phone === 'string' ? guest.phone : undefined
            } as GuestSearchResult;
          })
          .filter((g): g is GuestSearchResult => g !== null);
        setGuestResults(normalized);
      } catch {
        setGuestResults([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [guestQuery, isEditMode]);

  // Check availability when dates or unit changes
  useEffect(() => {
    const checkAvailability = async () => {
      // Only check availability in create mode when we have the necessary data
      if (isEditMode || !selectedUnitId || !checkIn || !checkOut) {
        setAvailabilityMessage(null);
        return;
      }

      // Validate dates first
      if (new Date(checkOut) <= new Date(checkIn)) {
        setAvailabilityMessage(null);
        return;
      }

      setCheckingAvailability(true);
      setAvailabilityMessage(null);

      try {
        // Fetch available rooms for the selected unit and date range
        const availableRoomsList = await availabilityApi.searchAvailableRoomsByUnit(
          selectedUnitId,
          checkIn,
          checkOut
        );

        // Get the IDs of available rooms
        const availableRoomIds = new Set(availableRoomsList.map(r => r.roomId));

        // Filter the current room list to show only available ones
        const filteredRooms = availableRooms.filter(r => {
          const roomId = getRoomId(r);
          return roomId && availableRoomIds.has(roomId);
        });

        // Update the available rooms list
        setAvailableRooms(filteredRooms);

        // Set availability message
        if (availableRoomsList.length === 0) {
          setAvailabilityMessage('⚠️ No rooms available for selected dates');
        } else {
          setAvailabilityMessage(`✓ ${availableRoomsList.length} room${availableRoomsList.length !== 1 ? 's' : ''} available`);
        }

        // Clear selected room if it's no longer available
        if (room) {
          const roomId = getRoomId(room);
          if (roomId && !availableRoomIds.has(roomId)) {
            setRoom(null);
          }
        }
      } catch (err) {
        console.error('Failed to check availability:', err);
        setAvailabilityMessage('Failed to check availability');
      } finally {
        setCheckingAvailability(false);
      }
    };

    checkAvailability();
  }, [selectedUnitId, checkIn, checkOut, isEditMode]);

  const createGuestThenSelect = async (): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        firstName: newGuestFirstName,
        lastName: newGuestLastName,
        email: newGuestEmail,
        phone: newGuestPhone,
        docId: newGuestDocId
      };
      const created = (await guestApi.create(payload)) as unknown as Record<string, unknown>;
      const idStr = String(created.id ?? created.uuid ?? created.guestId ?? created._id ?? '');
      if (!idStr) throw new Error('Guest creation returned no id');

      const normalized: GuestSearchResult = {
        id: idStr,
        firstName: String(created.firstName ?? payload.firstName),
        lastName: String(created.lastName ?? payload.lastName),
        email: typeof created.email === 'string' ? created.email : undefined,
        phone: typeof created.phone === 'string' ? created.phone : undefined
      };
      setSelectedGuestId(idStr);
      setGuestResults([normalized]);
      setCreatingGuest(false);
      setNewGuestFirstName('');
      setNewGuestLastName('');
      setNewGuestEmail('');
      setNewGuestPhone('');
      setNewGuestDocId('');
      setGuestQuery('');
      return idStr;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create guest';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validate = (): string | null => {
    if (!selectedPropertyId) return 'Property is required.';
    if (!selectedUnitId) return 'Unit is required.';
    if (!selectedGuestId && !creatingGuest) return 'Please select or create a guest.';
    if (!checkIn) return 'Check-in date is required.';
    if (!checkOut) return 'Check-out date is required.';
    if (new Date(checkOut) <= new Date(checkIn)) return 'Check-out must be after check-in.';
    if (adults < 1) return 'At least 1 adult is required.';
    return null;
  };

  const getRoomId = (r: Room | null): string | null => {
    if (!r) return null;
    return r.roomId ?? (r as any).id ?? null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (creatingGuest && !isEditMode) {
        await createGuestThenSelect();
      }

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }

      const guestIdToUse = selectedGuestId;
      if (!guestIdToUse) {
        setError('Guest not selected');
        setLoading(false);
        return;
      }

      const payload: BookingCreationDto = {
        roomId: getRoomId(room) ?? undefined,
        guestId: guestIdToUse!,
        unitId: selectedUnitId!,
        status: status as any, // TODO: Fix BookingStatus type definition
        checkIn,
        checkOut,
        adults,
        children,
        currency,
        totalPrice,
        paidAmount,
        specialRequests
      };

      const pid = selectedPropertyId!;

      let result;
      if (isEditMode && booking?.id) {
        result = await bookingApi.partialUpdate(pid, booking.id, payload);
      } else {
        result = await bookingApi.create(pid, payload);
      }

      setLoading(false);
      if (onSuccess) onSuccess(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} booking`;
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Sync prop changes for create mode
  useEffect(() => {
    if (!isEditMode) {
      setSelectedPropertyId(propPropertyId ?? null);
    }
  }, [propPropertyId, isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setRoom(preselectedRoom ?? null);
    }
  }, [preselectedRoom, isEditMode]);

  return (
    <div className="booking-form-card">
      <form onSubmit={handleSubmit}>
        <div className="booking-form-header">
          <h3 className="booking-form-title">
            {isEditMode ? 'Edit Booking' : 'Create Booking'}
          </h3>
          <div className="booking-form-status">{loading ? 'Working...' : ''}</div>
        </div>

        {error && (
          <div className="booking-error">
            {error}
          </div>
        )}

        {!propPropertyId && (
          <div className="form-group">
            <label className="label">Property *</label>
            <select
              value={selectedPropertyId ?? ''}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value || null);
                setSelectedUnitId(null);
                setRoom(null);
              }}
              className="input"
              disabled={isEditMode}
              style={isEditMode ? { background: '#f8fafc', cursor: 'not-allowed' } : {}}
            >
              <option value="">-- Select property --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {isEditMode && (
              <div className="helper-text">Property cannot be changed when editing</div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="label">Unit *</label>
          <select
            value={selectedUnitId ?? ''}
            onChange={(e) => {
              setSelectedUnitId(e.target.value || null);
              setRoom(null);
            }}
            className="input"
            disabled={!selectedPropertyId}
          >
            <option value="">-- Select unit --</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.totalRooms ?? 0} rooms)
              </option>
            ))}
          </select>
          {!selectedPropertyId ? (
            <div className="helper-text">Please select a property first</div>
          ) : isEditMode ? (
            <div className="helper-text warning">
              ⚠️ Warning: Changing the unit may affect room availability
            </div>
          ) : null}
        </div>

        <div className="form-group">
          <label className="label">Room (optional)</label>
          <select
            value={getRoomId(room) ?? ''}
            onChange={(e) => {
              const rid = e.target.value;
              if (!rid) {
                setRoom(null);
                return;
              }
              const found = availableRooms.find(r => getRoomId(r) === rid);
              setRoom(found ?? null);
            }}
            className="input"
            disabled={!selectedUnitId}
          >
            <option value="">No room / choose later</option>
            {availableRooms.map((r) => {
              const roomId = getRoomId(r);
              return (
                <option key={roomId ?? r.number} value={roomId ?? ''}>
                  {r.number} {r.type ? `- ${r.type}` : ''}
                </option>
              );
            })}
          </select>
          <div className="helper-text">
            {!selectedUnitId
              ? 'Please select a unit first'
              : isEditMode
                ? 'You can change the room or leave blank for unit-level booking'
                : checkingAvailability
                  ? 'Checking availability...'
                  : 'Select check-in/check-out dates to see available rooms'}
          </div>
          {!isEditMode && availabilityMessage && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                background: availabilityMessage.startsWith('⚠️') ? '#fef3c7' : '#dcfce7',
                color: availabilityMessage.startsWith('⚠️') ? '#92400e' : '#14532d',
                border: `1px solid ${availabilityMessage.startsWith('⚠️') ? '#fde68a' : '#bbf7d0'}`
              }}
            >
              {availabilityMessage}
            </div>
          )}
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Guest Information</h4>

          {isEditMode ? (
            <div className="form-group">
              <label className="label">Guest</label>
              <input
                type="text"
                readOnly
                value={guestQuery}
                className="input"
                style={{ background: '#f8fafc', cursor: 'not-allowed' }}
              />
              <div className="helper-text">Guest cannot be changed when editing a booking</div>
            </div>
          ) : (
            <>
              {!creatingGuest && (
                <div className="form-group">
                  <label className="label">Search Guest</label>
                  <input
                    type="text"
                    placeholder="Search guests (type ≥ 2 chars)"
                    value={guestQuery}
                    onChange={(e) => {
                      setGuestQuery(e.target.value);
                      setSelectedGuestId(null);
                    }}
                    className="input"
                  />

                  {guestResults.length > 0 && (
                    <div className="guest-search-results">
                      {guestResults.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => {
                            setSelectedGuestId(g.id);
                            setGuestQuery(`${g.firstName} ${g.lastName}`);
                            setGuestResults([]);
                          }}
                          className={`guest-result-item ${selectedGuestId === g.id ? 'selected' : ''}`}
                        >
                          <div className="guest-name">{g.firstName} {g.lastName}</div>
                          <div className="guest-contact">{g.email ?? g.phone ?? ''}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="guest-actions">
                    <button
                      type="button"
                      onClick={() => setCreatingGuest(true)}
                      className="btn btn-secondary"
                    >
                      + Create guest
                    </button>

                    {selectedGuestId && (
                      <div className="guest-selected-badge">
                        ✓ Guest selected
                      </div>
                    )}
                  </div>
                </div>
              )}

              {creatingGuest && (
                <div className="create-guest-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="label">First Name *</label>
                      <input
                        value={newGuestFirstName}
                        onChange={(e) => setNewGuestFirstName(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Last Name *</label>
                      <input
                        value={newGuestLastName}
                        onChange={(e) => setNewGuestLastName(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      value={newGuestEmail}
                      onChange={(e) => setNewGuestEmail(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="label">Phone</label>
                      <input
                        value={newGuestPhone}
                        onChange={(e) => setNewGuestPhone(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Doc ID</label>
                      <input
                        value={newGuestDocId}
                        onChange={(e) => setNewGuestDocId(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-between">
                    <button
                      type="button"
                      onClick={() => setCreatingGuest(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await createGuestThenSelect();
                        } catch {
                          /* handled inside helper */
                        }
                      }}
                      className="btn btn-primary"
                    >
                      Create Guest
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-section">
          <h4 className="form-section-title">Booking Details</h4>
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Check-in *</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="input" />
            </div>
            <div className="form-group">
              <label className="label">Check-out *</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="input" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="label">Adults</label>
              <input type="number" min={1} value={adults} onChange={(e) => setAdults(parseInt(e.target.value || '1'))} className="input" />
            </div>
            <div className="form-group">
              <label className="label">Children</label>
              <input type="number" min={0} value={children} onChange={(e) => setChildren(parseInt(e.target.value || '0'))} className="input" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="label">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="input" />
            </div>
            <div className="form-group">
              <label className="label">Total Price</label>
              <input type="number" min={0} value={totalPrice} onChange={(e) => setTotalPrice(parseFloat(e.target.value || '0'))} className="input" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="label">Paid Amount</label>
              <input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value || '0'))} className="input" />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Special requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (isEditMode ? 'Updating…' : 'Creating…') : (isEditMode ? 'Update Booking' : 'Create Booking')}
          </button>
        </div>
      </form>
    </div>
  );
}