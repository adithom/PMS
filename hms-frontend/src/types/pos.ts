export interface PosLocation {
  id: string;
  name: string;
  type: string;
  propertyId: string;
}

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  posLocationId: string;
  chargeCode: string;
}

export interface PosOrderItem {
  posProductId: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  posLocationId: string;
  status: 'OPEN' | 'CLOSED' | 'CHARGED' | 'CANCELLED';
  totalAmount: number;
  folioId?: string;
  items: PosOrderItem[];
  createdAt: string;
  closedAt?: string;
}

export interface PosOrderCreationDto {
  posLocationId: string;
  items: {
    posProductId: string;
    quantity: number;
  }[];
}
