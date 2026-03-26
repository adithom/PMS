export interface PosLocation {
  id: string;
  name: string;
  locationType: 'RESTAURANT' | 'BAR' | 'SPA' | 'BAKERY' | 'LAUNDRY' | 'SHOP';
  propertyId: string;
  defaultChargeCode: string;
  defaultTaxRate: number;
  serviceChargeRate?: number;
  openingTime?: string;
  closingTime?: string;
  isActive: boolean;
  currentWalkInFolioId?: string;
}

export interface PosItemCategory {
  id: string;
  locationId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface PosProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  categoryId: string;
  categoryName: string;
  posLocationId: string;
  taxRate: number;
  discountRate?: number;
  isAvailable: boolean;
  preparationTime?: number;
  imageUrl?: string;
}

export interface PosOrderItem {
  id?: string;
  posProductId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  specialInstructions?: string;
  status?: string;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  posLocationId: string;
  propertyId: string;
  status: 'OPEN' | 'CLOSED' | 'CHARGED' | 'CANCELLED';
  paymentStatus: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountRate?: number;
  discountAmount: number;
  folioId?: string;
  bookingId?: string;
  roomId?: string;
  items: PosOrderItem[];
  orderType: string;
  orderDate: string;
  tableNumber?: string;
  guestName?: string;
  specialInstructions?: string;
  createdBy?: string;
  servedBy?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PosOrderCreationDto {
  posLocationId: string;
  items: {
    posProductId: string;
    quantity: number;
  }[];
  discountRate?: number;
}

export interface PosLocationCreationDto {
  propertyId: string;
  name: string;
  locationType: string;
  defaultTaxRate: number;
  serviceChargeRate?: number;
  openingTime?: string;
  closingTime?: string;
}

export interface PosLocationUpdateDto {
  name?: string;
  locationType?: string;
  defaultTaxRate?: number;
  serviceChargeRate?: number;
  openingTime?: string;
  closingTime?: string;
  isActive?: boolean;
}

export interface PosItemCategoryCreationDto {
  locationId: string;
  name: string;
  displayOrder?: number;
}

export interface PosItemCategoryUpdateDto {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface PosProductCreationDto {
  locationId: string;
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  cost?: number;
  taxRate?: number;
  discountRate?: number;
  isAvailable: boolean;
  preparationTime?: number;
  imageUrl?: string;
}

export interface PosProductUpdateDto {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: number;
  cost?: number;
  taxRate?: number;
  discountRate?: number;
  isAvailable?: boolean;
  preparationTime?: number;
  imageUrl?: string;
}

export interface PosSettleDto {
  walkIn: boolean;
  folioId?: string;
  paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER';
  transactionId?: string;
  cardLastFour?: string;
  upiId?: string;
  notes?: string;
}

export interface OrderSummary {
  orderCount: number;
  totalRevenue: number;
  avgOrderValue: number;
}

// Local cart state — not sent to API directly
export interface CartEntry {
  product: PosProduct;
  quantity: number;
}
