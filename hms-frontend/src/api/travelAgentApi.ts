import api from './fetchClient';
import type { TravelAgent, ContactPerson } from '../types';

export interface TravelAgentCreationDto {
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
}

export interface ContactPersonCreationDto {
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
}

const travelAgentApi = {
  getAll: (activeOnly?: boolean) =>
    api.get<TravelAgent[]>('/travel-agents', activeOnly !== undefined ? { activeOnly } : undefined),

  search: (search: string) =>
    api.get<TravelAgent[]>('/travel-agents', { search }),

  getById: (id: string) =>
    api.get<TravelAgent>(`/travel-agents/${id}`),

  create: (data: TravelAgentCreationDto) =>
    api.post<TravelAgent>('/travel-agents', data),

  partialUpdate: (id: string, data: Partial<TravelAgentCreationDto> & { active?: boolean }) =>
    api.patch<TravelAgent>(`/travel-agents/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/travel-agents/${id}`),

  createContact: (agentId: string, data: ContactPersonCreationDto) =>
    api.post<ContactPerson>(`/travel-agents/${agentId}/contacts`, data),

  updateContact: (agentId: string, contactId: string, data: ContactPersonCreationDto) =>
    api.put<ContactPerson>(`/travel-agents/${agentId}/contacts/${contactId}`, data),

  deleteContact: (agentId: string, contactId: string) =>
    api.delete<void>(`/travel-agents/${agentId}/contacts/${contactId}`),
};

export default travelAgentApi;
