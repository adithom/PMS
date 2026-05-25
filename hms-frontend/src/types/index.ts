// src/types/index.ts

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  addressLine2?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
  country: string;
  totalRooms: number;
  extraBedRatePerNight?: number;
  gstNumber?: string;
  cin?: string;
  udyamRegistrationNo?: string;
  pan?: string;
  stateName?: string;
  stateCode?: string;
  fssaiNumber?: string;
  checkInTime?: string;
  checkOutTime?: string;
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

export interface GuestSummary {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface GuestBookingSummary {
  bookingId: string;
  reservationId?: string;
  groupReference?: string;
  propertyName?: string;
  roomNumber?: string;
  unitName?: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  mealPlanType?: string;
  role: 'PRIMARY' | 'ADDITIONAL';
}

export interface GuestPosPreference {
  productId: string;
  itemName: string;
  category?: string;
  totalQuantity: number;
  orderCount: number;
}

export interface GuestProfile {
  guest: Guest;
  bookingHistory: GuestBookingSummary[];
  posPreferences: GuestPosPreference[];
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
  reservationId?: string;
  isTwinBed: boolean;
  referenceNumber?: string;
  travelAgentId?: string;
  travelAgentName?: string;
  contactPersonId?: string;
  contactPersonName?: string;
  mealPlanType?: MealPlanType;
  mealPlanDisplayName?: string;
  mealPlanPricePerNight?: number;
  mealPlanChildrenPricePerNight?: number;
  extraBeds?: number;
  extraBedRatePerNight?: number;
  extraBedChargeCode?: 'ROOM_RENT' | 'MISC';
  nightlyRate?: number;
  nightlyRateExTax?: number;
  bookingSource?: string;
  // Audit fields surfaced in the Reservations Detail modal.
  cancellationReason?: string;
  rescheduleReason?: string;
  originalCheckIn?: string;
  originalCheckOut?: string;
  additionalGuests?: GuestSummary[];
}

export const BOOKING_SOURCE_OPTIONS = [
  'Direct / Walk-In',
  'Phone Call',
  'Email',
  'Property Website',
  'MakeMyTrip',
  'Booking.com',
  'Expedia',
  'Agoda',
  'Airbnb',
  'Travel Agent',
  'Corporate',
  'Repeat Guest',
  'Social Media',
  'Referral',
];

// Ghost (deterministic first-fit, server-computed) bar on the tape chart for an
// unassigned booking. Rendered with dashed border + 80% opacity. Booking.roomId
// stays null in the DB; ghosts are pure presentation, recomputed every fetch.
export interface GhostAssignmentDto {
  bookingId: string;
  guestId: string;
  guestName: string;
  roomId: string;
  roomNumber: string;
  unitId: string;
  unitName: string;
  reservationId?: string;
  groupReference?: string;
  bookingStatus: BookingStatus;
  startDate: string;
  endDate: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface TapeChartRoomDto {
  id: string;
  number: string;
  unitId: string | null;
  unitName: string | null;
  baseRate: number;
  status: RoomStatus;
}

export interface TapeChartDto {
  rooms: TapeChartRoomDto[];
  realAssignments: RoomAssignmentDto[];
  ghostAssignments: GhostAssignmentDto[];
}

export interface ContactPerson {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  designation?: string;
}

export interface TravelAgent {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  active: boolean;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
  contactPersons?: ContactPerson[];
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
