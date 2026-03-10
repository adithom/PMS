// src/pages/Guests.tsx
import { useState, useEffect } from 'react';
import guestApi from '../api/guestApi';
import bookingApi from '../api/bookingApi';
import propertyApi from '../api/propertyApi';
import type { Guest, Booking, Property } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import GuestForm from '../components/GuestForm';
import ConfirmDialog from '../components/ConfirmDialog';

// Extended booking with property info
interface BookingWithProperty extends Booking {
  propertyName?: string;
  propertyCode?: string;
}

// Extended guest type with bookings
interface GuestWithStats extends Guest {
  totalStays?: number;
  allBookings?: BookingWithProperty[];
}

export default function Guests() {
  const [guests, setGuests] = useState<GuestWithStats[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<GuestWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  
  // Store all properties for lookup
  const [properties, setProperties] = useState<Property[]>([]);
  
  // Guest bookings modal
  const [selectedGuestForBookings, setSelectedGuestForBookings] = useState<GuestWithStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Client-side filtering
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredGuests(
        guests.filter(g =>
          g.fullName.toLowerCase().includes(query) ||
          g.email?.toLowerCase().includes(query) ||
          g.phone?.includes(searchQuery) ||
          g.docId?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredGuests(guests);
    }
  }, [searchQuery, guests]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // First, load all properties
      const allProperties = await propertyApi.getAll();
      setProperties(allProperties);
      
      // Then load guests
      const guestsData = await guestApi.getAll();
      
      // For each guest, fetch bookings from ALL properties and calculate stats
      const guestsWithStats = await Promise.all(
        guestsData.map(async (guest) => {
          try {
            let allBookings: BookingWithProperty[] = [];
            
            // Fetch bookings from each property
            await Promise.all(
              allProperties.map(async (property) => {
                try {
                  const bookings = await bookingApi.getByGuest(property.id, guest.id);
                  // Add property info to each booking
                  const bookingsWithProperty = bookings.map(b => ({
                    ...b,
                    propertyName: property.name,
                    propertyCode: property.code
                  }));
                  allBookings = [...allBookings, ...bookingsWithProperty];
                } catch (err) {
                  // If property has no bookings or error, just skip
                  console.log(`No bookings for guest ${guest.id} in property ${property.id}`);
                }
              })
            );
            
            // Calculate total stays (CONFIRMED, CHECKED_IN, CHECKED_OUT only)
            const totalStays = allBookings.filter(b => 
              b.status === 'CONFIRMED' || 
              b.status === 'CHECKED_IN' || 
              b.status === 'CHECKED_OUT'
            ).length;
            
            return {
              ...guest,
              totalStays,
              allBookings
            };
          } catch (err) {
            console.error(`Error loading bookings for guest ${guest.id}:`, err);
            return {
              ...guest,
              totalStays: 0,
              allBookings: []
            };
          }
        })
      );
      
      setGuests(guestsWithStats);
      setFilteredGuests(guestsWithStats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = () => {
    setEditingGuest(null);
    setShowForm(true);
  };

  const handleEditGuest = (e: React.MouseEvent, guest: Guest) => {
    e.stopPropagation();
    setEditingGuest(guest);
    setShowForm(true);
  };

  const handleSaveGuest = async (data: Partial<Guest>) => {
    try {
      if (editingGuest) {
        await guestApi.partialUpdate(editingGuest.id, data);
      } else {
        await guestApi.create(data as any);
      }
      setShowForm(false);
      setEditingGuest(null);
      await loadData();
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteGuest = async () => {
    if (!deletingGuest) return;
    
    try {
      await guestApi.delete(deletingGuest.id);
      setDeletingGuest(null);
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleGuestClick = (guest: GuestWithStats) => {
    setSelectedGuestForBookings(guest);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return { bg: '#dbeafe', text: '#1e40af' };
      case 'CHECKED_IN':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'CHECKED_OUT':
        return { bg: '#e0e7ff', text: '#4338ca' };
      case 'CANCELLED':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'PENDING':
        return { bg: '#fef3c7', text: '#92400e' };
      case 'NO_SHOW':
        return { bg: '#fecaca', text: '#7f1d1d' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return <LoadingSpinner />;
  if (error && !selectedGuestForBookings) return <ErrorMessage message={error} onRetry={loadData} />;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 600, color: '#0f172a' }}>
          Guests
        </h1>
        <button
          onClick={handleAddGuest}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
        >
          + Add Guest
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or document ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.875rem 1rem',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '1rem',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#2563eb'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
        />
      </div>

      {/* Guest Count */}
      <div style={{
        marginBottom: '1rem',
        color: '#64748b',
        fontSize: '0.875rem',
        fontWeight: 500
      }}>
        {filteredGuests.length} {filteredGuests.length === 1 ? 'guest' : 'guests'}
      </div>

      {/* Guests List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {filteredGuests.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              {searchQuery ? 'No guests found' : 'No guests yet'}
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              {searchQuery 
                ? 'Try adjusting your search query' 
                : 'Add your first guest to get started'}
            </div>
          </div>
        ) : (
          filteredGuests.map((guest) => (
            <div
              key={guest.id}
              onClick={() => handleGuestClick(guest)}
              style={{
                background: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                <div style={{ flex: 1 }}>
                  {/* Guest Name */}
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    marginBottom: '0.75rem'
                  }}>
                    {guest.fullName}
                  </div>

                  {/* Guest Details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#64748b'
                  }}>
                    {guest.email && (
                      <div>
                        <span style={{ fontWeight: 500, color: '#475569' }}>Email:</span> {guest.email}
                      </div>
                    )}
                    {guest.phone && (
                      <div>
                        <span style={{ fontWeight: 500, color: '#475569' }}>Phone:</span> {guest.phone}
                      </div>
                    )}
                    {guest.docId && (
                      <div>
                        <span style={{ fontWeight: 500, color: '#475569' }}>Document ID:</span> {guest.docId}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 500, color: '#475569' }}>Total Stays:</span>{' '}
                      <span style={{ 
                        color: (guest.totalStays || 0) > 0 ? '#059669' : '#64748b',
                        fontWeight: (guest.totalStays || 0) > 0 ? 600 : 400
                      }}>
                        {guest.totalStays || 0}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginLeft: '1rem'
                }}>
                  <button
                    onClick={(e) => handleEditGuest(e, guest)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingGuest(guest);
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Guest Bookings Modal */}
      {selectedGuestForBookings && (
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
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setSelectedGuestForBookings(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 600 }}>
                  {selectedGuestForBookings.fullName}
                </h2>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  All Bookings ({selectedGuestForBookings.allBookings?.length || 0})
                </div>
              </div>
              <button
                onClick={() => setSelectedGuestForBookings(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '1.5rem' 
            }}>
              {!selectedGuestForBookings.allBookings || selectedGuestForBookings.allBookings.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem', 
                  background: '#f8fafc',
                  borderRadius: '8px',
                  color: '#64748b'
                }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    No bookings found
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    This guest has no bookings yet
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedGuestForBookings.allBookings
                    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
                    .map((booking) => {
                      const statusColors = getStatusColor(booking.status);
                      
                      return (
                        <div
                          key={booking.id}
                          style={{
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '1.25rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start',
                            marginBottom: '1rem'
                          }}>
                            <div>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{
                                  fontSize: '1.125rem',
                                  fontWeight: 600,
                                  color: '#0f172a'
                                }}>
                                  {booking.propertyName}
                                </div>
                                <div style={{
                                  padding: '4px 10px',
                                  background: statusColors.bg,
                                  color: statusColors.text,
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}>
                                  {booking.status}
                                </div>
                              </div>
                              <div style={{
                                fontSize: '0.875rem',
                                color: '#64748b'
                              }}>
                                Property Code: {booking.propertyCode}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#64748b'
                          }}>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Room:</span>{' '}
                              {(booking as any).roomNumber || 'Not assigned'}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Unit:</span>{' '}
                              {(booking as any).unitName || 'N/A'}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Check-in:</span>{' '}
                              {formatDate(booking.checkIn)}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Check-out:</span>{' '}
                              {formatDate(booking.checkOut)}
                            </div>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Guests:</span>{' '}
                              {booking.adults} adults, {booking.children} children
                            </div>
                            <div>
                              <span style={{ fontWeight: 500, color: '#475569' }}>Total:</span>{' '}
                              {booking.currency} {booking.totalPrice?.toFixed(2) || '0.00'}
                            </div>
                          </div>

                          {booking.specialRequests && (
                            <div style={{
                              marginTop: '0.75rem',
                              padding: '0.75rem',
                              background: '#fef3c7',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              color: '#92400e'
                            }}>
                              <span style={{ fontWeight: 600 }}>Special Requests:</span> {booking.specialRequests}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guest Form Modal */}
      {showForm && (
        <GuestForm
          guest={editingGuest}
          onSave={handleSaveGuest}
          onCancel={() => {
            setShowForm(false);
            setEditingGuest(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingGuest && (
        <ConfirmDialog
          title="Delete Guest"
          message={`Are you sure you want to delete ${deletingGuest.fullName}? This action cannot be undone.`}
          onConfirm={handleDeleteGuest}
          onCancel={() => setDeletingGuest(null)}
        />
      )}
    </div>
  );
}