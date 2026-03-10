// src/pages/Bookings.tsx
import React, { useState, useEffect } from 'react';
import propertyApi from '../api/propertyApi';
import bookingApi from '../api/bookingApi';
import availabilityApi from '../api/availabilityApi';
import BookingForm from '../components/BookingForm';
import BookingsList from '../components/BookingsList';
import type { Property, Booking } from '../types';

type StatType = 'incoming' | 'inhouse' | 'checkouts' | 'all';

interface DayOccupancy {
  date: string;
  occupancyRate: number;
  bookedRooms: number;
}

// Helper function to normalize date to YYYY-MM-DD format
const toDateString = (date: Date | string): string => {
  if (typeof date === 'string') {
    // If already a string, ensure it's in YYYY-MM-DD format
    return date.split('T')[0];
  }
  // Convert Date object to YYYY-MM-DD in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to check if a date string falls within a range [start, end)
const isDateInRange = (dateStr: string, startStr: string, endStr: string): boolean => {
  return dateStr >= startStr && dateStr < endStr;
};

export default function Bookings() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthOccupancy, setMonthOccupancy] = useState<Record<string, DayOccupancy>>({});
  const [totalRooms, setTotalRooms] = useState<number>(0);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Daily stats
  const [incomingCount, setIncomingCount] = useState<number>(0);
  const [inhouseCount, setInhouseCount] = useState<number>(0);
  const [checkoutsCount, setCheckoutsCount] = useState<number>(0);
  const [occupancyRate, setOccupancyRate] = useState<number>(0);

  // UI State
  const [showBookingForm, setShowBookingForm] = useState<boolean>(false);
  const [showBookingsList, setShowBookingsList] = useState<boolean>(false);
  const [bookingsListType, setBookingsListType] = useState<StatType>('all');
  const [loading, setLoading] = useState<boolean>(false);

  // Load properties on mount
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const props = await propertyApi.getAll();
        setProperties(props || []);
        if (props && props.length > 0) {
          setSelectedPropertyId(props[0].id);
        }
      } catch (err) {
        console.error('Failed to load properties:', err);
      }
    };
    loadProperties();
  }, []);

  // Get total rooms for selected property
  useEffect(() => {
    if (!selectedPropertyId) return;

    const selectedProp = properties.find(p => p.id === selectedPropertyId);
    if (selectedProp && (selectedProp as any).totalRooms) {
      setTotalRooms((selectedProp as any).totalRooms);
    } else {
      setTotalRooms(0);
    }
  }, [selectedPropertyId, properties]);

  // Load occupancy data for the entire month using availability API
  useEffect(() => {
    if (!selectedPropertyId || totalRooms === 0) return;

    const loadMonthOccupancy = async () => {
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startDateStr = toDateString(firstDay);
        const endDateStr = toDateString(lastDay);

        // Single API call to get entire month's availability data
        const dailyData = await availabilityApi.getDailyAvailability(
          selectedPropertyId,
          startDateStr,
          endDateStr
        );

        // Convert array to map for easier lookup
        const occupancyMap: Record<string, DayOccupancy> = {};
        dailyData.forEach((day) => {
          occupancyMap[day.date] = {
            date: day.date,
            occupancyRate: day.occupancyRate,
            bookedRooms: day.bookedRooms
          };
        });

        setMonthOccupancy(occupancyMap);
      } catch (err) {
        console.error('Failed to load month occupancy:', err);
        setMonthOccupancy({});
      }
    };

    loadMonthOccupancy();
  }, [selectedPropertyId, currentMonth, totalRooms]);

  // Load daily stats when property or selected date changes
  useEffect(() => {
    if (!selectedPropertyId) return;

    const loadDailyStats = async () => {
      setLoading(true);
      try {
        const dateStr = toDateString(selectedDate);

        // Get bookings for the selected date
        const dayBookings = await bookingApi.getByDate(selectedPropertyId, dateStr, true);
        setBookings(dayBookings || []);

        // Filter for incoming (check-in today, status CONFIRMED)
        const incoming = dayBookings.filter(b => {
          const checkInStr = toDateString(b.checkIn);
          return checkInStr === dateStr && b.status === 'CONFIRMED';
        });
        setIncomingCount(incoming.length);

        // Filter for in-house (checkIn <= today < checkOut, status CHECKED_IN)
        // These are guests currently occupying rooms
        const inhouse = dayBookings.filter(b => {
          const checkInStr = toDateString(b.checkIn);
          const checkOutStr = toDateString(b.checkOut);
          return b.status === 'CHECKED_IN' && isDateInRange(dateStr, checkInStr, checkOutStr);
        });
        setInhouseCount(inhouse.length);

        // Filter for checkouts (check-out today, status CHECKED_IN or CHECKED_OUT)
        const checkouts = dayBookings.filter(b => {
          const checkOutStr = toDateString(b.checkOut);
          return checkOutStr === dateStr && (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT');
        });
        setCheckoutsCount(checkouts.length);

        // Calculate occupancy rate
        const rate = totalRooms > 0 ? (inhouse.length / totalRooms) * 100 : 0;
        setOccupancyRate(rate);

      } catch (err) {
        console.error('Failed to load daily stats:', err);
        setIncomingCount(0);
        setInhouseCount(0);
        setCheckoutsCount(0);
        setOccupancyRate(0);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    loadDailyStats();
  }, [selectedPropertyId, selectedDate, totalRooms]);

  const handleStatClick = (statType: StatType) => {
    setBookingsListType(statType);
    setShowBookingsList(true);
  };

  const getFilteredBookings = (): Booking[] => {
    const dateStr = toDateString(selectedDate);

    switch (bookingsListType) {
      case 'incoming':
        return bookings.filter(b => {
          const checkInStr = toDateString(b.checkIn);
          return checkInStr === dateStr && b.status === 'CONFIRMED';
        });
      case 'inhouse':
        return bookings.filter(b => {
          const checkInStr = toDateString(b.checkIn);
          const checkOutStr = toDateString(b.checkOut);
          return b.status === 'CHECKED_IN' && isDateInRange(dateStr, checkInStr, checkOutStr);
        });
      case 'checkouts':
        return bookings.filter(b => {
          const checkOutStr = toDateString(b.checkOut);
          return checkOutStr === dateStr && (b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT');
        });
      case 'all':
      default:
        return bookings;
    }
  };

  const handleBookingUpdate = async () => {
    // Reload bookings for selected date
    if (selectedPropertyId) {
      try {
        const dateStr = toDateString(selectedDate);
        const dayBookings = await bookingApi.getByDate(selectedPropertyId, dateStr, true);
        setBookings(dayBookings || []);

        // Force recalculation by updating the date
        setSelectedDate(new Date(selectedDate));
      } catch (err) {
        console.error('Failed to reload bookings:', err);
      }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysInMonth = (date: Date): (Date | null)[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    while (days.length % 7 !== 0) days.push(null);

    return days;
  };

  const getOccupancyForDate = (date: Date | null): number | null => {
    if (!date) return null;
    const dateStr = toDateString(date);
    const dayData = monthOccupancy[dateStr];
    return dayData ? dayData.occupancyRate : null;
  };

  const getOccupancyColor = (rate: number | null) => {
    if (rate === null) return '#cbd5e1';
    if (rate >= 90) return '#dc2626';
    if (rate >= 75) return '#ea580c';
    if (rate >= 50) return '#f59e0b';
    if (rate >= 25) return '#84cc16';
    return '#22c55e';
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return toDateString(date) === toDateString(today);
  };

  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false;
    return toDateString(date1) === toDateString(date2);
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + offset);
    setCurrentMonth(newMonth);
  };

  return (
    <div style={{ padding: 20, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20
        }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>Bookings</h1>

          {/* Property Selector */}
          <div style={{
            background: '#fff',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            minWidth: 250
          }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              color: '#64748b',
              marginBottom: 4,
              fontWeight: 600
            }}>
              Property
            </label>
            <select
              value={selectedPropertyId ?? ''}
              onChange={(e) => setSelectedPropertyId(e.target.value || null)}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: 16,
                fontWeight: 600,
                background: 'transparent',
                cursor: 'pointer'
              }}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 20 }}>
          {/* Left Panel - Daily Stats */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>
                {isToday(selectedDate) ? 'Today' : 'Selected Date'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {formatDate(selectedDate)}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => handleStatClick('incoming')}
                style={{
                  padding: 16,
                  background: '#fef3c7',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  border: '2px solid transparent',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700, color: '#92400e' }}>
                  {incomingCount}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#78350f' }}>
                  Incoming Check-ins
                </div>
              </button>

              <button
                onClick={() => handleStatClick('inhouse')}
                style={{
                  padding: 16,
                  background: '#dbeafe',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  border: '2px solid transparent',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1e3a8a' }}>
                  {inhouseCount}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e40af' }}>
                  In-House
                </div>
              </button>

              <button
                onClick={() => handleStatClick('checkouts')}
                style={{
                  padding: 16,
                  background: '#fce7f3',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  border: '2px solid transparent',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.borderColor = '#ec4899';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700, color: '#831843' }}>
                  {checkoutsCount}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#9f1239' }}>
                  Checkouts
                </div>
              </button>

              <button
                onClick={() => handleStatClick('all')}
                style={{
                  padding: 16,
                  background: '#dcfce7',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  border: '2px solid transparent',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.borderColor = '#22c55e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ fontSize: 32, fontWeight: 700, color: '#14532d' }}>
                  {Number.isFinite(occupancyRate) ? occupancyRate.toFixed(1) + '%' : '--'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>
                  Occupancy Rate
                </div>
                <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                  {inhouseCount} / {totalRooms} rooms
                </div>
              </button>
            </div>
          </div>

          {/* Right Panel - Calendar */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => changeMonth(-1)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>‹</button>
                <button onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Today</button>
                <button onClick={() => changeMonth(1)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>›</button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', padding: 8 }}>
                  {day}
                </div>
              ))}

              {getDaysInMonth(currentMonth).map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} />;
                }

                const occupancy = getOccupancyForDate(date);
                const isSelected = isSameDay(date, selectedDate);
                const isTodayDate = isToday(date);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      padding: 8,
                      textAlign: 'center',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? '#2563eb' : 'transparent',
                      color: isSelected ? '#fff' : '#1e293b',
                      border: isTodayDate && !isSelected ? '2px solid #2563eb' : '2px solid transparent',
                      position: 'relative',
                      minHeight: 60,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#f1f5f9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{date.getDate()}</div>
                    {occupancy !== null ? (
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: isSelected ? 'rgba(255,255,255,0.2)' : getOccupancyColor(occupancy),
                        color: '#fff',
                        padding: '2px 4px',
                        borderRadius: 4,
                        marginTop: 4
                      }}>
                        {occupancy.toFixed(0)}%
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>--</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: '#22c55e', borderRadius: 2 }} />
                <span>0-25%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: '#84cc16', borderRadius: 2 }} />
                <span>25-50%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }} />
                <span>50-75%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: '#ea580c', borderRadius: 2 }} />
                <span>75-90%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, background: '#dc2626', borderRadius: 2 }} />
                <span>90-100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Create Booking Button */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowBookingForm(true)}
            style={{
              width: '100%',
              padding: 20,
              background: '#fff',
              border: '2px dashed #cbd5e1',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              color: '#2563eb',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            + Create Booking
          </button>
        </div>

        {/* Booking Form Modal */}
        {showBookingForm && (
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
            padding: 20,
            overflow: 'auto'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 800,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}>
              <button
                onClick={() => setShowBookingForm(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#64748b',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
              >
                ×
              </button>

              <BookingForm
                propertyId={selectedPropertyId}
                onSuccess={async () => {
                  setShowBookingForm(false);
                  await handleBookingUpdate();
                }}
                onCancel={() => setShowBookingForm(false)}
              />
            </div>
          </div>
        )}

        {/* Bookings List Modal */}
        {showBookingsList && selectedPropertyId && (
          <BookingsList
            bookings={getFilteredBookings()}
            propertyId={selectedPropertyId}
            listType={bookingsListType}
            onClose={() => setShowBookingsList(false)}
            onUpdate={handleBookingUpdate}
          />
        )}
      </div>
    </div>
  );
}