export const EXPLORE_HEADER_TRANSITION = 96;

export const clampExploreHeaderProgress = (offsetY: number) =>
  Math.max(0, Math.min(1, offsetY / EXPLORE_HEADER_TRANSITION));

export const exploreHeaderMetrics = (progress: number, compactDevice = false) => {
  const value = Math.max(0, Math.min(1, progress));
  const interpolate = (from: number, to: number) => from + (to - from) * value;
  return {
    locationMinHeight: interpolate(compactDevice ? 64 : 72, 52),
    controlMinHeight: interpolate(48, 44),
    verticalPadding: interpolate(compactDevice ? 10 : 14, 6),
    blurIntensity: interpolate(72, 18),
    backgroundColor: value === 1 ? "#F4F8FD" : `rgba(244, 248, 253, ${0.18 + value * 0.82})`,
  };
};
