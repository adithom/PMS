import api from './fetchClient';

// Define Folio type here or import if available. 
// Ideally should be in types/index.ts but for now let's define it or use any.
// We'll use the one from BillingManager for reference but better to have it in types.
// Let's assume we'll move types later or duplicate for now to be safe.

export interface Folio {
    id: string;
    folioNumber: string;
    status: 'OPEN' | 'CLOSED' | 'POSTED';
    guestName: string;
    roomNumber?: string;
    totalAmount: number;
    balanceDue: number;
    createdAt: string;
}

const folioApi = {
    getAll: (propertyId: string) => api.get<Folio[]>('/folios', { propertyId }),

    getByBooking: (bookingId: string, propertyId: string) => api.get<Folio>(`/folios/by-booking/${bookingId}`, { propertyId }),

    getById: (id: string) => api.get<Folio>(`/folios/${id}`),
};

export default folioApi;
