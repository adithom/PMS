import fetchClient from './fetchClient';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface GroupRoomRequestDto {
  unitId: string;
  roomId?: string;          // Optional: pin to a specific room
  childGuestId?: string;    // Optional: who is actually staying in this room
  adults?: number;
  children?: number;
  totalPrice?: number;
  specialRequests?: string;
}

export interface GroupBookingCreationDto {
  organizerGuestId: string;
  checkIn: string;          // Format: YYYY-MM-DD
  checkOut: string;         // Format: YYYY-MM-DD
  roomRequests: GroupRoomRequestDto[];
  groupReference?: string;  // e.g., "WEDDING-SHARMA-DEC25"
  specialRequests?: string;
  currency?: string;
  billingMode?: 'SEPARATE' | 'CONSOLIDATED';
}

// You can expand this later based on your actual Java GroupBookingSummaryDto
export interface GroupBookingSummaryDto {
  id: string;
  groupReference?: string;
  organizerName?: string;
  checkIn?: string;
  checkOut?: string;
  currency?: string;
  billingMode?: string;
  groupSubtotal?: number;
  groupTotalAmount?: number;
  groupBalanceDue?: number;
  roomSections?: any[]; 
  [key: string]: any; 
}

/* ────────────────────────────────────────────────────────────── */
/* API Methods                                                    */
/* ────────────────────────────────────────────────────────────── */

const groupBookingApi = {
  // CREATE
  createGroupBooking: async (propertyId: string, data: GroupBookingCreationDto): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/group-bookings`, data);
  },

  // READ
  getGroupBookings: async (propertyId: string): Promise<GroupBookingSummaryDto[]> => {
    return fetchClient.get(`/properties/${propertyId}/group-bookings`);
  },

  getGroupBooking: async (propertyId: string, parentBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.get(`/properties/${propertyId}/group-bookings/${parentBookingId}`);
  },

  // BILLING OPERATIONS
  consolidateBilling: async (propertyId: string, parentBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/group-bookings/${parentBookingId}/consolidate`);
  },

  separateBilling: async (propertyId: string, parentBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.patch(`/properties/${propertyId}/group-bookings/${parentBookingId}/separate`);
  },

  routeChildFolio: async (
    propertyId: string, 
    parentBookingId: string, 
    childBookingId: string, 
    targetFolioId?: string
  ): Promise<GroupBookingSummaryDto> => {
    const params = new URLSearchParams();
    if (targetFolioId) {
      params.append('targetFolioId', targetFolioId);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return fetchClient.patch(`/properties/${propertyId}/group-bookings/${parentBookingId}/children/${childBookingId}/route${queryString}`);
  },

  // CHECK-IN / CHECK-OUT
  checkInAll: async (propertyId: string, parentBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/group-bookings/${parentBookingId}/check-in-all`);
  },

  checkInChild: async (propertyId: string, parentBookingId: string, childBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/group-bookings/${parentBookingId}/children/${childBookingId}/check-in`);
  },

  checkOutChild: async (propertyId: string, parentBookingId: string, childBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/group-bookings/${parentBookingId}/children/${childBookingId}/check-out`);
  },

  // CANCEL
  cancelGroup: async (propertyId: string, parentBookingId: string): Promise<GroupBookingSummaryDto> => {
    return fetchClient.post(`/properties/${propertyId}/group-bookings/${parentBookingId}/cancel`);
  }
};

export default groupBookingApi;