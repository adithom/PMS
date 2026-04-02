import api from './fetchClient';
import type { TravelAgent } from '../types';

export interface TravelAgentCreationDto {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  iataCode?: string;
  commissionRate?: number;
  address?: string;
}

const travelAgentApi = {
  getAll: (activeOnly?: boolean) =>
    api.get<TravelAgent[]>('/travel-agents', activeOnly !== undefined ? { activeOnly } : undefined),

  search: (search: string) =>
    api.get<TravelAgent[]>('/travel-agents', { search }),

  getById: (id: string) =>
    api.get<TravelAgent>(`/travel-agents/${id}`),

  getByIataCode: (iataCode: string) =>
    api.get<TravelAgent>(`/travel-agents/iata/${iataCode}`),

  create: (data: TravelAgentCreationDto) =>
    api.post<TravelAgent>('/travel-agents', data),

  partialUpdate: (id: string, data: Partial<TravelAgentCreationDto> & { active?: boolean }) =>
    api.patch<TravelAgent>(`/travel-agents/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/travel-agents/${id}`),
};

export default travelAgentApi;
