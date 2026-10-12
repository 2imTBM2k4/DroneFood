const timestampOf = (point) => {
  const rawValue = point?.timestamp ?? point?.date ?? point?.hour;
  const parsed = new Date(rawValue).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

export const sortTimeSeries = (points = []) =>
  [...points].sort((left, right) => timestampOf(left) - timestampOf(right));

export const mergeTrendSeries = (gmvSeries = [], completedSeries = []) => {
  const pointsByTimestamp = new Map();

  gmvSeries.forEach(({ timestamp, value }) => {
    pointsByTimestamp.set(timestamp, {
      timestamp,
      gmv: Number(value) || 0,
      completedOrders: 0,
    });
  });

  completedSeries.forEach(({ timestamp, value }) => {
    const existing = pointsByTimestamp.get(timestamp) || {
      timestamp,
      gmv: 0,
      completedOrders: 0,
    };
    pointsByTimestamp.set(timestamp, {
      ...existing,
      completedOrders: Number(value) || 0,
    });
  });

  return sortTimeSeries([...pointsByTimestamp.values()]);
};

const nextReadableCurrencyStep = (value) => {
  if (!Number.isFinite(value) || value <= 0) return 250000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * magnitude;
};

export const getDualAxisConfig = (trend = []) => {
  const tickIntervals = 4;
  const maxGmv = Math.max(0, ...trend.map((point) => Number(point.gmv) || 0));
  const maxOrders = Math.max(
    0,
    ...trend.map((point) => Number(point.completedOrders) || 0)
  );
  const gmvStep = nextReadableCurrencyStep(maxGmv / tickIntervals);
  const ordersStep = Math.max(1, Math.ceil(maxOrders / tickIntervals));

  return {
    gmvDomain: [0, gmvStep * tickIntervals],
    ordersDomain: [0, ordersStep * tickIntervals],
    tickCount: tickIntervals + 1,
  };
};
