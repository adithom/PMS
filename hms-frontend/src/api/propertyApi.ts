// src/api/propertyApi.ts
import api from './fetchClient';
import { type UnitDto, type Property } from '../types';

const propertyApi = {
  getAll: (params?: Record<string, any>) => api.get<Property[]>('/properties', params),
  getById: (id: string) => api.get<Property>(`/properties/${id}`),
  create: (data: Partial<Property>) => api.post<Property>('/properties', data),
  update: (id: string, data: Partial<Property>) => api.put<Property>(`/properties/${id}`, data),
  partialUpdate: (id: string, data: Partial<Property>) => api.patch<Property>(`/properties/${id}`, data),
  delete: (id: string) => api.delete<void>(`/properties/${id}`),
  search: (params: Record<string, any>) => api.get<Property[]>('/properties/search', params),
  getUnits: (propertyId: string) => api.get<UnitDto[]>(`/properties/${propertyId}/units`),
};

export default propertyApi;