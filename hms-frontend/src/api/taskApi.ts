// src/api/taskApi.ts
import api from './fetchClient';
import type { Booking, Guest, Room } from '../types';

const taskApi = {
  getMaintenanceRooms: (propertyId: string) =>
    api.get<Room[]>(`/properties/${propertyId}/tasks/maintenance`),

  getBirthdays: (propertyId: string) =>
    api.get<Guest[]>(`/properties/${propertyId}/tasks/birthdays`),

  getUnassignedCheckins: (propertyId: string) =>
    api.get<Booking[]>(`/properties/${propertyId}/tasks/unassigned`),
};

export default taskApi;
