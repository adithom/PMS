import fetchClient from './fetchClient';
import type { ReservationStatus } from '../types';

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
  travelAgentId?: string;
  // Meal plan applied to all rooms
  mealPlanType?: string;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  // Booking source
  bookingSource?: string;
  // Advance payment on organizer's folio
  advancePaymentAmount?: number;
  advancePaymentMethod?: string;
}

// Member booking summary inside a reservation (Phase C shape).
export interface BookingSummaryDto {
  bookingId: string;
  guestId: string;
  guestName: string;
  unitId: string;
  unitName: string;
  roomNumber: string | null;
  cancelled: boolean;
  adults: number;
  children: number;
  totalPrice: number;
  balanceDue: number;
  folioId: string | null;
  folioNumber: string | null;
  specialRequests: string | null;
  isTwinBed: boolean;
  unitBaseRate: number | null;
  mealPlanPricePerNight: number | null;
  mealPlanType: 'CP' | 'MAP' | 'AP' | null;
  extraBeds: number | null;
  nightlyRate: number | null;
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
  specialRequests: string | null;
  overallStatus: ReservationStatus;
  totalRooms: number;
  totalGroupPrice: number;
  currency: string;
  createdAt: string;
  billingMode: 'SEPARATE' | 'CONSOLIDATED';
  travelAgentId: string | null;
  travelAgentName: string | null;
  bookingSource: string | null;
  reservationLevelPaidAmount: number;
  bookings: BookingSummaryDto[];
}

export interface BookingOccupancyUpdateDto {
  bookingId: string;
  guestId: string;
  adults: number;
  children: number;
  nightlyRate?: number;
  isTwinBed?: boolean;
  mealPlanType?: 'CP' | 'MAP' | 'AP' | null;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  extraBeds?: number;
  extraBedRatePerNight?: number;
}

export interface QuickHoldRoomRequestDto {
  unitId: string;
  count: number;
}

export interface QuickHoldDto {
  checkIn: string;
  checkOut: string;
  roomRequests: QuickHoldRoomRequestDto[];
  notes?: string;
}

export interface ReservationUpdateDto {
  organizerGuestId?: string;
  groupReference?: string;
  specialRequests?: string;
  bookingUpdates?: BookingOccupancyUpdateDto[];
  mealPlanType?: 'CP' | 'MAP' | 'AP' | null;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  bookingSource?: string;
  travelAgentId?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* API Methods                                                    */
/* ────────────────────────────────────────────────────────────── */

const reservationApi = {
  // CREATE
  createReservation: async (propertyId: string, data: GroupBookingCreationDto): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations`, data);
  },

  quickHold: async (propertyId: string, data: QuickHoldDto): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/reservations/quick-hold`, data);
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

  // UPDATE METADATA
  updateReservation: async (
    propertyId: string,
    reservationId: string,
    dto: ReservationUpdateDto
  ): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/reservations/${reservationId}`, dto);
  },
};

export default reservationApi;
