// src/api/bookingApi.ts
import api from './fetchClient';
import type { Booking, BookingStatus, RoomAssignmentDto } from '../types';
export type { RoomAssignmentDto } from '../types';

export interface NewTravelAgentDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  iataCode?: string;
  commissionRate?: number;
  address?: string;
}

export interface BookingCreationDto {
  roomId?: string;
  guestId: string;
  unitId: string;
  status?: BookingStatus;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  currency?: string;
  nightlyRate?: number;
  paidAmount?: number;
  specialRequests?: string;
  isTwinBed?: boolean;
  referenceNumber?: string;
  travelAgentId?: string;
  newTravelAgent?: NewTravelAgentDto;
  mealPlanType?: string;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  extraBeds?: number;
  extraBedRatePerNight?: number;
  extraBedChargeCode?: 'ROOM_RENT' | 'MISC';
  bookingSource?: string;
  additionalGuestIds?: string[];
}

export interface BookingUpdatePayload extends Omit<BookingCreationDto, 'nightlyRate'> {
  totalPrice?: number;
  nightlyRate?: number;
  clearMealPlan?: boolean;
}

export interface ExtendBookingRequestDto {
  newCheckOutDate: string; // Format: YYYY-MM-DD
  extensionNightlyRate?: number; // How much to charge per extra night
  notes?: string;
}

export interface EarlyCheckoutRequestDto {
  newCheckOutDate: string; // Format: YYYY-MM-DD
  policy: 'NO_CHANGE' | 'REFUND_UNUSED_NIGHTS' | 'CUSTOM';
  customRoomCharge?: number; // Optional penalty/adjusted rate, used if policy is 'CUSTOM'
}

export interface RoomShiftRequestDto {
  newRoomId: string;
  shiftDate: string; // Format: YYYY-MM-DD
  newRate?: number;
  notes?: string;
}


const bookingApi = {
  // Get all bookings for a property
  getByProperty: (propertyId: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings`),

  // Get bookings for a specific date
  getByDate: (propertyId: string, date: string, includeAll: boolean = false) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings/date`, { date, includeAll }),

  // Get a single booking by ID
  getById: (propertyId: string, bookingId: string) =>
    api.get<Booking>(`/properties/${propertyId}/bookings/${bookingId}`),

  // Get bookings by guest
  getByGuest: (propertyId: string, guestId: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings/guest/${guestId}`),

  // Get bookings by room
  getByRoom: (propertyId: string, roomId: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings/room/${roomId}`),

  // Get bookings by unit
  getByUnit: (propertyId: string, unitId: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings/unit/${unitId}`),

  // Get bookings by status
  getByStatus: (propertyId: string, status: BookingStatus) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings`, { status }),

  // Get bookings by check-in date range
  getByCheckInRange: (propertyId: string, checkInFrom: string, checkInTo: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings`, { checkInFrom, checkInTo }),

  // Create a new booking
  create: (propertyId: string, data: BookingCreationDto) =>
    api.post<Booking>(`/properties/${propertyId}/bookings`, data),

  // Full update (PUT)
  update: (propertyId: string, bookingId: string, data: Partial<BookingUpdatePayload>) =>
    api.put<Booking>(`/properties/${propertyId}/bookings/${bookingId}`, data),

  // Partial update (PATCH)
  partialUpdate: (propertyId: string, bookingId: string, data: Partial<BookingUpdatePayload>) =>
    api.patch<Booking>(`/properties/${propertyId}/bookings/${bookingId}`, data),

  // Update booking status; optional `reason` is captured on the booking when status=CANCELLED.
  // PATCH /api/properties/{propertyId}/bookings/{id}/status/{status}?reason=...
  updateStatus: (propertyId: string, bookingId: string, status: BookingStatus, reason?: string) => {
    const query = reason && reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : '';
    return api.patch<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/status/${status}${query}`,
      undefined
    );
  },

  // Delete a booking
  delete: (propertyId: string, bookingId: string) =>
    api.delete<void>(`/properties/${propertyId}/bookings/${bookingId}`),

  // ═══════════════════════════════════════════════════════════
  // SPECIAL OPERATIONS
  // ═══════════════════════════════════════════════════════════

  // Assign room to booking
  // POST /api/properties/{propertyId}/bookings/{id}/assign-room?roomId={roomId}
  assignRoom: (propertyId: string, bookingId: string, roomId: string) =>
    api.post<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/assign-room?roomId=${roomId}`,
      null
    ),

  // Check-in booking
  // POST /api/properties/{propertyId}/bookings/{id}/check-in
  checkIn: (propertyId: string, bookingId: string) =>
    api.post<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/check-in`,
      null
    ),

  // Standard Check-out
  // POST /api/properties/{propertyId}/bookings/{id}/checkout
  checkOut: (propertyId: string, bookingId: string) =>
    api.post<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/checkout`,
      null
    ),

  // Early Check-out
  // POST /api/properties/{propertyId}/bookings/{id}/checkout-early
  checkoutEarly: (propertyId: string, bookingId: string, data: EarlyCheckoutRequestDto) =>
    api.post<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/checkout-early`,
      data
    ),

  // Extend Booking
  // POST /api/properties/{propertyId}/bookings/{id}/extend
  extend: (propertyId: string, bookingId: string, data: ExtendBookingRequestDto) =>
    api.post<Booking>(
      `/properties/${propertyId}/bookings/${bookingId}/extend`,
      data
    ),

  // Shift guest to a different room (CHECKED_IN bookings only)
  // POST /api/properties/{propertyId}/bookings/{bookingId}/shift-room
  shiftRoom: (propertyId: string, bookingId: string, data: RoomShiftRequestDto) =>
    api.post<RoomAssignmentDto[]>(
      `/properties/${propertyId}/bookings/${bookingId}/shift-room`,
      data
    ),

  // Fetch all bookings overlapping a date range (single server call).
  // GET /api/properties/{propertyId}/bookings/range?from=…&to=…
  getRange: (propertyId: string, from: string, to: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/bookings/range`, { from, to }),

  // Fetch all room assignments for a booking.
  // GET /api/properties/{propertyId}/bookings/{bookingId}/room-assignments
  getRoomAssignments: (propertyId: string, bookingId: string) =>
    api.get<RoomAssignmentDto[]>(
      `/properties/${propertyId}/bookings/${bookingId}/room-assignments`
    ),
};

export default bookingApi;
