// src/types/index.ts

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  country: string;
  totalRooms: number;
}

export interface Room {
  roomId?: string;
  number: string;
  type: string;
  capacity: number;
  baseRate: number;
  status: RoomStatus;
  unitName?: string;
}

export type RoomStatus =
  | 'ACTIVE'
  | 'IN_MAINTENANCE'
  | 'QUEUED_FOR_MAINTENANCE'
  | 'INACTIVE';

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  docId?: string;
  dateOfBirth?: string;
  createdAt?: string;
  preferences?: string;
}

export interface Booking {
  id?: string;
  propertyId: string;
  roomId?: string;
  roomNumber?: string;
  guestId: string;
  guestName: string;
  unitId: string;
  unitName: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  stayDuration?: number;
  adults: number;
  children: number;
  currency: string;
  totalPrice: number;
  paidAmount: number;
  balanceDue?: number;
  isFullyPaid?: boolean;
  specialRequests?: string;
  createdAt?: string;
  isTwinBed: boolean;
  referenceNumber?: string;
  travelAgentId?: string;
  travelAgentName?: string;
  commissionRate?: number;
}

export interface TravelAgent {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  iataCode?: string;
  commissionRate?: number;
  active: boolean;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface ApiError {
  message: string;
  status?: number;
}

export interface RoomAvailability {
  roomId: string;
  roomNumber: string;
  isAvailable: boolean;
  checkIn: string;
  checkOut: string;
  reason: string;
}

export type UnitDto = {
  id: string;            // unit id
  name: string;          // unit name
  propertyCode: string;  // property code
  sortOrder?: number;    // optional, can be undefined
  totalRooms?: number;   // optional, can be undefined
};
