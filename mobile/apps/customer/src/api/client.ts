import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type {
  Address,
  AddressBookEntry,
  AddressBookInput,
  Cart,
  DeliveryMethod,
  Food,
  Order,
  PaymentMethod,
  Quote,
  Restaurant,
  ReviewFlow,
  UserProfile,
  UserTransaction,
} from "../types";

export const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (envUrl) {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
      if (envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
        return envUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
      }
    }
    return envUrl;
  }
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:4000`;
  }
  return "http://10.0.2.2:4000";
};

export const API_URL = getApiUrl();
const TOKEN_KEY = "customerAccessToken";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

export const getStoredToken = () => storage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string) => storage.setItem(TOKEN_KEY, token);
export const removeStoredToken = () => storage.deleteItem(TOKEN_KEY);

export const apiError = (cause: unknown, fallback = "Có lỗi xảy ra") =>
  axios.isAxiosError(cause)
    ? cause.response?.data?.message || fallback
    : fallback;

export const formatVnd = (value = 0) =>
  `${Math.round(value).toLocaleString("vi-VN")} ₫`;

export const formatDistance = (value: number) =>
  value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`;

export const haversineKm = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) => {
  const radians = (val: number) => (val * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Axios instance
export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API Functions
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: UserProfile }>(
      "/api/user/login",
      { email: email.trim(), password }
    );
    return res.data;
  },
  register: async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.post<{ token: string; user: UserProfile }>(
      "/api/user/register",
      { name: name.trim(), email: email.trim(), password, phone: phone?.trim() }
    );
    return res.data;
  },
};

export const userApi = {
  getProfile: async () => {
    const res = await api.get<{ data: UserProfile }>("/api/user/me");
    return res.data.data;
  },
  updateProfile: async (name: string, phone: string) => {
    const res = await api.put("/api/user/profile", { name, phone });
    return res.data;
  },
  updateAddress: async (address: Address) => {
    const res = await api.put("/api/user/update-address", {
      ...address,
      lat: address.lat ? Number(address.lat) : null,
      lng: address.lng ? Number(address.lng) : null,
    });
    return res.data;
  },
  geocode: async (addressText: string) => {
    const res = await api.get<{ data: { lat: number; lng: number } | null }>(
      "/api/user/geocode",
      { params: { address: addressText } }
    );
    return res.data.data;
  },
  reverseGeocode: async (lat: number, lng: number) => {
    const res = await api.get<{ data: Partial<Address> | null }>(
      "/api/user/reverse-geocode",
      { params: { lat, lng } }
    );
    return res.data.data;
  },
  listAddressBook: async () => {
    const res = await api.get<{ data: AddressBookEntry[] }>("/api/address-book");
    return res.data.data || [];
  },
  createAddressEntry: async (entry: AddressBookInput) => {
    const res = await api.post<{ data: AddressBookEntry }>("/api/address-book", entry);
    return res.data.data;
  },
  updateAddressEntry: async (id: string, entry: Partial<AddressBookInput>) => {
    const res = await api.patch<{ data: AddressBookEntry }>(`/api/address-book/${id}`, entry);
    return res.data.data;
  },
  setDefaultAddressEntry: async (id: string) => {
    const res = await api.put<{ data: AddressBookEntry[] }>(`/api/address-book/${id}/default`);
    return res.data.data || [];
  },
  deleteAddressEntry: async (id: string) => {
    const res = await api.delete<{ data: AddressBookEntry[] }>(`/api/address-book/${id}`);
    return res.data.data || [];
  },
  getTransactions: async () => {
    const res = await api.get<{ data: { currentBalance: number; transactions: UserTransaction[] } }>("/api/user/transactions");
    return res.data.data || { currentBalance: 0, transactions: [] };
  },
};

export const restaurantApi = {
  list: async () => {
    const res = await api.get<{ data: Restaurant[] }>("/api/restaurant/list");
    return res.data.data || [];
  },
  getById: async (id: string) => {
    const res = await api.get<{ data: Restaurant }>(`/api/restaurant/${id}`);
    return res.data.data;
  },
};

export const foodApi = {
  listByRestaurant: async (restaurantId: string) => {
    const res = await api.get<{ data: Food[] }>("/api/food/list", {
      params: { restaurantId },
    });
    return res.data.data || [];
  },
};

export const cartApi = {
  get: async () => {
    const res = await api.get<Cart>("/api/cart/get");
    return res.data;
  },
  add: async (
    foodId: string,
    quantity: number,
    selectedOptions: { groupName: string; optionName: string }[]
  ) => {
    const res = await api.post("/api/cart/add", {
      itemId: foodId,
      quantity,
      selectedOptions,
    });
    return res.data;
  },
  updateLine: async (lineKey: string, quantity: number) => {
    const res = await api.post("/api/cart/update-line", { lineKey, quantity });
    return res.data;
  },
  clear: async () => {
    const res = await api.post("/api/cart/clear");
    return res.data;
  },
};

export const orderApi = {
  getQuote: async (
    address: { lat: number; lng: number; [key: string]: unknown },
    deliveryMethod: DeliveryMethod,
    voucherCode?: string,
    addressEntryId?: string
  ) => {
    const res = await api.post<{ data: Quote }>("/api/order/quote", {
      ...(addressEntryId ? { addressEntryId } : { address }),
      deliveryMethod,
      voucherCode: voucherCode || undefined,
    });
    return res.data.data;
  },
  place: async (payload: {
    address?: Record<string, unknown>;
    addressEntryId?: string;
    deliveryMethod: DeliveryMethod;
    paymentMethod: PaymentMethod;
    voucherCode?: string;
  }) => {
    const res = await api.post<{
      success: boolean;
      orderId: string;
      checkoutUrl?: string;
      paymentUrl?: string;
      totalPrice: number;
    }>("/api/order/place", payload);
    return res.data;
  },
  getUserOrders: async () => {
    const res = await api.get<{ data: Order[] }>("/api/order/userorders");
    return res.data.data || [];
  },
  getDetail: async (orderId: string) => {
    const res = await api.get<{ data: Order }>(
      `/api/order/${orderId}/customer-detail`
    );
    return res.data.data;
  },
  cancel: async (orderId: string, reason: string) => {
    const res = await api.post("/api/order/status", {
      orderId,
      status: "cancelled",
      reason,
    });
    return res.data;
  },
};

export const droneApi = {
  scanQr: async (orderId: string, qrCode: string) => {
    const res = await api.post<{ success: boolean; message: string }>(
      "/api/drone/scan-qr",
      { orderId, qrCode }
    );
    return res.data;
  },
  confirmDelivery: async (orderId: string) => {
    const res = await api.post<{ success: boolean; message: string }>(
      "/api/drone/confirm-delivery",
      { orderId }
    );
    return res.data;
  },
};

export const reviewApi = {
  submitDecision: async (
    orderId: string,
    targetType: "shipper" | "food",
    targetId: string,
    payload: {
      outcome: "rated" | "skipped";
      rating?: number;
      comment?: string;
    }
  ) => {
    const res = await api.post<{ success: boolean; data: { reviewFlow: ReviewFlow } }>(
      `/api/order-reviews/${orderId}/${targetType}/${targetId}`,
      payload
    );
    return res.data;
  },
  getFoodReviews: async (foodId: string) => {
    const res = await api.get<{
      success: boolean;
      data: {
        averageRating: number | null;
        ratingCount: number;
        reviews: Array<{
          _id: string;
          rating: number;
          comment?: string;
          reviewerName: string;
          createdAt: string;
        }>;
      };
    }>(`/api/order-reviews/food/${foodId}`);
    return res.data.data;
  },
};
