// BookingForm.tsx
import React, { useEffect, useState } from 'react';
import propertyApi from '../api/propertyApi';
import guestApi from '../api/guestApi';
import bookingApi from '../api/bookingApi';
import roomApi from '../api/roomApi';
import type { Property, Room } from '../types';

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
  onSuccess?: (created: any) => void;
  onCancel?: () => void;
};

export default function RoomBookingForm({
  propertyId: propPropertyId = null,
  room: preselectedRoom = null,
  onSuccess,
  onCancel
}: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(propPropertyId);
  const [room, setRoom] = useState<Room | null>(preselectedRoom ?? null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Booking fields
  const [checkIn, setCheckIn] = useState<string>('');
  const [checkOut, setCheckOut] = useState<string>('');
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('INR');
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [status, setStatus] = useState<string>('PENDING');

  // Guest search/create
  const [guestQuery, setGuestQuery] = useState<string>('');
  const [guestResults, setGuestResults] = useState<GuestSearchResult[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  const [creatingGuest, setCreatingGuest] = useState<boolean>(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState<string>('');
  const [newGuestLastName, setNewGuestLastName] = useState<string>('');
  const [newGuestEmail, setNewGuestEmail] = useState<string>('');
  const [newGuestPhone, setNewGuestPhone] = useState<string>('');
  const [newGuestDocId, setNewGuestDocId] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load properties (if parent didn't pass propertyId)
  useEffect(() => {
    (async () => {
      try {
        const props = await propertyApi.getAll();
        setProperties(props || []);
      } catch {
        // ignore here; show errors at submit if necessary
      }
    })();
  }, []);

  // load rooms when property selected and room not preselected
  useEffect(() => {
    const loadRooms = async () => {
      if (!selectedPropertyId) {
        setAvailableRooms([]);
        return;
      }
      try {
        const rooms = await roomApi.getByProperty(selectedPropertyId);
        setAvailableRooms(rooms || []);
      } catch {
        setAvailableRooms([]);
      }
    };
    loadRooms();
  }, [selectedPropertyId]);

  // guest search
  useEffect(() => {
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
          .map((g: any) => {
            const rawId = g.id ?? g.uuid ?? g.guestId ?? g._id ?? null;
            if (!rawId) return null;
            return {
              id: String(rawId),
              firstName: g.firstName ?? g.first_name ?? g.fname ?? '',
              lastName: g.lastName ?? g.last_name ?? g.lname ?? '',
              email: g.email,
              phone: g.phone
            } as GuestSearchResult;
          })
          .filter(Boolean) as GuestSearchResult[];
        setGuestResults(normalized);
      } catch {
        setGuestResults([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [guestQuery]);

  // create guest helper
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
      const created: any = await guestApi.create(payload);
      const idStr = String(created.id ?? created.uuid ?? created.guestId ?? created._id ?? '');
      if (!idStr) throw new Error('Guest creation returned no id');

      const normalized: GuestSearchResult = {
        id: idStr,
        firstName: created.firstName ?? payload.firstName,
        lastName: created.lastName ?? payload.lastName,
        email: created.email,
        phone: created.phone
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
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create guest');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validate = (): string | null => {
    if (!selectedPropertyId) return 'Property is required.';
    if (!selectedGuestId && !creatingGuest) return 'Please select or create a guest.';
    if (!checkIn) return 'Check-in date is required.';
    if (!checkOut) return 'Check-out date is required.';
    if (new Date(checkOut) <= new Date(checkIn)) return 'Check-out must be after check-in.';
    if (adults < 1) return 'At least 1 adult is required.';
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (creatingGuest) {
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

      const payload: any = {
        roomId: room ? (room as any).id ?? (room as any).roomId ?? null : null,
        guestId: guestIdToUse,
        unitId: room ? ((room as any).unitId ?? null) : null,
        status,
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
      const created = await bookingApi.create(pid, payload);

      setLoading(false);
      if (onSuccess) onSuccess(created);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create booking');
      setLoading(false);
    }
  };

  // sync prop changes
  useEffect(() => {
    setSelectedPropertyId(propPropertyId ?? null);
  }, [propPropertyId]);

  useEffect(() => {
    setRoom(preselectedRoom ?? null);
  }, [preselectedRoom]);

  // --- Styles reused inline for predictable behaviour without external CSS ---
  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 8px 30px rgba(2,6,23,0.08)',
    border: '1px solid rgba(15, 23, 42, 0.04)',
    maxWidth: 760,
    margin: '0 auto'
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    color: '#0f172a'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontWeight: 600,
    fontSize: 13
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: 8,
    border: '1px solid #e6eef8',
    outline: 'none',
    background: '#fff'
  };

  const smallMuted: React.CSSProperties = { color: '#64748b', fontSize: 12 };

  return (
    <div style={cardStyle}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Create Booking</h3>
          <div style={{ color: '#64748b', fontSize: 13 }}>{loading ? 'Working...' : ''}</div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Property select */}
        {!propPropertyId && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Property *</label>
            <select
              value={selectedPropertyId ?? ''}
              onChange={(e) => setSelectedPropertyId(e.target.value || null)}
              style={inputStyle}
            >
              <option value="">-- Select property --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Room */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Room </label>
          {room ? (
            <input
              type="text"
              readOnly
              value={`${room.number}${room.type ? ` — ${room.type}` : ''}`}
              style={{ ...inputStyle, background: '#f8fafc', cursor: 'default' }}
            />
          ) : (
            <>
              <select
                value={(room && ((room as any).id ?? (room as any).roomId)) ?? ''}
                onChange={(e) => {
                  const rid = e.target.value;
                  if (!rid) {
                    setRoom(null);
                    return;
                  }
                  const found = availableRooms.find(
                    (r) => String((r as any).id ?? (r as any).roomId) === rid
                  );
                  setRoom(found ?? null);
                }}
                style={inputStyle}
              >
                <option value="">No room / choose later</option>
                {availableRooms.map((r) => (
                  <option key={(r as any).id ?? (r as any).roomId} value={String((r as any).id ?? (r as any).roomId)}>
                    {r.number} {r.type ? `- ${r.type}` : ''}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6 }}>
                <small style={smallMuted}>You may leave blank if you want to allocate room later.</small>
              </div>
            </>
          )}
        </div>

        {/* Guest */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Guest *</label>

          {!creatingGuest && (
            <>
              <input
                type="text"
                placeholder="Search guests (type ≥ 2 chars)"
                value={guestQuery}
                onChange={(e) => {
                  setGuestQuery(e.target.value);
                  setSelectedGuestId(null);
                }}
                style={inputStyle}
              />

              {guestResults.length > 0 && (
                <div style={{ marginTop: 8, maxHeight: 160, overflow: 'auto', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  {guestResults.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => {
                        setSelectedGuestId(g.id);
                        setGuestQuery(`${g.firstName} ${g.lastName}`);
                        setGuestResults([]);
                      }}
                      style={{
                        padding: 10,
                        borderBottom: '1px solid #f8fafc',
                        cursor: 'pointer',
                        background: selectedGuestId === g.id ? '#eef2ff' : 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{g.firstName} {g.lastName}</div>
                      <div style={{ color: '#475569', fontSize: 12 }}>{g.email ?? g.phone ?? ''}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreatingGuest(true)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid #e6eef8',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  + Create guest
                </button>

                {selectedGuestId && (
                  <div style={{ alignSelf: 'center', color: '#064e3b', fontWeight: 700 }}>
                    Selected: {selectedGuestId}
                  </div>
                )}
              </div>
            </>
          )}

          {creatingGuest && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: '#fbfdff', border: '1px solid #eef6ff' }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newGuestFirstName}
                    onChange={(e) => setNewGuestFirstName(e.target.value)}
                    placeholder="First name"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #e6eef8' }}
                  />
                  <input
                    value={newGuestLastName}
                    onChange={(e) => setNewGuestLastName(e.target.value)}
                    placeholder="Last name"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #e6eef8' }}
                  />
                </div>
                <input
                  value={newGuestEmail}
                  onChange={(e) => setNewGuestEmail(e.target.value)}
                  placeholder="Email"
                  style={{ padding: 8, borderRadius: 8, border: '1px solid #e6eef8' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                    placeholder="Phone"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #e6eef8' }}
                  />
                  <input
                    value={newGuestDocId}
                    onChange={(e) => setNewGuestDocId(e.target.value)}
                    placeholder="Doc ID"
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #e6eef8' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setCreatingGuest(false)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: '1px solid #e6eef8',
                      background: '#fff',
                      cursor: 'pointer'
                    }}
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
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Create Guest
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dates & occupancy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Check-in *</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Check-out *</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Adults</label>
            <input type="number" min={1} value={adults} onChange={(e) => setAdults(parseInt(e.target.value || '1'))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Children</label>
            <input type="number" min={0} value={children} onChange={(e) => setChildren(parseInt(e.target.value || '0'))} style={inputStyle} />
          </div>
        </div>

        {/* Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total Price</label>
            <input type="number" min={0} value={totalPrice} onChange={(e) => setTotalPrice(parseFloat(e.target.value || '0'))} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Paid Amount</label>
            <input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value || '0'))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Special requests</label>
          <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: 90 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              if (onCancel) onCancel();
            }}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 8,
              border: '1px solid #e6eef8',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: loading ? '#94b3ff' : '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            {loading ? 'Creating…' : 'Create Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
