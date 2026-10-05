import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type {
  BankAccount,
  DraftFood,
  Food,
  Order,
  OrderStatus,
  Restaurant,
  Transaction,
  User,
  WithdrawalRequest,
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
const TOKEN_KEY = "restaurantAccessToken";

export type VerificationRequiredResponse = {
  success: true;
  verificationRequired: true;
  email: string;
  message: string;
};

type EmailVerificationErrorPayload = {
  code?: string;
  email?: string;
  message?: string;
  canResend?: boolean;
};

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

export const apiError = (error: unknown, fallback = "Có lỗi xảy ra") =>
  axios.isAxiosError(error)
    ? error.response?.data?.message || fallback
    : error instanceof Error && error.message
      ? error.message
      : fallback;

export const getEmailVerificationRequirement = (error: unknown) => {
  if (!axios.isAxiosError<EmailVerificationErrorPayload>(error)) return null;
  const data = error.response?.data;
  return data?.code === "EMAIL_VERIFICATION_REQUIRED"
    ? { email: data.email, message: data.message, canResend: data.canResend !== false }
    : null;
};

export const formatVnd = (value = 0) =>
  `${Math.round(value).toLocaleString("vi-VN")} ₫`;

export const api = axios.create({
  baseURL: API_URL,
});
const publicApi = axios.create({ baseURL: API_URL });

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
    const res = await publicApi.post<{ token: string; role: string }>("/api/user/login", {
      email: email.trim(),
      password,
    });
    if (res.data.role !== "restaurant_owner" && res.data.role !== "admin") {
      throw new Error("Tài khoản này không phải tài khoản Nhà hàng.");
    }
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await publicApi.post<{ success: boolean; message: string }>(
      "/api/user/forgot-password",
      { email: email.trim() }
    );
    return res.data;
  },
  resendVerification: async (email: string) => {
    const res = await publicApi.post<{ success: boolean; message: string }>(
      "/api/user/resend-verification",
      { email: email.trim() }
    );
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.put<{ success: boolean; message: string }>(
      "/api/user/change-password",
      { currentPassword, newPassword }
    );
    return res.data;
  },
  registerRestaurant: async (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    restaurantName: string;
    address: string;
  }) => {
    const response = await publicApi.post<VerificationRequiredResponse>("/api/user/register", {
      name: data.name.trim(),
      email: data.email.trim(),
      password: data.password,
      phone: data.phone.trim(),
      role: "restaurant_owner",
      restaurantName: data.restaurantName.trim(),
      address: data.address.trim(),
    });
    return response.data;
  },
  getMe: async () => {
    const res = await api.get<{ data: User }>("/api/user/me");
    return res.data.data;
  },
};

export const restaurantApi = {
  getProfile: async (id: string) => {
    const res = await api.get<{ data: Restaurant }>(`/api/restaurant/${id}`);
    return res.data.data;
  },
  setOpenState: async (id: string, isOpen: boolean) => {
    const res = await api.patch(`/api/restaurant/${id}/open-state`, { isOpen });
    return res.data;
  },
  updateProfile: async (
    id: string,
    data: FormData | { name?: string; address?: string; phone?: string; email?: string; description?: string }
  ) => {
    let payload: FormData;
    if (data instanceof FormData) {
      payload = data;
    } else {
      payload = new FormData();
      if (data.name) payload.append("name", data.name);
      if (data.address !== undefined) payload.append("address", data.address);
      if (data.phone !== undefined) payload.append("phone", data.phone);
      if (data.email !== undefined) payload.append("email", data.email);
      if (data.description !== undefined) payload.append("description", data.description);
    }
    const res = await api.put(`/api/restaurant/${id}`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  getBankAccount: async () => {
    const res = await api.get<{ data: BankAccount }>("/api/restaurant/me/bank-account");
    return res.data.data;
  },
  updateBankAccount: async (account: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
  }) => {
    const res = await api.put("/api/restaurant/me/bank-account", account);
    return res.data;
  },
};

export const orderApi = {
  list: async () => {
    const res = await api.get<{ data: Order[] }>("/api/order/list");
    return res.data.data || [];
  },
  updateStatus: async (
    orderId: string,
    status: OrderStatus,
    reason?: string
  ) => {
    const res = await api.post("/api/order/status", {
      orderId,
      status,
      ...(reason && { reason }),
    });
    return res.data;
  },
};

export const foodApi = {
  list: async () => {
    const res = await api.get<{ data: Food[] }>("/api/food/list");
    return res.data.data || [];
  },
  save: async (draft: DraftFood) => {
    const body = new FormData();
    if (draft.id) body.append("id", draft.id);
    body.append("name", draft.name.trim());
    body.append("description", draft.description.trim());
    body.append("price", String(Number(draft.price)));
    body.append("category", draft.category.trim());
    if (draft.optionGroups && draft.optionGroups.length > 0) {
      body.append("optionGroups", JSON.stringify(draft.optionGroups));
    }

    if (draft.image) {
      if (Platform.OS === "web") {
        const fetchRes = await fetch(draft.image.uri);
        const blob = await fetchRes.blob();
        body.append("image", blob, draft.image.fileName || "food.jpg");
      } else {
        body.append("image", {
          uri: draft.image.uri,
          type: draft.image.mimeType || "image/jpeg",
          name: draft.image.fileName || "food.jpg",
        } as unknown as Blob);
      }
    }

    const url = draft.id ? "/api/food/update" : "/api/food/add";
    const res = await api.post(url, body, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  remove: async (id: string) => {
    const res = await api.post("/api/food/remove", { id });
    return res.data;
  },
};

export const walletApi = {
  getWithdrawals: async () => {
    const res = await api.get<{ data: WithdrawalRequest[] }>("/api/restaurant-withdrawals");
    return res.data.data || [];
  },
  getTransactions: async () => {
    const res = await api.get<{ data: Transaction[] }>("/api/restaurant-withdrawals/transactions");
    return res.data.data || [];
  },
  requestWithdrawal: async (amount: number) => {
    const res = await api.post("/api/restaurant-withdrawals", { amount });
    return res.data;
  },
};
