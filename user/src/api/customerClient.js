import axios from "axios";

const safeGet = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage write errors
  }
};

const safeRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage remove errors
  }
};

export const getCustomerAccessToken = () => safeGet("token");
export const getCustomerRefreshToken = () => safeGet("refreshToken");
export const clearCustomerAuthStorage = () => {
  safeRemove("token");
  safeRemove("refreshToken");
};

export const createCustomerClient = (baseURL) => {
  const client = axios.create({ baseURL });
  const refreshClient = axios.create({ baseURL });
  let refreshPromise = null;
  let sessionExpiredHandler = null;
  let expiryNotified = false;

  const expireSession = async () => {
    clearCustomerAuthStorage();
    if (!expiryNotified) {
      expiryNotified = true;
      await sessionExpiredHandler?.();
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = getCustomerRefreshToken();
        if (!refreshToken) throw new Error("refresh-token-missing");
        const response = await refreshClient.post("/api/user/refresh-token", { refreshToken });
        if (!response.data?.token) throw new Error("refresh-token-invalid-response");
        safeSet("token", response.data.token);
        return response.data.token;
      })().finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  };

  client.interceptors.request.use((config) => {
    const token = getCustomerAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;
      const isRefreshRequest = original?.url?.includes("/api/user/refresh-token");
      if (status !== 401 || !original || isRefreshRequest) return Promise.reject(error);

      if (original._customerAuthRetried) {
        await expireSession();
        return Promise.reject(error);
      }

      original._customerAuthRetried = true;
      try {
        const token = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      } catch (refreshError) {
        const refreshStatus = refreshError?.response?.status;
        const isExplicitInvalidRefresh = refreshStatus === 401 || refreshStatus === 403 ||
          String(refreshError?.message || "").startsWith("refresh-token-");
        if (isExplicitInvalidRefresh) await expireSession();
        return Promise.reject(refreshError);
      }
    }
  );

  return {
    api: client,
    setSessionExpiredHandler(handler) {
      sessionExpiredHandler = handler;
    },
    resetSessionExpiryNotification() {
      expiryNotified = false;
    },
  };
};
