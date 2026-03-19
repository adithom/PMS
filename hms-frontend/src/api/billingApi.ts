import apiClient from './fetchClient';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface BillDto {
  id: string;
  folioId?: string;
  generationBatchId?: string;
  PropertyName?: string;
  PropertyAddress?: string;
  gstNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  folioNumber?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  guestGstNumber?: string;
  roomNumber?: string;
  checkIn?: string;
  checkOut?: string;
  charges?: any[]; // Maps to ChargeDto[]
  subtotal?: number;
  totalTax?: number;
  totalDiscount?: number;
  grandTotal?: number;
  amountPaid?: number;
  balanceDue?: number;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
}

export interface DoubleBillDto {
  roomRentBill?: BillDto;
  ancillaryBill?: BillDto;
}

export interface GroupBill {
  id: string;
  invoiceNumber?: string;
  category?: 'ROOM_RENT' | 'ANCILLARY';
  guestGstNumber?: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  generationBatchId?: string;
  billDate?: string;
  generatedAt?: string;
  pdfFilePath?: string;
  roomBreakdownJson?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voided?: boolean;
}

// GroupBillSectionDto & GroupDoubleBillDto are structurally massive in the JSON, 
// using 'any' fallback here for complex nested objects unless strict typing is required.
export interface GroupDoubleBillDto {
  roomRentBill?: any;
  ancillaryBill?: any;
}

/* ────────────────────────────────────────────────────────────── */
/* API Service                                                    */
/* ────────────────────────────────────────────────────────────── */

const billingApi = {
  // Standard Guest/Folio Bills
  generateBills: async (folioId: string, guestGstNumber?: string): Promise<DoubleBillDto> => {
    const params = new URLSearchParams();
    if (guestGstNumber) params.append('guestGstNumber', guestGstNumber);
    return apiClient.post(`/api/bills/generate/${folioId}?${params.toString()}`);
  },

  voidBill: async (billId: string, reason: string): Promise<BillDto> => {
    const params = new URLSearchParams({ reason });
    return apiClient.post(`/api/bills/${billId}/void?${params.toString()}`);
  },

  voidActiveBillsForFolio: async (folioId: string, reason: string): Promise<BillDto[]> => {
    const params = new URLSearchParams({ reason });
    return apiClient.post(`/api/bills/folio/${folioId}/void-active?${params.toString()}`);
  },

  // Group Booking Bills
  getGroupBills: async (propertyId: string, parentBookingId: string): Promise<GroupBill[]> => {
    return apiClient.get(`/api/properties/${propertyId}/group-bookings/${parentBookingId}/bills`);
  },

  generateGroupBills: async (propertyId: string, parentBookingId: string, guestGstNumber?: string): Promise<GroupDoubleBillDto> => {
    const params = new URLSearchParams();
    if (guestGstNumber) params.append('guestGstNumber', guestGstNumber);
    return apiClient.post(`/api/properties/${propertyId}/group-bookings/${parentBookingId}/bills/generate?${params.toString()}`);
  },

  voidGroupBill: async (propertyId: string, parentBookingId: string, groupBillId: string, reason: string): Promise<GroupBill> => {
    const params = new URLSearchParams({ reason });
    return apiClient.post(`/api/properties/${propertyId}/group-bookings/${parentBookingId}/bills/${groupBillId}/void?${params.toString()}`);
  },

  voidAllGroupBills: async (propertyId: string, parentBookingId: string, reason: string): Promise<GroupBill[]> => {
    const params = new URLSearchParams({ reason });
    return apiClient.post(`/api/properties/${propertyId}/group-bookings/${parentBookingId}/bills/void-all?${params.toString()}`);
  }
};

export default billingApi;