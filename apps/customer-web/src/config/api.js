const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL = (
  configuredApiUrl ||
  (import.meta.env.PROD ? "https://api.dronefood.io.vn" : "http://localhost:4000")
).replace(/\/+$/, "");
