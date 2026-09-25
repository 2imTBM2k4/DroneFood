export const deliveryMethods = ["shipper", "drone"] as const;

export type DeliveryMethod = (typeof deliveryMethods)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DeliveryFees {
  shipperRatePerKm: number;
  droneRatePerKm: number;
  currency: "VND";
  serviceFee: number;
}

export interface DeliveryQuote {
  deliveryMethod: DeliveryMethod;
  shippingPrice: number;
  serviceFee: number;
  totalPrice: number;
}

export type FoodSort = "price_asc" | "price_desc" | "name_asc" | "name_desc";

export interface FoodListQuery {
  restaurantId?: string;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: FoodSort;
  page?: number;
  limit?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AddressBookEntry {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
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
