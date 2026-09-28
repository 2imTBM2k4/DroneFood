export const estimateEtaMinutes = (distanceKm) =>
  Number.isFinite(distanceKm)
    ? Math.max(10, Math.round(10 + distanceKm * 2))
    : null;
