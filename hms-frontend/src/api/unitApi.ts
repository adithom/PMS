// src/api/unitApi.ts
import api from './fetchClient';
import type { UnitDto } from '../types';

export interface UnitCreationDto {
  name: string;
  sortOrder?: number;
}

export interface UnitUpdateDto {
  name?: string;
  sortOrder?: number;
}

const unitApi = {
  // Get all units for a property
  getByProperty: (propertyId: string) => 
    api.get<UnitDto[]>(`/properties/${propertyId}/units`),

  // Get unit by ID
  getById: (propertyId: string, unitId: string) =>
    api.get<UnitDto>(`/properties/${propertyId}/units/${unitId}`),

  // Get unit by name
  getByName: (propertyId: string, name: string) =>
    api.get<UnitDto>(`/properties/${propertyId}/units/name/${name}`),

  // Create new unit
  create: (propertyId: string, data: UnitCreationDto) =>
    api.post<UnitDto>(`/properties/${propertyId}/units`, data),

  // Full update (PUT)
  update: (propertyId: string, unitId: string, data: UnitUpdateDto) =>
    api.put<UnitDto>(`/properties/${propertyId}/units/${unitId}`, data),

  // Partial update (PATCH)
  partialUpdate: (propertyId: string, unitId: string, data: UnitUpdateDto) =>
    api.patch<UnitDto>(`/properties/${propertyId}/units/${unitId}`, data),

  // Delete unit
  delete: (propertyId: string, unitId: string) =>
    api.delete<void>(`/properties/${propertyId}/units/${unitId}`),
};

export default unitApi;