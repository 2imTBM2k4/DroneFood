import AppError from "../utils/AppError.js";
import {
  AuditLog,
  Branch,
  Merchant,
  Order,
  OrderReview,
  Restaurant,
  ShipperProfile,
  User,
} from "../models/index.cjs";

const PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30 };
const REGIONS = new Set(["all", "district-1", "district-2", "district-3", "binh-thanh", "thu-duc"]);
const HCM_OFFSET_MS = 7 * 60 * 60 * 1000;
const ORDER_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  preparing: "Đang chuẩn bị",
  delivering: "Đang giao",
  delivered: "Hoàn thành",
  cancelled: "Cancelled",
};

const asNumber = (value) => Number(value) || 0;
const idOf = (value) => String(value?._id || value || "");
const cleanText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const regionOf = (value) => {
  const text = cleanText(value);
  if (/(quan|q\.?)\s*1\b/.test(text)) return "district-1";
  if (/(quan|q\.?)\s*2\b/.test(text)) return "district-2";
  if (/(quan|q\.?)\s*3\b/.test(text)) return "district-3";
  if (text.includes("binh thanh")) return "binh-thanh";
  if (text.includes("thu duc")) return "thu-duc";
  return "all";
};

const startOfHcmDay = (date = new Date()) => {
  const shifted = new Date(date.getTime() + HCM_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - HCM_OFFSET_MS);
};

const rangeFor = (period, now) => {
  const end = new Date(startOfHcmDay(now).getTime() + 24 * 60 * 60 * 1000);
  const days = PERIOD_DAYS[period];
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, previousStart };
};

const hcmParts = (date) => {
  const shifted = new Date(new Date(date).getTime() + HCM_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
};

const pseudoUtc = ({ year, month, day, hour = 0 }) =>
  new Date(Date.UTC(year, month, day, hour)).toISOString();

const pctChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const isSuccessful = (order) => order.orderStatus === "delivered";
const isUnassigned = (order) =>
  order.deliveryMethod === "shipper" &&
  order.shipperAssignmentStatus === "unassigned" &&
  !["cancelled", "delivered"].includes(order.orderStatus);

const orderRegion = (order) =>
  regionOf(order.branchId?.address?.text || order.restaurantId?.address || order.shippingAddress?.address);

const matchesRegion = (region, itemRegion) => region === "all" || region === itemRegion;

const metricFor = (orders) => {
  const total = orders.length;
  const successful = orders.filter(isSuccessful).length;
  const cancelled = orders.filter((order) => order.orderStatus === "cancelled").length;
  // GMV here is realized order value: delivered orders only. This deliberately
  // differs from platform revenue, which remains the existing 20% report below.
  const gmv = orders.filter(isSuccessful).reduce((sum, order) => sum + asNumber(order.totalPrice), 0);
  return { total, successful, cancelled, gmv, cancellationRate: total ? Number(((cancelled / total) * 100).toFixed(1)) : 0 };
};

const statusBuckets = (orders) => {
  const values = { pending: 0, preparing: 0, delivering: 0, delivered: 0, cancelled: 0 };
  orders.forEach((order) => {
    if (["pending", "pending_payment", "refund_pending"].includes(order.orderStatus)) values.pending += 1;
    else if (order.orderStatus === "preparing") values.preparing += 1;
    else if (["delivering", "arrived_at_delivery"].includes(order.orderStatus)) values.delivering += 1;
    else if (order.orderStatus === "delivered") values.delivered += 1;
    else if (order.orderStatus === "cancelled") values.cancelled += 1;
  });
  return Object.entries(values).map(([key, value]) => ({ key, label: ORDER_STATUS_LABELS[key], value }));
};

const actorLabel = (role) => ({ user: "Khách", merchant_owner: "Merchant", shipper: "Tài xế" }[role] || "Không rõ");
const isNoShipperTimeoutCancellation = (order) =>
  order.cancellationCode === "NO_SHIPPER_AVAILABLE" ||
  order.reason === "No shipper accepted this order within 15 minutes.";

export const getDashboardSnapshot = async ({ period = "today", region = "all", now = new Date() } = {}) => {
  if (!PERIOD_DAYS[period]) throw new AppError("Kỳ dữ liệu dashboard không hợp lệ", 400);
  if (!REGIONS.has(region)) throw new AppError("Khu vực dashboard không hợp lệ", 400);

  const { start, end, previousStart } = rangeFor(period, now);
  const orderFields = "totalPrice orderStatus deliveryMethod shipperAssignmentStatus createdAt updatedAt deliveredAt reason cancellationCode merchantId branchId restaurantId shippingAddress";
  const populateOrderSources = [
    { path: "merchantId", select: "name" },
    { path: "branchId", select: "address merchantId name" },
    { path: "restaurantId", select: "name address" },
  ];
  const todayStart = startOfHcmDay(now);
  const trendStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [currentRaw, previousRaw, todayRaw, trendRaw, profiles, merchants, branches, reviews, userCount, restaurantCount, completedCount, allDelivered] = await Promise.all([
    Order.find({ createdAt: { $gte: start, $lt: end } }).select(orderFields).populate(populateOrderSources).lean(),
    Order.find({ createdAt: { $gte: previousStart, $lt: start } }).select(orderFields).populate(populateOrderSources).lean(),
    Order.find({ createdAt: { $gte: todayStart, $lt: end } }).select(orderFields).populate(populateOrderSources).lean(),
    Order.find({ createdAt: { $gte: trendStart, $lt: end } }).select(orderFields).populate(populateOrderSources).lean(),
    ShipperProfile.find({}).select("status approvalStatus createdAt user").populate("user", "name").lean(),
    Merchant.find({}).select("name status createdAt").lean(),
    Branch.find({}).select("merchantId address isOpen status").lean(),
    OrderReview.find({ outcome: "rated", rating: { $lte: 2 } }).sort({ createdAt: -1 }).limit(20).populate({ path: "order", select: orderFields, populate: populateOrderSources }).lean(),
    User.countDocuments(),
    Restaurant.countDocuments(),
    Order.countDocuments({ orderStatus: "delivered" }),
    Order.find({ orderStatus: "delivered" }).select("totalPrice").lean(),
  ]);

  const include = (orders) => orders.filter((order) => matchesRegion(region, orderRegion(order)));
  const currentOrders = include(currentRaw);
  const previousOrders = include(previousRaw);
  const todayOrders = include(todayRaw);
  const metrics = metricFor(currentOrders);
  const previousMetrics = metricFor(previousOrders);

  const activeBranches = branches.filter((branch) => branch.status === "active");
  const approvedProfiles = profiles.filter((profile) => profile.approvalStatus === "approved");
  const activeBranchMerchantIds = new Set(activeBranches.map((branch) => idOf(branch.merchantId)));
  const merchantRegionById = new Map();
  branches.forEach((branch) => {
    const merchantId = idOf(branch.merchantId);
    if (!merchantRegionById.has(merchantId)) merchantRegionById.set(merchantId, regionOf(branch.address?.text));
  });
  const visibleMerchants = merchants.filter((merchant) => matchesRegion(region, merchantRegionById.get(idOf(merchant)) || "all"));
  const onlineMerchantIds = new Set(
    activeBranches.filter((branch) => branch.isOpen && matchesRegion(region, regionOf(branch.address?.text))).map((branch) => idOf(branch.merchantId))
  );
  const approvedMerchantCount = visibleMerchants.filter((merchant) => merchant.status === "active" && activeBranchMerchantIds.has(idOf(merchant))).length;
  const merchantsOnline = visibleMerchants.filter((merchant) => merchant.status === "active" && onlineMerchantIds.has(idOf(merchant))).length;

  const unassignedOrders = todayOrders
    .filter((order) => isUnassigned(order) && now.getTime() - new Date(order.createdAt).getTime() >= 15 * 60 * 1000)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 10)
    .map((order) => ({
      id: idOf(order), kind: "unassigned-order", orderId: idOf(order),
      merchant: order.merchantId?.name || order.branchId?.name || order.restaurantId?.name || "Không rõ",
      region: orderRegion(order), waitingMinutes: Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000), createdAt: order.createdAt,
    }));

  const cancelled = currentOrders.filter((order) => order.orderStatus === "cancelled").sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
  const cancellationAudits = cancelled.length
    ? await AuditLog.find({ targetType: "order", targetId: { $in: cancelled.map((order) => order._id) }, action: { $in: ["order.status_changed", "order.status_overridden_by_admin"] } }).sort({ createdAt: -1 }).lean()
    : [];
  const auditByOrder = new Map();
  cancellationAudits.forEach((audit) => { if (!auditByOrder.has(idOf(audit.targetId))) auditByOrder.set(idOf(audit.targetId), audit); });

  const pendingApprovals = [
    ...profiles.filter((profile) => profile.approvalStatus === "pending").map((profile) => ({
      id: idOf(profile), kind: "pending-approval", name: profile.user?.name || "Tài xế mới", entityType: "Tài xế", region: "all", registeredAt: profile.createdAt,
    })),
    ...merchants.filter((merchant) => merchant.status === "pending" && matchesRegion(region, merchantRegionById.get(idOf(merchant)) || "all")).map((merchant) => ({
      id: idOf(merchant), kind: "pending-approval", name: merchant.name, entityType: "Merchant", region: merchantRegionById.get(idOf(merchant)) || "all", registeredAt: merchant.createdAt,
    })),
  ].filter((item) => region === "all" || item.region === region).sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt)).slice(0, 10);

  const complaints = reviews
    .map((review) => ({ review, order: review.order }))
    .filter(({ order }) => order && matchesRegion(region, orderRegion(order)))
    .map(({ review, order }) => ({ id: idOf(review), kind: "complaint", orderId: idOf(order), rating: review.rating, content: review.comment || "Đánh giá thấp không kèm nội dung.", region: orderRegion(order), createdAt: review.createdAt }))
    .slice(0, 10);

  const hourlyCounts = Array.from({ length: 24 }, () => 0);
  todayOrders.forEach((order) => { hourlyCounts[hcmParts(order.createdAt).hour] += 1; });
  const todayParts = hcmParts(now);
  const hourlyOrders = hourlyCounts.map((value, hour) => ({ timestamp: pseudoUtc({ ...todayParts, hour }), value }));
  const trend7d = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(todayStart.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const orders = include(trendRaw.filter((order) => new Date(order.createdAt) >= dayStart && new Date(order.createdAt) < dayEnd));
    const delivered = orders.filter(isSuccessful);
    const day = hcmParts(dayStart);
    return { timestamp: pseudoUtc(day), gmv: delivered.reduce((sum, order) => sum + asNumber(order.totalPrice), 0), completedOrders: delivered.length };
  });

  return {
    generatedAt: now.toISOString(), source: "api", filters: { period, region },
    kpis: {
      orders: { total: metrics.total, successful: metrics.successful, cancelled: metrics.cancelled, trendPercent: pctChange(metrics.total, previousMetrics.total) },
      gmv: { value: metrics.gmv, currency: "VND", trendPercent: pctChange(metrics.gmv, previousMetrics.gmv) },
      driversOnline: { online: approvedProfiles.filter((profile) => profile.status !== "offline").length, total: approvedProfiles.length, trendPercent: 0 },
      merchantsOnline: { online: merchantsOnline, total: approvedMerchantCount, trendPercent: 0 },
      unassignedOrders: { value: unassignedOrders.length, trendPercent: pctChange(unassignedOrders.length, 0) },
      cancellationRate: { value: metrics.cancellationRate, trendPercent: pctChange(metrics.cancellationRate, previousMetrics.cancellationRate), tooltip: "Tỷ lệ đơn bị hủy trên tổng số đơn trong kỳ đã chọn. Mức hiện tại cần được ưu tiên kiểm tra." },
    },
    hourlyOrders,
    orderStatuses: statusBuckets(currentOrders),
    actions: {
      unassignedOrders,
      pendingApprovals,
      recentCancellations: cancelled.map((order) => {
        const audit = auditByOrder.get(idOf(order));
        return { id: idOf(order), kind: "cancelled-order", orderId: idOf(order), reason: order.reason || audit?.reason || "Chưa ghi nhận lý do", cancelledBy: isNoShipperTimeoutCancellation(order) ? "Hệ thống" : actorLabel(audit?.actorRole), region: orderRegion(order), cancelledAt: audit?.occurredAt || order.updatedAt };
      }),
      complaints,
    },
    trend7d,
    lifetimeStats: {
      totalUsers: userCount,
      totalRestaurants: restaurantCount,
      totalCompletedOrders: completedCount,
      totalPlatformRevenue: allDelivered.reduce((sum, order) => sum + asNumber(order.totalPrice) * 0.2, 0),
    },
  };
};
