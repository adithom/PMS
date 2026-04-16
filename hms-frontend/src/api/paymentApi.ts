import apiClient from './fetchClient';

/* ────────────────────────────────────────────────────────────── */
/* Types & DTOs                                                   */
/* ────────────────────────────────────────────────────────────── */

export interface PaymentDto {
  id: string;
  paymentNumber?: string;
  folioId?: string;
  folioNumber?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'DIGITAL_WALLET' | 'AGENT_BILLING';
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  targetCategory?: 'ROOM_RENT' | 'ANCILLARY';
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

export interface PaymentCreationDto {
  amount: number;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'DIGITAL_WALLET' | 'AGENT_BILLING';
  targetCategory: 'ROOM_RENT' | 'ANCILLARY';
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