export type Restaurant = {
  _id: string;
  name: string;
  address: string;
  image?: string;
  lat?: number;
  lng?: number;
  isOpen?: boolean;
  phone?: string;
  description?: string;
  rating?: number;
  averageRating?: number | null;
  ratingCount?: number;
  distanceKm?: number | null;
};

export type Option = {
  name: string;
  priceDelta?: number;
};

export type OptionGroup = {
  name: string;
  type: "single" | "multi";
  required?: boolean;
  min?: number;
  max?: number;
  options: Option[];
};

export type Food = {
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category?: string;
  optionGroups?: OptionGroup[];
};

export type CartLineOption = {
  groupName: string;
  optionName: string;
  priceDelta: number;
};

export type CartLine = {
  lineKey: string;
  foodId: string;
  name: string;
  image?: string;
  basePrice?: number;
  unitPrice: number;
  quantity: number;
  selectedOptions: CartLineOption[];
  note?: string;
  restaurantId?: string | null;
};

export type Cart = {
  items: CartLine[];
  subtotal: number;
  restaurantId?: string;
};

export type DeliveryMethod = "drone" | "shipper";
export type PaymentMethod = "COD" | "PAYOS";

export type AppliedVoucher = {
  voucherId?: string;
  code: string;
  kind?: "fixed" | "percent";
  value?: number;
  appliesTo?: "items_subtotal" | "shipping_fee";
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  discountAmount: number;
};

export type Quote = {
  deliveryMethod: DeliveryMethod;
  billedDistanceKm: number;
  distanceType: "air" | "road";
  ratePerKm: number;
  shippingPrice: number;
  itemsPrice?: number;
  serviceFee?: number;
  discountAmount?: number;
  vouchers?: AppliedVoucher[];
  totalPrice?: number;
};

export type UserTransaction = {
  _id: string;
  transactionType: "order_payment" | "refund" | "top_up" | string;
  title: string;
  amount: number;
  balanceAfter: number;
  status: string;
  createdAt: string;
};


export type OrderStatus =
  | "pending"
  | "preparing"
  | "delivering"
  | "arrived_at_delivery"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  name: string;
  quantity: number;
  price?: number;
  selectedOptions?: { groupName: string; optionName: string }[];
  note?: string;
};

export type DroneTelemetry = {
  droneId?: string;
  droneModel?: string;
  lat: number;
  lng: number;
  altitudeMeters?: number;
  speedKmh?: number;
  batteryPercent?: number;
  etaMinutes?: number;
  cargoState?: "locked" | "unlocked" | "open";
};

export type Coordinates = { lat: number; lng: number };

export type LiveShipperRoute = {
  origin: Coordinates;
  geometry: [number, number][];
  durationSeconds: number;
  generatedAt: string;
};

export type LiveShipperRouteStatus = "available" | "unavailable";

export type ShipperTracking = {
  location: Coordinates;
  updatedAt: string;
  route?: LiveShipperRoute;
  // This is deliberately provider-safe: it never carries diagnostics,
  // credentials, or raw coordinates beyond the live location already allowed.
  routeStatus?: LiveShipperRouteStatus;
};

export type Order = {
  _id: string;
  orderStatus: OrderStatus;
  totalPrice: number;
  itemsPrice?: number;
  shippingPrice: number;
  serviceFee?: number;
  discountAmount?: number;
  vouchers?: AppliedVoucher[];
  deliveryMethod: DeliveryMethod;
  paymentMethod?: string;
  createdAt: string;
  cancellationCode?: string;
  reason?: string;
  qrCode?: string;
  qrScanned?: boolean;
  cargoChecked?: boolean;
  orderItems?: OrderItem[];
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  };
  restaurantId?: {
    _id?: string;
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    image?: string;
  };
  droneTelemetry?: DroneTelemetry;
  tracking?: ShipperTracking;
  shipperId?: { _id?: string; name?: string; phone?: string };
  reviewFlow?: ReviewFlow;
};

export type ReviewTargetType = "shipper" | "food";
export type ReviewTargetStatus = "pending" | "rated" | "skipped" | "not_applicable";

export type ReviewTarget = {
  targetType: ReviewTargetType;
  targetId: string;
  name: string;
  status: ReviewTargetStatus;
  rating?: number;
  comment?: string;
};

export type ReviewFlow = {
  targets: ReviewTarget[];
  nextTarget: {
    targetType: ReviewTargetType;
    targetId: string;
    name: string;
    status: "pending";
  } | null;
  complete: boolean;
};

export type Address = {
  fullName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phone: string;
  lat: string;
  lng: string;
};

export type AddressBookEntry = {
  id: string;
  _id?: string;
  label: string; // "Nhà riêng", "Công ty", v.v.
  recipient?: string;
  fullName?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
};

export type AddressBookInput = {
  label: string;
  recipient?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
};

export type UserProfile = {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: Partial<{
    fullName: string;
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    phone: string;
    lat: number | null;
    lng: number | null;
  }>;
};

export type ScreenName =
  | "home"
  | "restaurant"
  | "cart"
  | "checkout"
  | "orders"
  | "track"
  | "profile"
  | "address-book";
