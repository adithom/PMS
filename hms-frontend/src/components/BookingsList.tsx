// BookingsList.tsx
import React, { useState } from 'react';
import bookingApi from '../api/bookingApi';
import BookingForm from './BookingForm';
import type { Booking, BookingStatus } from '../types';

type StatType = 'incoming' | 'inhouse' | 'checkouts' | 'all';

interface BookingsListProps {
  bookings: Booking[];
  propertyId: string;
  listType: StatType;
  onClose: () => void;
  onUpdate: () => void;
}

export default function BookingsList({
  bookings,
  propertyId,
  listType,
  onClose,
  onUpdate
}: BookingsListProps) {
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'checkin' | 'checkout' | 'cancel' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTitle = () => {
    switch (listType) {
      case 'incoming':
        return 'Incoming Check-ins';
      case 'inhouse':
        return 'In-House Guests';
      case 'checkouts':
        return 'Checkouts';
      case 'all':
      default:
        return 'All Bookings';
    }
  };

  const handleStatusUpdate = async (booking: Booking, newStatus: BookingStatus) => {
    setLoading(true);
    setError(null);
    try {
      if (!booking.id) {
        setError('Booking ID is missing.');
        setLoading(false);
        return;
      }
      await bookingApi.updateStatus(propertyId, booking.id, newStatus);
      await onUpdate();
      setShowConfirmDialog(false);
      setSelectedBooking(null);
      setConfirmAction(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = (booking: Booking) => {
    setSelectedBooking(booking);
    setConfirmAction('checkin');
    setShowConfirmDialog(true);
  };

  const handleCheckOut = (booking: Booking) => {
    setSelectedBooking(booking);
    setConfirmAction('checkout');
    setShowConfirmDialog(true);
  };

  const handleCancel = (booking: Booking) => {
    setSelectedBooking(booking);
    setConfirmAction('cancel');
    setShowConfirmDialog(true);
  };

  const handleEdit = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowEditForm(true);
  };

  const confirmActionHandler = async () => {
  if (!selectedBooking || !confirmAction) return;

  if (confirmAction === 'checkin') {
    // Use dedicated check-in endpoint
    setLoading(true);
    setError(null);
    try {
      if (!selectedBooking.id) {
        setError('Booking ID is missing.');
        return;
      }
      await bookingApi.checkIn(propertyId, selectedBooking.id);
      await onUpdate();
      setShowConfirmDialog(false);
      setSelectedBooking(null);
      setConfirmAction(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  } else {
    // Use handleStatusUpdate for checkout and cancel
    switch (confirmAction) {
      case 'checkout':
        handleStatusUpdate(selectedBooking, 'CHECKED_OUT');
        break;
      case 'cancel':
        handleStatusUpdate(selectedBooking, 'CANCELLED');
        break;
    }
  }
};

  const getStatusColor = (status: BookingStatus) => {
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

  const getActionButtons = (booking: Booking) => {
    const buttons = [];

    // Check-in button (only for CONFIRMED bookings)
    if (booking.status === 'CONFIRMED') {
      buttons.push(
        <button
          key="checkin"
          onClick={() => handleCheckIn(booking)}
          style={{
            padding: '0.5rem 1rem',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
        >
          Check In
        </button>
      );
    }

    // Check-out button (only for CHECKED_IN bookings)
    if (booking.status === 'CHECKED_IN') {
      buttons.push(
        <button
          key="checkout"
          onClick={() => handleCheckOut(booking)}
          style={{
            padding: '0.5rem 1rem',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#4f46e5'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#6366f1'}
        >
          Check Out
        </button>
      );
    }

    // Cancel button (only for PENDING or CONFIRMED)
    if (booking.status === 'PENDING' || booking.status === 'CONFIRMED') {
      buttons.push(
        <button
          key="cancel"
          onClick={() => handleCancel(booking)}
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
          Cancel
        </button>
      );
    }

    // Edit button (available except for CANCELLED and CHECKED_OUT)
    if (booking.status !== 'CANCELLED' && booking.status !== 'CHECKED_OUT') {
      buttons.push(
        <button
          key="edit"
          onClick={() => handleEdit(booking)}
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
      );
    }

    return buttons;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        maxWidth: 900,
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: 24,
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              {getTitle()}
            </h2>
            <div style={{ marginTop: 4, fontSize: 14, color: '#6b7280' }}>
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#64748b',
              width: 36,
              height: 36,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            margin: 20,
            padding: 12,
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 8,
            fontSize: 14
          }}>
            {error}
          </div>
        )}

        {/* Bookings List */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 24
        }}>
          {bookings.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#6b7280'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>No bookings found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookings.map((booking) => {
                const statusColors = getStatusColor(booking.status);
                
                return (
                  <div
                    key={booking.id}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: 16,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      {/* Left side - Guest & Room Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>
                            {(booking as any).guestName || 'Guest'}
                          </div>
                          <div style={{
                            padding: '4px 10px',
                            background: statusColors.bg,
                            color: statusColors.text,
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600
                          }}>
                            {booking.status}
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: 12,
                          fontSize: 14,
                          color: '#6b7280'
                        }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>Room:</span> {(booking as any).roomNumber || 'Not assigned'}
                          </div>
                          <div>
                            <span style={{ fontWeight: 500 }}>Unit:</span> {(booking as any).unitName || 'N/A'}
                          </div>
                          <div>
                            <span style={{ fontWeight: 500 }}>Check-in:</span> {formatDate(booking.checkIn)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 500 }}>Check-out:</span> {formatDate(booking.checkOut)}
                          </div>
                          <div>
                            <span style={{ fontWeight: 500 }}>Guests:</span> {booking.adults} adults, {booking.children} children
                          </div>
                          <div>
                            <span style={{ fontWeight: 500 }}>Total:</span> {booking.currency} {booking.totalPrice?.toFixed(2) || '0.00'}
                          </div>
                        </div>

                        {booking.specialRequests && (
                          <div style={{
                            marginTop: 8,
                            padding: 8,
                            background: '#fef3c7',
                            borderRadius: 6,
                            fontSize: 13,
                            color: '#92400e'
                          }}>
                            <span style={{ fontWeight: 600 }}>Special Requests:</span> {booking.specialRequests}
                          </div>
                        )}
                      </div>

                      {/* Right side - Action Buttons */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginLeft: 16
                      }}>
                        {getActionButtons(booking)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002,
          padding: 20,
          overflow: 'auto'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            maxWidth: 800,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <BookingForm
              propertyId={propertyId}
              booking={selectedBooking}
              onSuccess={(updated) => {
                setShowEditForm(false);
                setSelectedBooking(null);
                onUpdate();
              }}
              onCancel={() => {
                setShowEditForm(false);
                setSelectedBooking(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600 }}>
              Confirm {confirmAction === 'checkin' ? 'Check-in' : confirmAction === 'checkout' ? 'Check-out' : 'Cancellation'}
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: 14 }}>
              {confirmAction === 'checkin' && `Check in ${(selectedBooking as any).guestName || 'this guest'}?`}
              {confirmAction === 'checkout' && `Check out ${(selectedBooking as any).guestName || 'this guest'}?`}
              {confirmAction === 'cancel' && `Cancel booking for ${(selectedBooking as any).guestName || 'this guest'}? This action cannot be undone.`}
            </p>

            {error && (
              <div style={{
                marginBottom: 16,
                padding: 10,
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 6,
                fontSize: 13
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setSelectedBooking(null);
                  setConfirmAction(null);
                  setError(null);
                }}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  cursor: loading ? 'default' : 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmActionHandler}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: confirmAction === 'cancel' ? '#dc2626' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: loading ? 'default' : 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}