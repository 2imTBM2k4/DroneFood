export const deliveryMethods = ["shipper", "drone"] as const;

export type DeliveryMethod = (typeof deliveryMethods)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryFees {
  shipper: number;
  drone: number;
  serviceFee: number;
}

export interface DeliveryQuote {
  deliveryMethod: DeliveryMethod;
  shippingPrice: number;
  serviceFee: number;
  totalPrice: number;
}

export type ShipperAvailability = "offline" | "available" | "assigned" | "delivering";

export type ShipperAssignmentStatus = "unassigned" | "accepted" | "expired";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
