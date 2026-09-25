import type { AddressBookEntry, ApiFailure, ApiSuccess, DeliveryFees, FoodListQuery } from "@drone-food/contracts";

export interface DroneFoodApiClientOptions {
  baseUrl: string;
  accessToken?: () => string | null | Promise<string | null>;
  fetchImplementation?: typeof fetch;
}

export class DroneFoodApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DroneFoodApiError";
    this.status = status;
    this.code = code;
  }
}

export class DroneFoodApiClient {
  private readonly baseUrl: string;
  private readonly accessToken?: DroneFoodApiClientOptions["accessToken"];
  private readonly fetchImplementation: typeof fetch;

  constructor(options: DroneFoodApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.accessToken = options.accessToken;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async getDeliveryFees(): Promise<DeliveryFees> {
    const payload = await this.requestPayload<DeliveryFees & { success: true }>(
      "/api/config/fees",
    );
    return {
      shipperRatePerKm: payload.shipperRatePerKm,
      droneRatePerKm: payload.droneRatePerKm,
      currency: payload.currency,
      serviceFee: payload.serviceFee,
    };
  }

  async listAddressBook(): Promise<AddressBookEntry[]> {
    return this.request<AddressBookEntry[]>("/api/address-book");
  }

  async listFood<T>(query: FoodListQuery = {}): Promise<T> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const suffix = params.size ? `?${params}` : "";
    return this.request<T>(`/api/food/list${suffix}`);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const payload = await this.requestPayload<ApiSuccess<T>>(path, init);
    return payload.data;
  }

  private async requestPayload<T extends { success: boolean }>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await this.accessToken?.();
    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const payload = (await response.json().catch(() => null)) as T | null;

    if (!response.ok || !payload || payload.success === false) {
      const failure = payload as ApiFailure | null;
      throw new DroneFoodApiError(
        failure?.message ?? "The server returned an invalid response.",
        response.status,
        failure?.code,
      );
    }

    return payload;
  }
}
