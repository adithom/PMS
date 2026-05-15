// src/api/guestApi.ts
import api from './fetchClient';
import type { Guest, GuestIdType, GuestProfile } from '../types';

export interface GuestCreationDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  guestIdType?: GuestIdType;
  dateOfBirth?: string;
}

const guestApi = {
  getAll: (search?: string) => 
    api.get<Guest[]>('/guests', search ? { search } : undefined),

  getById: (id: string) =>
    api.get<Guest>(`/guests/${id}`),

  getByEmail: (email: string) =>
    api.get<Guest>(`/guests/email/${email}`),

  getByPhone: (phone: string) =>
    api.get<Guest>(`/guests/phone/${phone}`),

  getByDocId: (docId: string) =>
    api.get<Guest>(`/guests/doc/${docId}`),

  create: (data: GuestCreationDto) =>
    api.post<Guest>('/guests', data),

  update: (id: string, data: GuestCreationDto) =>
    api.put<Guest>(`/guests/${id}`, data),

  partialUpdate: (id: string, data: Partial<GuestCreationDto>) =>
    api.patch<Guest>(`/guests/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/guests/${id}`),

  search: (searchTerm: string) =>
    api.get<Guest[]>('/guests', { search: searchTerm }),

  getProfile: (id: string) =>
    api.get<GuestProfile>(`/guests/${id}/profile`),
};

export default guestApi;