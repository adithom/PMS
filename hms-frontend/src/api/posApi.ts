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
  OrderSummary,
  PosTicket,
  PosTicketCreationDto,
  PosTicketHistory,
} from '../types/pos';

const posApi = {
  // Locations
  getLocations: (propertyId: string) =>
    api.get<PosLocation[]>('/pos/locations', { propertyId }),

  createLocation: (data: PosLocationCreationDto) =>
    api.post<PosLocation>('/pos/locations', data),

  updateLocation: (id: string, data: PosLocationUpdateDto) =>
    api.put<PosLocation>(`/pos/locations/${id}`, data),


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

  closeTicket: (ticketId: string, data?: { paymentMethod?: string; transactionReference?: string }) =>
    api.post<PosTicket>(`/pos/tickets/${ticketId}/close`, data ?? null),

  getOpenTickets: (locationId: string) =>
    api.get<PosTicket[]>('/pos/tickets', { locationId }),

  getTicketHistory: (locationId: string, from: string, to: string) =>
    api.get<PosTicketHistory[]>('/pos/tickets/history', { locationId, from, to }),

  getTicketSummary: (locationId: string, from: string, to: string) =>
    api.get<OrderSummary>('/pos/tickets/summary', { locationId, from, to }),
};

export default posApi;
