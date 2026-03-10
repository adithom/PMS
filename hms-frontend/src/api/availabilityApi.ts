// src/api/availabilityApi.ts
import api from './fetchClient';

// ==================== DTOs ====================

// 1. Available room details
export interface AvailableRoomDto {
  roomId: string;
  roomNumber: string;
  capacity: number;
  baseRate: number;
  unitName: string;
  status: string;
}

// 2. Check specific room availability
export interface RoomAvailabilityCheckDto {
  roomId: string;
  roomNumber: string;
  isAvailable: boolean;
  checkIn: string; // yyyy-MM-dd format
  checkOut: string;
  reason: string; // "AVAILABLE", "BOOKED", "IN_MAINTENANCE", etc.
}

// 3. Comprehensive availability response (main search endpoint)
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

// 4. Availability by unit
export interface UnitAvailabilityDto {
  unitId: string;
  unitName: string;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  occupancyRate: number;
  availableRoomsList: AvailableRoomDto[];
}

// 5. Daily availability for calendar view
export interface DailyAvailabilityDto {
  date: string; // yyyy-MM-dd format
  dayOfWeek: string;
  totalActiveRooms: number;
  availableRooms: number;
  bookedRooms: number;
  inMaintenanceRooms: number;
  occupancyRate: number;
  availableRoomsList: AvailableRoomDto[];
}

// 6. Booked room info for occupancy reports
export interface BookedRoomDto {
  roomId: string;
  roomNumber: string;
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  bookingStatus: string;
}

// 7. Occupancy report for a single date
export interface OccupancyReportDto {
  propertyId: string;
  propertyName: string;
  reportDate: string;
  totalRooms: number;
  activeRooms: number;
  bookedRooms: number;
  availableRooms: number;
  inMaintenanceRooms: number;
  inactiveRooms: number;
  occupancyRate: number;
  bookedRoomsList: BookedRoomDto[];
}

// 8. Occupancy report for time period
export interface PeriodOccupancyReportDto {
  propertyId: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  totalRoomNights: number;
  bookedRoomNights: number;
  averageOccupancyRate: number;
  peakOccupiedRooms: number;
  peakOccupancyDate: string;
  dailyBreakdown: DailyAvailabilityDto[];
}

// 9. Unit occupancy report
export interface UnitOccupancyReportDto {
  unitId: string;
  unitName: string;
  reportDate: string;
  totalRooms: number;
  activeRooms: number;
  bookedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  bookedRoomsList: BookedRoomDto[];
}

// ==================== API Methods ====================

const availabilityApi = {
  /**
   * 1. Search available rooms for a property within a date range
   * GET /api/availability/properties/{propertyId}?checkIn=2025-11-01&checkOut=2025-11-05
   */
  searchAvailableRooms: (propertyId: string, checkIn: string, checkOut: string) =>
    api.get<AvailabilitySearchDto>(
      `/availability/properties/${propertyId}`,
      { checkIn, checkOut }
    ),

  /**
   * 2. Check if a specific room is available
   * GET /api/availability/rooms/{roomId}?checkIn=2025-11-01&checkOut=2025-11-05
   */
  checkRoomAvailability: (roomId: string, checkIn: string, checkOut: string) =>
    api.get<RoomAvailabilityCheckDto>(
      `/availability/rooms/${roomId}`,
      { checkIn, checkOut }
    ),

  /**
   * 3. Get daily availability for calendar view
   * GET /api/availability/properties/{propertyId}/daily?startDate=2025-11-01&endDate=2025-11-30
   */
  getDailyAvailability: (propertyId: string, startDate: string, endDate: string) =>
    api.get<DailyAvailabilityDto[]>(
      `/availability/properties/${propertyId}/daily`,
      { startDate, endDate }
    ),

  /**
   * 4. Get occupancy report for a specific date
   * GET /api/availability/properties/{propertyId}/occupancy?date=2025-11-15
   */
  getOccupancyReport: (propertyId: string, date: string) =>
    api.get<OccupancyReportDto>(
      `/availability/properties/${propertyId}/occupancy`,
      { date }
    ),

  /**
   * 5. Get occupancy report for a time period
   * GET /api/availability/properties/{propertyId}/occupancy/period?startDate=2025-11-01&endDate=2025-11-30
   */
  getPeriodOccupancyReport: (propertyId: string, startDate: string, endDate: string) =>
    api.get<PeriodOccupancyReportDto>(
      `/availability/properties/${propertyId}/occupancy/period`,
      { startDate, endDate }
    ),

  /**
   * 6. Search available rooms by unit
   * GET /api/availability/units/{unitId}?checkIn=2025-11-01&checkOut=2025-11-05
   */
  searchAvailableRoomsByUnit: (unitId: string, checkIn: string, checkOut: string) =>
    api.get<AvailableRoomDto[]>(
      `/availability/units/${unitId}`,
      { checkIn, checkOut }
    ),

  /**
   * 7. Get unit occupancy report for a specific date
   * GET /api/availability/units/{unitId}/occupancy?date=2025-11-15
   */
  getUnitOccupancyReport: (unitId: string, date: string) =>
    api.get<UnitOccupancyReportDto>(
      `/availability/units/${unitId}/occupancy`,
      { date }
    ),
};

export default availabilityApi;