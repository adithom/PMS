import apiClient from './fetchClient';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface PaymentDto {
  id: string;
  paymentNumber?: string;
  bookingId?: string;       // set for folio (booking-level) payments
  reservationId?: string;   // set for reservation-level (master) payments
  folioId?: string;
  folioNumber?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'DIGITAL_WALLET' | 'AGENT_BILLING';
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  transactionId?: string;
  cardLastFour?: string;
  cardType?: string;
  referenceNumber?: string;
  upiId?: string;
  refundedAmount?: number;
  isRefundable?: boolean;
  refundableAmount?: number;
  refundReason?: string;
  refundedAt?: string;
  processedBy?: string;
  paymentDate?: string;
  createdAt?: string;
  notes?: string;
  travelAgentId?: string;
}

export interface PaymentUpdateDto {
  amount?: number;
  notes?: string;
}

export interface PaymentCreationDto {
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'DIGITAL_WALLET' | 'AGENT_BILLING';
  transactionId?: string;
  cardLastFour?: string;
  cardType?: string;
  bankName?: string;
  accountNumber?: string;
  referenceNumber?: string;
  upiId?: string;
  notes?: string;
  processedBy?: string;
  travelAgentId?: string;
}

export interface RefundDto {
  amount: number;
  reason: string;
  processedBy?: string;
}

/* ────────────────────────────────────────────────────────────── */
/* API Service                                                    */
/* ────────────────────────────────────────────────────────────── */

const paymentApi = {
  getPaymentsByFolio: async (propertyId: string, folioId: string): Promise<PaymentDto[]> => {
    return apiClient.get(`/properties/${propertyId}/folios/${folioId}/payments`);
  },

  recordPayment: async (propertyId: string, folioId: string, data: PaymentCreationDto): Promise<PaymentDto> => {
    return apiClient.post(`/properties/${propertyId}/folios/${folioId}/payments`, data);
  },

  // Reservation-level (master) payment. Tags Payment.reservationId. When reservation
  // is in SEPARATE billing mode, bills generated next will distribute the payment as
  // an applied credit equally across member booking bills.
  recordReservationPayment: async (propertyId: string, reservationId: string, data: PaymentCreationDto): Promise<PaymentDto> => {
    return apiClient.post(`/properties/${propertyId}/reservations/${reservationId}/payments`, data);
  },

  getPaymentsByReservation: async (propertyId: string, reservationId: string): Promise<PaymentDto[]> => {
    return apiClient.get(`/properties/${propertyId}/reservations/${reservationId}/payments`);
  },

  getAllPaymentsForReservation: async (propertyId: string, reservationId: string): Promise<PaymentDto[]> => {
    return apiClient.get(`/properties/${propertyId}/reservations/${reservationId}/payments/all`);
  },

  updateFolioPayment: async (propertyId: string, folioId: string, id: string, data: PaymentUpdateDto): Promise<PaymentDto> => {
    return apiClient.put(`/properties/${propertyId}/folios/${folioId}/payments/${id}`, data);
  },

  deleteFolioPayment: async (propertyId: string, folioId: string, id: string): Promise<void> => {
    return apiClient.delete(`/properties/${propertyId}/folios/${folioId}/payments/${id}`);
  },

  updateReservationPayment: async (propertyId: string, reservationId: string, id: string, data: PaymentUpdateDto): Promise<PaymentDto> => {
    return apiClient.put(`/properties/${propertyId}/reservations/${reservationId}/payments/${id}`, data);
  },

  deleteReservationPayment: async (propertyId: string, reservationId: string, id: string): Promise<void> => {
    return apiClient.delete(`/properties/${propertyId}/reservations/${reservationId}/payments/${id}`);
  },

  refundPayment: async (propertyId: string, folioId: string, id: string, data: RefundDto): Promise<PaymentDto> => {
    return apiClient.post(`/properties/${propertyId}/folios/${folioId}/payments/${id}/refund`, data);
  },

  getPaymentsByPropertyAndDateRange: async (
    propertyId: string, 
    startDate: string, 
    endDate: string, 
    status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED'
  ): Promise<PaymentDto[]> => {
    const params = new URLSearchParams({ startDate, endDate });
    if (status) params.append('status', status);
    return apiClient.get(`/properties/${propertyId}/payments?${params.toString()}`);
  }
};

export default paymentApi;