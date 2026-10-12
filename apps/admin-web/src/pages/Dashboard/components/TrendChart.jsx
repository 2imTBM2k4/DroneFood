import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVND } from "@drone-food/web-ui/utils/money";
import { getDualAxisConfig, sortTimeSeries } from "../dashboardData";

const compactVnd = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatDate = (timestamp) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp));

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="dashboard-chart-tooltip">
      <strong>{formatDate(label)}</strong>
      <span>GMV: {formatVND(point.gmv)}</span>
      <span>Đơn hoàn thành: {point.completedOrders}</span>
    </div>
  );
};

const TrendChart = ({ data }) => {
  const orderedData = sortTimeSeries(data);
  const { gmvDomain, ordersDomain, tickCount } =
    getDualAxisConfig(orderedData);

  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart
        data={orderedData}
        margin={{ top: 12, right: 10, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--border-color)" strokeDasharray="4 4" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatDate}
          stroke="var(--text-muted)"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="gmv"
          domain={gmvDomain}
          tickCount={tickCount}
          tickFormatter={(value) => compactVnd.format(value)}
          stroke="var(--text-muted)"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={58}
        />
        <YAxis
          yAxisId="orders"
          orientation="right"
          domain={ordersDomain}
          tickCount={tickCount}
          allowDecimals={false}
          stroke="var(--text-muted)"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<TrendTooltip />} />
        <Legend iconType="circle" />
        <Bar
          yAxisId="gmv"
          dataKey="gmv"
          name="GMV"
          fill="var(--accent-color)"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
        />
        <Line
          yAxisId="orders"
          type="monotone"
          dataKey="completedOrders"
          name="Đơn hoàn thành"
          stroke="var(--success)"
          strokeWidth={3}
          dot={{ r: 3, fill: "var(--card-bg)", strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default TrendChart;
