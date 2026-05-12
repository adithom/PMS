import api from './fetchClient';
import type {
  PosLocation,
  PosItemCategory,
  PosProduct,
  PosOrder,
  PosOrderCreationDto,
  PosLocationCreationDto,
  PosLocationUpdateDto,
  PosItemCategoryCreationDto,
  PosItemCategoryUpdateDto,
  PosProductCreationDto,
  PosProductUpdateDto,
  PosSettleDto,
  OrderSummary,
  PosTicket,
  PosTicketCreationDto,
} from '../types/pos';
import type { FolioDto } from './folioApi';

const posApi = {
  // Locations
  getLocations: (propertyId: string) =>
    api.get<PosLocation[]>('/pos/locations', { propertyId }),

  createLocation: (data: PosLocationCreationDto) =>
    api.post<PosLocation>('/pos/locations', data),

  updateLocation: (id: string, data: PosLocationUpdateDto) =>
    api.put<PosLocation>(`/pos/locations/${id}`, data),

  postWalkInFolio: (locationId: string) =>
    api.post<FolioDto>(`/pos/locations/${locationId}/post-walkin-folio`, null),

  // Categories
  getCategories: (locationId: string) =>
    api.get<PosItemCategory[]>('/pos/categories', { locationId }),

  createCategory: (data: PosItemCategoryCreationDto) =>
    api.post<PosItemCategory>('/pos/categories', data),

  updateCategory: (id: string, data: PosItemCategoryUpdateDto) =>
    api.put<PosItemCategory>(`/pos/categories/${id}`, data),

  deleteCategory: (id: string) =>
    api.delete<void>(`/pos/categories/${id}`),

  // Products
  getProducts: (locationId: string) =>
    api.get<PosProduct[]>('/pos/products', { locationId }),

  createProduct: (data: PosProductCreationDto) =>
    api.post<PosProduct>('/pos/products', data),

  updateProduct: (id: string, data: PosProductUpdateDto) =>
    api.put<PosProduct>(`/pos/products/${id}`, data),

  deleteProduct: (id: string) =>
    api.delete<void>(`/pos/products/${id}`),

  // Orders
  createOrder: (data: PosOrderCreationDto) =>
    api.post<PosOrder>('/pos/orders', data),

  settleOrder: (orderId: string, data: PosSettleDto) =>
    api.post<PosOrder>(`/pos/orders/${orderId}/settle`, data),

  // Order history (MANAGER)
  getOrders: (locationId: string, from: string, to: string, status?: string) =>
    api.get<PosOrder[]>('/pos/orders', {
      locationId,
      from,
      to,
      ...(status ? { status } : {}),
    }),

  getOrderSummary: (locationId: string, from: string, to: string) =>
    api.get<OrderSummary>('/pos/orders/summary', { locationId, from, to }),

  // Tickets
  openTicket: (data: PosTicketCreationDto) =>
    api.post<PosTicket>('/pos/tickets', data),

  addOrderToTicket: (ticketId: string, data: PosOrderCreationDto) =>
    api.post<PosOrder>(`/pos/tickets/${ticketId}/orders`, data),

  closeTicket: (ticketId: string) =>
    api.post<PosTicket>(`/pos/tickets/${ticketId}/close`, null),

  getOpenTickets: (locationId: string) =>
    api.get<PosTicket[]>('/pos/tickets', { locationId }),
};

export default posApi;
