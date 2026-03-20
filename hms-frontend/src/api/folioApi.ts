import fetchClient from './fetchClient';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface ChargeDto {
  id: string;
  chargeDate: string;
  postingDate?: string;
  chargeCode: 'ROOM_RENT' | 'RESTAURANT' | 'LAUNDRY' | 'SPA' | 'TRAVEL_DESK' | 'SHOP' | 'MISC';
  description?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  isVoided?: boolean;
  voidReason?: string;
  notes?: string;
}

export interface FolioDto {
  id: string;
  folioNumber?: string;
  bookingId?: string;
  guestName?: string;
  propertyCode?: string;
  status?: 'OPEN' | 'CLOSED' | 'POSTED';
  folioType?: 'MASTER' | 'GUEST' | 'GROUP';
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  paidAmount?: number;
  balanceDue?: number;
  currency?: string;
  notes?: string;
  createdAt?: string;
  closedAt?: string;
  routedToFolioId?: string;
}

export interface FolioDetailDto extends FolioDto {
  charges?: ChargeDto[];
  payments?: any[]; // Maps to PaymentDto
}

export interface FolioCreationDto {
  bookingId?: string;
  guestId: string;
  folioType?: 'MASTER' | 'GUEST' | 'GROUP';
  notes?: string;
  createdBy?: string;
  routedToFolioId?: string;
}

export interface ChargeCreationDto {
  chargeDate: string;
  chargeCode: 'ROOM_RENT' | 'RESTAURANT' | 'LAUNDRY' | 'SPA' | 'TRAVEL_DESK' | 'SHOP' | 'MISC';
  description?: string;
  unitPrice: number;
  quantity?: number;
  taxRate?: number;
  discountRate?: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  postedBy?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* API Service (Removed '/api' prefix since fetchClient has it)   */
/* ────────────────────────────────────────────────────────────── */

const folioApi = {
  getFolioById: async (propertyId: string, id: string): Promise<FolioDto> => {
    return fetchClient.get(`/properties/${propertyId}/folios/${id}`);
  },

  getFolioDetails: async (propertyId: string, id: string): Promise<FolioDetailDto> => {
    return fetchClient.get(`/properties/${propertyId}/folios/${id}/details`);
  },

  getOpenFolios: async (propertyId: string): Promise<FolioDto[]> => {
    return fetchClient.get(`/properties/${propertyId}/folios/open`);
  },

  getFolioByBooking: async (propertyId: string, bookingId: string): Promise<FolioDto> => {
    return fetchClient.get(`/properties/${propertyId}/folios/booking/${bookingId}`);
  },

  getAllFoliosByBooking: async (propertyId: string, bookingId: string): Promise<FolioDto[]> => {
    return fetchClient.get(`/properties/${propertyId}/folios/booking/${bookingId}/all`);
  },

  createFolio: async (propertyId: string, data: FolioCreationDto): Promise<FolioDto> => {
    return fetchClient.post(`/properties/${propertyId}/folios`, data);
  },

  addCharge: async (propertyId: string, id: string, data: ChargeCreationDto): Promise<FolioDto> => {
    return fetchClient.post(`/properties/${propertyId}/folios/${id}/charges`, data);
  },

  reopenFolio: async (propertyId: string, id: string, reopenedBy?: string): Promise<FolioDto> => {
    const params = new URLSearchParams();
    if (reopenedBy) params.append('reopenedBy', reopenedBy);
    return fetchClient.patch(`/properties/${propertyId}/folios/${id}/reopen?${params.toString()}`);
  },

  postFolio: async (propertyId: string, id: string): Promise<FolioDto> => {
    return fetchClient.patch(`/properties/${propertyId}/folios/${id}/post`);
  },

  closeFolio: async (propertyId: string, id: string, closedBy?: string): Promise<FolioDto> => {
    const params = new URLSearchParams();
    if (closedBy) params.append('closedBy', closedBy);
    return fetchClient.patch(`/properties/${propertyId}/folios/${id}/close?${params.toString()}`);
  },

  voidCharge: async (
    propertyId: string, 
    id: string, 
    chargeId: string, 
    reason: string, 
    voidedBy?: string
  ): Promise<FolioDto> => {
    const params = new URLSearchParams({ reason });
    if (voidedBy) params.append('voidedBy', voidedBy);
    return fetchClient.delete(`/properties/${propertyId}/folios/${id}/charges/${chargeId}/void?${params.toString()}`);
  },

  routeCharge: async (
    propertyId: string, 
    id: string, 
    chargeId: string, 
    targetFolioId?: string
  ): Promise<FolioDto> => {
    const params = new URLSearchParams();
    if (targetFolioId) {
      params.append('targetFolioId', targetFolioId);
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return fetchClient.post(`/properties/${propertyId}/folios/${id}/charges/${chargeId}/route${queryString}`);
  }
};

export default folioApi;