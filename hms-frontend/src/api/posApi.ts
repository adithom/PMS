import api from './fetchClient';
import type {
  PosLocation,
  PosProduct,
  PosOrder,
  PosOrderCreationDto,
  PosLocationCreationDto,
  PosLocationUpdateDto,
  PosProductCreationDto,
  PosProductUpdateDto,
  PosSettleDto,
} from '../types/pos';
import type { FolioDto } from './folioApi';

const posApi = {
  getLocations: (propertyId: string) =>
    api.get<PosLocation[]>('/pos/locations', { propertyId }),

  getProducts: (locationId: string) =>
    api.get<PosProduct[]>('/pos/products', { locationId }),

  createOrder: (data: PosOrderCreationDto) =>
    api.post<PosOrder>('/pos/orders', data),

  chargeOrder: (orderId: string, folioId: string) =>
    api.post<PosOrder>(`/pos/orders/${orderId}/charge?folioId=${folioId}`, null),

  settleOrder: (orderId: string, data: PosSettleDto) =>
    api.post<PosOrder>(`/pos/orders/${orderId}/settle`, data),

  createLocation: (data: PosLocationCreationDto) =>
    api.post<PosLocation>('/pos/locations', data),

  updateLocation: (id: string, data: PosLocationUpdateDto) =>
    api.put<PosLocation>(`/pos/locations/${id}`, data),

  postWalkInFolio: (locationId: string) =>
    api.post<FolioDto>(`/pos/locations/${locationId}/post-walkin-folio`, null),

  createProduct: (data: PosProductCreationDto) =>
    api.post<PosProduct>('/pos/products', data),

  updateProduct: (id: string, data: PosProductUpdateDto) =>
    api.put<PosProduct>(`/pos/products/${id}`, data),

  deleteProduct: (id: string) =>
    api.delete<void>(`/pos/products/${id}`),
};

export default posApi;
