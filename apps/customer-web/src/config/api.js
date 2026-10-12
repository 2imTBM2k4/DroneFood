const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0");

export const API_URL = (
  (isLocalhost && (!configuredApiUrl || configuredApiUrl.includes("api.dronefood.io.vn")))
    ? "http://localhost:4000"
    : (configuredApiUrl || (import.meta.env.PROD ? "https://api.dronefood.io.vn" : "http://localhost:4000"))
).replace(/\/+$/, "");

