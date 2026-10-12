import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  BadgeDollarSign,
  Ban,
  Bike,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ShoppingBag,
  Star,
  Store,
  UserRoundX,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatVND } from "@drone-food/web-ui/utils/money";
import ActionTable from "./components/ActionTable";
import ChartCard from "./components/ChartCard";
import FilterBar from "./components/FilterBar";
import KpiCard from "./components/KpiCard";
import TrendChart from "./components/TrendChart";
import {
  dashboardPeriods,
  dashboardRegions,
} from "./dashboardContract";
import { sortTimeSeries } from "./dashboardData";
import "./Dashboard.css";

const STATUS_COLORS = {
  pending: "var(--warning)",
  preparing: "var(--accent-color)",
  delivering: "#af52de",
  delivered: "var(--success)",
  cancelled: "var(--danger)",
};

const periodLabelFor = (period) =>
  dashboardPeriods.find((option) => option.value === period)?.label ||
  "Hôm nay";

const regionLabelFor = (region) =>
  dashboardRegions.find((option) => option.value === region)?.label || region;

const formatDate = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

const formatTime = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

const Dashboard = ({ url }) => {
  const navigate = useNavigate();
  const requestIdRef = useRef(0);
  const [period, setPeriod] = useState("today");
  const [region, setRegion] = useState("all");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Missing admin token");
      const response = await axios.get(`${url}/api/admin/dashboard`, {
        params: { period, region },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      if (requestId !== requestIdRef.current) return;
      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || "Không thể tải dữ liệu dashboard.");
      }
      setSnapshot(response.data.data);
      setLastUpdated(new Date(response.data.data.generatedAt));
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Dashboard load error:", error);
      setLoadError(
        error.response?.data?.message || error?.message || "Không thể tải dữ liệu dashboard. Vui lòng thử lại."
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [period, region, url]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const periodLabel = periodLabelFor(period);
  const hourlyOrders = sortTimeSeries(snapshot?.hourlyOrders || []).map(
    (point) => ({
      ...point,
      hourLabel: `${new Date(point.timestamp).getUTCHours()}h`,
    })
  );
  const peakOrders = Math.max(0, ...hourlyOrders.map((point) => point.value));
  const actionStatus = loading ? "loading" : loadError ? "error" : "ready";
  const actions = snapshot?.actions || {
    unassignedOrders: [],
    pendingApprovals: [],
    recentCancellations: [],
    complaints: [],
  };

  const unassignedColumns = [
    {
      key: "orderId",
      label: "Mã đơn",
      render: (row) => <strong className="table-order-id">{row.orderId}</strong>,
    },
    { key: "merchant", label: "Merchant" },
    {
      key: "region",
      label: "Khu vực",
      render: (row) => regionLabelFor(row.region),
    },
    {
      key: "waitingMinutes",
      label: "Thời gian chờ",
      render: (row) => (
        <span className="waiting-time">{row.waitingMinutes} phút</span>
      ),
    },
    {
      key: "actions",
      label: "Hành động",
      render: () => (
        <div className="table-actions">
          <button type="button" onClick={() => navigate("/orders")}>
            Điều phối
          </button>
          <button type="button" className="is-danger" disabled title="Sắp ra mắt">
            Hủy
          </button>
        </div>
      ),
    },
  ];

  const approvalColumns = [
    { key: "name", label: "Tên" },
    {
      key: "entityType",
      label: "Loại",
      render: (row) => (
        <span className="entity-type-badge">{row.entityType}</span>
      ),
    },
    {
      key: "registeredAt",
      label: "Ngày đăng ký",
      render: (row) => formatDate(row.registeredAt),
    },
    {
      key: "actions",
      label: "Hành động",
      render: () => (
        <div className="table-actions">
          <button type="button" disabled title="Sắp ra mắt">
            Duyệt
          </button>
          <button type="button" className="is-danger" disabled title="Sắp ra mắt">
            Từ chối
          </button>
        </div>
      ),
    },
  ];

  const cancellationColumns = [
    {
      key: "orderId",
      label: "Mã đơn",
      render: (row) => <strong className="table-order-id">{row.orderId}</strong>,
    },
    { key: "reason", label: "Lý do hủy" },
    {
      key: "cancelledBy",
      label: "Ai hủy",
      render: (row) => <span className="cancelled-by">{row.cancelledBy}</span>,
    },
    {
      key: "cancelledAt",
      label: "Thời gian",
      render: (row) => formatTime(row.cancelledAt),
    },
  ];

  const complaintColumns = [
    {
      key: "orderId",
      label: "Mã đơn",
      render: (row) => <strong className="table-order-id">{row.orderId}</strong>,
    },
    {
      key: "rating",
      label: "Rating",
      render: (row) => (
        <span className="rating-badge" aria-label={`${row.rating} trên 5 sao`}>
          <Star size={14} fill="currentColor" aria-hidden="true" />
          {row.rating}/5
        </span>
      ),
    },
    { key: "content", label: "Nội dung" },
    {
      key: "actions",
      label: "Hành động",
      render: () => (
        <div className="table-actions">
          <button type="button" disabled title="Sắp ra mắt">
            Xem
          </button>
          <button type="button" disabled title="Sắp ra mắt">
            Phản hồi
          </button>
        </div>
      ),
    },
  ];

  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastUpdated)
    : "";

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow">Operational dashboard</span>
          <h1>Trung tâm vận hành</h1>
          <p>Hệ thống hôm nay có đang chạy ổn, và cần xử lý việc gì ngay?</p>
        </div>
        <span className="dashboard-source-badge">
          {snapshot?.source === "api" ? "Dữ liệu vận hành · Live" : "Dữ liệu vận hành"}
        </span>
      </header>

      <FilterBar
        period={period}
        region={region}
        periods={dashboardPeriods}
        regions={dashboardRegions}
        onPeriodChange={setPeriod}
        onRegionChange={setRegion}
        onRefresh={loadDashboard}
        refreshing={loading}
        lastUpdated={lastUpdatedLabel}
      />

      {loadError && !snapshot && (
        <div className="dashboard-global-error" role="alert">
          <strong>Không thể tải dashboard.</strong>
          <span>{loadError}</span>
          <button type="button" onClick={loadDashboard}>
            Thử lại
          </button>
        </div>
      )}

      <section className="dashboard-grid dashboard-kpi-grid" aria-label="Chỉ số vận hành">
        <KpiCard
          title={`Đơn ${periodLabel.toLowerCase()}`}
          value={(snapshot?.kpis.orders.total || 0).toLocaleString("vi-VN")}
          description={`${snapshot?.kpis.orders.successful || 0} thành công · ${snapshot?.kpis.orders.cancelled || 0} hủy`}
          trendPercent={snapshot?.kpis.orders.trendPercent || 0}
          icon={ShoppingBag}
          loading={loading && !snapshot}
        />
        <KpiCard
          title={`GMV ${periodLabel.toLowerCase()}`}
          value={formatVND(snapshot?.kpis.gmv.value || 0)}
          description="Tổng giá trị hàng hóa"
          trendPercent={snapshot?.kpis.gmv.trendPercent || 0}
          icon={BadgeDollarSign}
          loading={loading && !snapshot}
          valueClassName="kpi-card__value--compact"
        />
        <KpiCard
          title="Tài xế Online"
          value={`${snapshot?.kpis.driversOnline.online || 0} / ${snapshot?.kpis.driversOnline.total || 0}`}
          description="Đang sẵn sàng nhận đơn"
          trendPercent={snapshot?.kpis.driversOnline.trendPercent || 0}
          icon={Bike}
          loading={loading && !snapshot}
        />
        <KpiCard
          title="Merchant Online"
          value={`${snapshot?.kpis.merchantsOnline.online || 0} / ${snapshot?.kpis.merchantsOnline.total || 0}`}
          description="Đang mở nhận đơn"
          trendPercent={snapshot?.kpis.merchantsOnline.trendPercent || 0}
          icon={Store}
          loading={loading && !snapshot}
        />
        <KpiCard
          title="Đơn chưa có tài xế"
          value={(snapshot?.kpis.unassignedOrders.value || 0).toLocaleString("vi-VN")}
          description="Đơn đang chờ điều phối"
          trendPercent={snapshot?.kpis.unassignedOrders.trendPercent || 0}
          icon={UserRoundX}
          tone={snapshot?.kpis.unassignedOrders.value > 0 ? "danger" : "default"}
          loading={loading && !snapshot}
        />
        <KpiCard
          title="Tỷ lệ hủy đơn"
          value={`${snapshot?.kpis.cancellationRate.value || 0}%`}
          description="Cảnh báo vượt ngưỡng theo dõi"
          trendPercent={snapshot?.kpis.cancellationRate.trendPercent || 0}
          icon={Ban}
          tone="danger"
          tooltip={snapshot?.kpis.cancellationRate.tooltip}
          loading={loading && !snapshot}
        />
      </section>

      <section className="dashboard-grid dashboard-chart-grid" aria-label="Biểu đồ vận hành">
        <ChartCard
          title={`Đơn hàng theo giờ (${periodLabel})`}
          subtitle="Phân bổ khối lượng đơn theo khung giờ"
          loading={loading && !snapshot}
          error={loadError}
          onRetry={loadDashboard}
          summary={`Giờ cao điểm có ${peakOrders} đơn.`}
          headerAside={
            <span className="peak-hour-legend">
              <span aria-hidden="true" /> Giờ cao điểm
            </span>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={hourlyOrders}
              margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--border-color)" strokeDasharray="4 4" />
              <XAxis
                dataKey="hourLabel"
                interval={2}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--accent-light)" }}
                formatter={(value) => [`${value} đơn`, "Số đơn"]}
                labelFormatter={(label) => `Khung giờ ${label}`}
                contentStyle={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  color: "var(--text-color)",
                }}
              />
              <Bar dataKey="value" name="Số đơn" radius={[6, 6, 0, 0]}>
                {hourlyOrders.map((point) => (
                  <Cell
                    key={point.timestamp}
                    fill={
                      point.value === peakOrders && peakOrders > 0
                        ? "var(--warning)"
                        : "var(--accent-color)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Trạng thái đơn hàng"
          subtitle={`Theo bộ lọc ${periodLabel.toLowerCase()}`}
          loading={loading && !snapshot}
          error={loadError}
          onRetry={loadDashboard}
          summary={`Có ${snapshot?.kpis.orders.cancelled || 0} đơn bị hủy.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={snapshot?.orderStatuses || []}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="46%"
                innerRadius={66}
                outerRadius={98}
                paddingAngle={2}
              >
                {(snapshot?.orderStatuses || []).map((status) => (
                  <Cell
                    key={status.key}
                    fill={STATUS_COLORS[status.key] || "var(--text-muted)"}
                    stroke="var(--card-bg)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} đơn`, name]}
                contentStyle={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  color: "var(--text-color)",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                formatter={(value) => (
                  <span className={value === "Cancelled" ? "legend-cancelled" : ""}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="dashboard-section-heading">
        <div>
          <span className="dashboard-eyebrow">Ưu tiên xử lý</span>
          <h2>Danh sách cần hành động</h2>
        </div>
        <p>Các ngoại lệ vận hành mới nhất theo bộ lọc hiện tại.</p>
      </section>

      <section className="dashboard-grid dashboard-actions-grid">
        <ActionTable
          title="Đơn chưa gán tài xế (>15 phút)"
          rows={actions.unassignedOrders}
          columns={unassignedColumns}
          status={actionStatus}
          error={loadError}
          onRetry={loadDashboard}
        />
        <ActionTable
          title="Merchant/Tài xế chờ duyệt"
          rows={actions.pendingApprovals}
          columns={approvalColumns}
          status={actionStatus}
          error={loadError}
          onRetry={loadDashboard}
        />
        <ActionTable
          title="Đơn hủy gần đây"
          rows={actions.recentCancellations}
          columns={cancellationColumns}
          status={actionStatus}
          error={loadError}
          onRetry={loadDashboard}
        />
        <ActionTable
          title="Đánh giá xấu / Khiếu nại mới nhất"
          rows={actions.complaints}
          columns={complaintColumns}
          status={actionStatus}
          error={loadError}
          onRetry={loadDashboard}
        />
      </section>

      <section className="dashboard-grid dashboard-trend-grid">
        <ChartCard
          title="GMV & Đơn hàng 7 ngày qua"
          subtitle="GMV theo trục trái · Đơn hoàn thành theo trục phải"
          className="chart-card--full"
          loading={loading && !snapshot}
          error={loadError}
          onRetry={loadDashboard}
          summary="Biểu đồ kết hợp GMV và số đơn hoàn thành trong bảy ngày gần nhất."
        >
          <TrendChart data={snapshot?.trend7d || []} />
        </ChartCard>
      </section>

      <section className="lifetime-stats" aria-labelledby="lifetime-stats-title">
        <div className="lifetime-stats__header">
          <div>
            <span className="dashboard-eyebrow">Toàn thời gian</span>
            <h2 id="lifetime-stats-title">Lifetime Stats</h2>
          </div>
          <span>Dữ liệu API hiện tại, có mock fallback</span>
        </div>
        <div className="lifetime-stats__grid">
          <div>
            <Users size={18} aria-hidden="true" />
            <span>Tổng người dùng</span>
            <strong>
              {(snapshot?.lifetimeStats.totalUsers || 0).toLocaleString("vi-VN")}
            </strong>
          </div>
          <div>
            <Building2 size={18} aria-hidden="true" />
            <span>Tổng nhà hàng</span>
            <strong>
              {(snapshot?.lifetimeStats.totalRestaurants || 0).toLocaleString(
                "vi-VN"
              )}
            </strong>
          </div>
          <div>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>Đơn hoàn thành</span>
            <strong>
              {(snapshot?.lifetimeStats.totalCompletedOrders || 0).toLocaleString(
                "vi-VN"
              )}
            </strong>
          </div>
          <div>
            <CircleDollarSign size={18} aria-hidden="true" />
            <span>Doanh thu nền tảng</span>
            <strong>
              {formatVND(snapshot?.lifetimeStats.totalPlatformRevenue || 0)}
            </strong>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
