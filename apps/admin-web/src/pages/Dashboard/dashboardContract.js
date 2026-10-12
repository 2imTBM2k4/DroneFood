/**
 * Live API contract: GET /api/admin/dashboard?period=<period>&region=<region>
 *
 * The response is { success: true, data: DashboardSnapshot }, where the
 * snapshot contains generatedAt, source: "api", filters, kpis, hourlyOrders,
 * orderStatuses, actions, trend7d, and lifetimeStats. See the endpoint's
 * integration test for a concrete, production-shaped response fixture.
 */
export const dashboardPeriods = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
];

export const dashboardRegions = [
  { value: "all", label: "Tất cả khu vực" },
  { value: "district-1", label: "Quận 1" },
  { value: "district-2", label: "Quận 2" },
  { value: "district-3", label: "Quận 3" },
  { value: "binh-thanh", label: "Bình Thạnh" },
  { value: "thu-duc", label: "Thủ Đức" },
];
