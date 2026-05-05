// src/types/index.ts

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  country: string;
  totalRooms: number;
  extraBedRatePerNight?: number;
}

export type MealPlanType = 'CP' | 'MAP' | 'AP';

export interface MealPlan {
  id: string;
  propertyId: string;
  mealPlanType: MealPlanType;
  displayName: string;
  pricePerNight: number;
  childrenPricePerNight: number;
  active: boolean;
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

export enum GuestIdType {
  PASSPORT = 'PASSPORT',
  DRIVERS_LICENSE = 'DRIVERS_LICENSE',
  OCI_CARD = 'OCI_CARD',
  AADHAAR_CARD = 'AADHAAR_CARD',
  VISA = 'VISA',
  VOTERS_ID = 'VOTERS_ID',
}

export const GUEST_ID_TYPE_LABELS: Record<GuestIdType, string> = {
  [GuestIdType.PASSPORT]: 'Passport',
  [GuestIdType.DRIVERS_LICENSE]: "Driver's License",
  [GuestIdType.OCI_CARD]: 'OCI Card',
  [GuestIdType.AADHAAR_CARD]: 'Aadhaar Card',
  [GuestIdType.VISA]: 'Visa',
  [GuestIdType.VOTERS_ID]: "Voter's ID",
};

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  guestIdType?: GuestIdType;
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
  mealPlanType?: MealPlanType;
  mealPlanDisplayName?: string;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  extraBeds?: number;
  extraBedRatePerNight?: number;
  extraBedChargeCode?: 'ROOM_RENT' | 'MISC';
  nightlyRate?: number;
  nightlyRateExTax?: number;
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

export interface RoomAssignmentDto {
  id: string;
  bookingId: string;
  roomId: string;
  roomNumber: string;
  unitName: string;
  startDate: string;
  endDate: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}
