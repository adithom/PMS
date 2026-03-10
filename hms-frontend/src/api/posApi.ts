import api from './fetchClient';
import type { PosLocation, PosProduct, PosOrder, PosOrderCreationDto } from '../types/pos';

const posApi = {
    getLocations: (propertyId: string) => api.get<PosLocation[]>('/pos/locations', { propertyId }),

    getProducts: (locationId: string) => api.get<PosProduct[]>('/pos/products', { locationId }),

    createOrder: (data: PosOrderCreationDto) => api.post<PosOrder>('/pos/orders', data),

    chargeOrder: (orderId: string, folioId: string) => api.post<PosOrder>(`/pos/orders/${orderId}/charge?folioId=${folioId}`, null)
};

export default posApi;
