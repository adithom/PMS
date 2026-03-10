// src/api/roomApi.ts
import api from './fetchClient';
import type { Room, RoomStatus } from '../types';

// DTOs based on backend
export interface AvailableRoomDto {
  roomId: string;
  roomNumber: string;
  capacity: number;
  baseRate: number;
  unitName: string;
  status: string;
}

export interface RoomAvailabilityCheckDto {
  roomId: string;
  roomNumber: string;
  isAvailable: boolean;
  checkIn: string;
  checkOut: string;
  reason: string; // "AVAILABLE", "BOOKED", "IN_MAINTENANCE", etc.
}

export interface AvailabilitySearchDto {
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  totalActiveRooms: number;
  availableRooms: number;
  bookedRooms: number;
  hasAvailability: boolean;
  availableRoomsList: AvailableRoomDto[];
}

export interface DailyAvailabilityDto {
  date: string;
  dayOfWeek: string;
  totalActiveRooms: number;
  availableRooms: number;
  bookedRooms: number;
  inMaintenanceRooms: number;
  occupancyRate: number;
  availableRoomsList: AvailableRoomDto[];
}

const roomApi = {
  // --- Room CRUD endpoints ---
  getByProperty: (propertyId: string) => 
    api.get<Room[]>(`/properties/${propertyId}/rooms`),

  getById: (propertyId: string, roomId: string) =>
    api.get<Room>(`/properties/${propertyId}/rooms/${roomId}`),

  getByNumber: (propertyId: string, number: string) =>
    api.get<Room>(`/properties/${propertyId}/rooms/number/${number}`),

  getByUnit: (propertyId: string, unitId: string) =>
    api.get<Room[]>(`/properties/${propertyId}/rooms/unit/${unitId}`),

  getByStatus: (propertyId: string, status: RoomStatus) =>
    api.get<Room[]>(`/properties/${propertyId}/rooms/status/${status}`),

  create: (propertyId: string, data: Partial<Room>) =>
    api.post<Room>(`/properties/${propertyId}/rooms`, data),

  update: (propertyId: string, roomId: string, data: Partial<Room>) =>
    api.put<Room>(`/properties/${propertyId}/rooms/${roomId}`, data),

  partialUpdate: (propertyId: string, roomId: string, data: Partial<Room>) =>
    api.patch<Room>(`/properties/${propertyId}/rooms/${roomId}`, data),

  delete: (propertyId: string, roomId: string) =>
    api.delete<void>(`/properties/${propertyId}/rooms/${roomId}`),

  // --- Availability endpoints ---
  searchAvailableRooms: (propertyId: string, checkIn: string, checkOut: string) =>
    api.get<AvailabilitySearchDto>(`/availability/properties/${propertyId}`, { checkIn, checkOut }),

  checkRoomAvailability: (roomId: string, checkIn: string, checkOut: string) =>
    api.get<RoomAvailabilityCheckDto>(`/availability/rooms/${roomId}`, { checkIn, checkOut }),

  getDailyAvailability: (propertyId: string, startDate: string, endDate: string) =>
    api.get<DailyAvailabilityDto[]>(`/availability/properties/${propertyId}/daily`, { startDate, endDate }),
};

export default roomApi;