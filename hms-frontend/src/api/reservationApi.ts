import fetchClient from './fetchClient';
import type { BookingStatus } from '../types';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface GroupRoomRequestDto {
  unitId: string;
  roomId?: string;          // Optional: pin to a specific room
  childGuestId?: string;    // Optional: who is actually staying in this room
  adults?: number;
  children?: number;
  nightlyRate?: number;
  specialRequests?: string;
  isTwinBed?: boolean;
}

export interface GroupBookingCreationDto {
  organizerGuestId: string;
  checkIn: string;          // YYYY-MM-DD
  checkOut: string;         // YYYY-MM-DD
  roomRequests: GroupRoomRequestDto[];
  groupReference?: string;
  specialRequests?: string;
  currency?: string;
  billingMode?: 'SEPARATE' | 'CONSOLIDATED';
}

// Member booking summary inside a reservation (Phase C shape).
export interface BookingSummaryDto {
  bookingId: string;
  guestId: string;
  guestName: string;
  unitId: string;
  unitName: string;
  roomNumber: string | null;
  status: BookingStatus;
  totalPrice: number;
  balanceDue: number;
  folioId: string | null;
  folioNumber: string | null;
  specialRequests: string | null;
  isTwinBed: boolean;
  unitBaseRate: number | null;
  mealPlanPricePerNight: number | null;
}

// Reservation = the group container (also wraps single bookings as 1-member reservations).
export interface GroupBookingSummaryDto {
  reservationId: string;
  reservationNumber: string | null;
  groupReference: string | null;
  organizerGuestId: string;
  organizerGuestName: string;
  checkIn: string;
  checkOut: string;
  overallStatus: BookingStatus;
  totalRooms: number;
  totalGroupPrice: number;
  currency: string;
  createdAt: string;
  billingMode: 'SEPARATE' | 'CONSOLIDATED';
  bookings: BookingSummaryDto[];
}

/* ────────────────────────────────────────────────────────────── */
/* API Methods                                                    */
/* ────────────────────────────────────────────────────────────── */

const reservationApi = {
  // CREATE
  createReservation: async (propertyId: string, data: GroupBookingCreationDto): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations`, data);
  },

  // READ
  getReservations: async (propertyId: string): Promise<GroupBookingSummaryDto[]> => {
    return fetchClient.get(`/properties/${propertyId}/reservations`);
  },

  getReservation: async (propertyId: string, reservationId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.get(`/properties/${propertyId}/reservations/${reservationId}`);
  },

  // BILLING OPERATIONS
  consolidateBilling: async (propertyId: string, reservationId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/reservations/${reservationId}/consolidate`);
  },

  separateBilling: async (propertyId: string, reservationId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/reservations/${reservationId}/separate`);
  },

  // CHECK-IN / CHECK-OUT
  checkInAll: async (propertyId: string, reservationId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations/${reservationId}/check-in-all`);
  },

  checkInBooking: async (propertyId: string, reservationId: string, bookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations/${reservationId}/bookings/${bookingId}/check-in`);
  },

  checkOutBooking: async (propertyId: string, reservationId: string, bookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations/${reservationId}/bookings/${bookingId}/check-out`);
  },

  // CANCEL
  cancelReservation: async (propertyId: string, reservationId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations/${reservationId}/cancel`);
  },

  // RESCHEDULE
  reschedule: async (
    propertyId: string,
    reservationId: string,
    dto: { newCheckIn: string; newCheckOut: string; reason?: string }
  ): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/reservations/${reservationId}/reschedule`, dto);
  },
};

export default reservationApi;
