import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User, Food, Branch, Cart, Merchant } = require("../models/index.cjs");

// CLI arguments parsing
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const BASE_URL = (getArg("url", process.env.API_URL || "http://localhost:4000")).replace(/\/+$/, "");
const SCENARIO = getArg("scenario", "all");

// Formatting helpers
const formatMs = (val) => `${val.toFixed(1)} ms`;
const formatRps = (val) => `${val.toFixed(1)} req/s`;

function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const getPercentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

// Low-overhead HTTP request runner using native fetch
async function executeRequest(url, options = {}, timeoutMs = 10000) {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const duration = performance.now() - start;
    let body = null;
    try {
      body = await res.json();
    } catch {
      // response might not be JSON
    }
    return {
      ok: res.ok,
      status: res.status,
      duration,
      body,
      xCache: res.headers.get("x-cache"),
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      ok: false,
      status: error.name === "TimeoutError" ? 408 : 0,
      duration,
      error: error.message,
    };
  }
}

// Concurrency pool runner
async function runConcurrentRequests({ count, concurrency, requestFn }) {
  const results = [];
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < count) {
      const idx = currentIndex++;
      const res = await requestFn(idx);
      results.push(res);
    }
  };

  const startAll = performance.now();
  const workers = Array.from({ length: Math.min(concurrency, count) }, () => worker());
  await Promise.all(workers);
  const totalDurationMs = performance.now() - startAll;

  const latencies = results.map((r) => r.duration);
  const stats = calculateStats(latencies);
  const successCount = results.filter((r) => r.ok).length;
  const errorCount = results.length - successCount;
  const statusCodes = {};
  for (const r of results) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  const rps = (results.length / (totalDurationMs / 1000));

  const cacheHits = results.filter((r) => r.xCache === "HIT").length;

  return {
    total: results.length,
    successCount,
    errorCount,
    statusCodes,
    cacheHits,
    totalDurationMs,
    rps,
    stats,
    results,
  };
}

// ==========================================
// SCENARIO 1: Đọc dữ liệu tải cao (High Concurrency Read)
// ==========================================
async function runScenario1() {
  console.log("\n=======================================================");
  console.log(" BÀI TEST 1: ĐỌC DỮ LIỆU TẢI CAO (High Concurrency Read)");
  console.log("=======================================================");
  console.log("Mục tiêu: Đánh giá thông lượng (Throughput) & Độ trễ (Latency)");
  console.log("của các API đọc dữ liệu phổ biến khi có nhiều người truy cập đồng thời.\n");

  const endpoints = [
    {
      name: "1.1 Health Check (/api/health)",
      url: `${BASE_URL}/api/health`,
      method: "GET",
      count: 100,
      concurrency: 20,
    },
    {
      name: "1.2 Danh sách Nhà hàng (/api/restaurant/list?limit=10)",
      url: `${BASE_URL}/api/restaurant/list?limit=10`,
      method: "GET",
      count: 60,
      concurrency: 15,
    },
    {
      name: "1.3 Danh sách Món ăn (/api/food/list?limit=10)",
      url: `${BASE_URL}/api/food/list?limit=10`,
      method: "GET",
      count: 60,
      concurrency: 15,
    },
  ];

  for (const ep of endpoints) {
    process.stdout.write(`Đang chạy: ${ep.name} [${ep.count} reqs, concurrency: ${ep.concurrency}]... `);
    const summary = await runConcurrentRequests({
      count: ep.count,
      concurrency: ep.concurrency,
      requestFn: () => executeRequest(ep.url, { method: ep.method }),
    });

    console.log("HOÀN THÀNH");
    console.log(`   - Tổng request:    ${summary.total} (Thành công: ${summary.successCount}, Lỗi: ${summary.errorCount})`);
    console.log(`   - Phân bố HTTP:    ${JSON.stringify(summary.statusCodes)}`);
    if (summary.cacheHits > 0) {
      console.log(`   - Tỷ lệ Cache Hit: ${summary.cacheHits}/${summary.total} (${((summary.cacheHits / summary.total) * 100).toFixed(1)}%) [X-Cache: HIT]`);
    }
    console.log(`   - Throughput (RPS): ${formatRps(summary.rps)}`);
    console.log(`   - Độ trễ (Avg):    ${formatMs(summary.stats.avg)}`);
    console.log(`   - Độ trễ (p50):    ${formatMs(summary.stats.p50)}`);
    console.log(`   - Độ trễ (p95):    ${formatMs(summary.stats.p95)}`);
    console.log(`   - Độ trễ (p99):    ${formatMs(summary.stats.p99)}`);
    console.log(`   - Min / Max:        ${formatMs(summary.stats.min)} / ${formatMs(summary.stats.max)}\n`);
  }
}

// ==========================================
// SCENARIO 2: Đăng nhập dồn dập (Auth & bcrypt Stress Test)
// ==========================================
async function runScenario2(testUser) {
  console.log("\n=======================================================");
  console.log(" BÀI TEST 2: ĐĂNG NHẬP DỒN DẬP (Auth & bcrypt Stress Test)");
  console.log("=======================================================");
  console.log("Mục tiêu: Đánh giá tiêu thụ CPU do bcrypt hashing & Kiểm chứng");
  console.log("cơ chế rate limiting (giới hạn tần suất gọi API) bảo vệ backend.\n");

  const loginUrl = `${BASE_URL}/api/user/login`;
  const email = testUser?.email || "customer@dronefood.local";
  const password = "password123";

  // Đợt 2.1: Đo độ trễ tự nhiên của thuật toán bcrypt (5 requests)
  console.log("--- Đợt 2.1: Đo độ trễ xử lý mật khẩu qua bcrypt (5 requests tuần tự/song song) ---");
  const bcryptSummary = await runConcurrentRequests({
    count: 5,
    concurrency: 2,
    requestFn: () =>
      executeRequest(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal: "customer" }),
      }),
  });

  console.log(`   - Throughput (RPS): ${formatRps(bcryptSummary.rps)}`);
  console.log(`   - Độ trễ trung bình: ${formatMs(bcryptSummary.stats.avg)} (do bcrypt work factor salt = 10)`);
  console.log(`   - Mã phản hồi:      ${JSON.stringify(bcryptSummary.statusCodes)}\n`);

  // Đợt 2.2: Bắn dồn dập 20 requests để kích hoạt và kiểm chứng loginLimiter (Rate Limit)
  console.log("--- Đợt 2.2: Bắn dồn dập 20 requests để kích hoạt phòng vệ rate limiting ---");
  console.log("   (Hệ thống quy định: tối đa 10 attempts / 15 phút ngoài môi trường test)");
  const burstSummary = await runConcurrentRequests({
    count: 20,
    concurrency: 5,
    requestFn: () =>
      executeRequest(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal: "customer" }),
      }),
  });

  console.log(`   - Tổng request:    ${burstSummary.total}`);
  console.log(`   - Phân bố HTTP:    ${JSON.stringify(burstSummary.statusCodes)}`);
  const rateLimitedCount = burstSummary.statusCodes[429] || 0;
  console.log(`   - Bị chặn bởi 429: ${rateLimitedCount} requests`);

  if (rateLimitedCount > 0) {
    console.log("   => ĐÁNH GIÁ: ĐẠT! Cơ chế rate limiting đã kích hoạt chính xác,");
    console.log("      ngăn chặn kẻ xấu vắt kiệt CPU (CPU starvation) bằng brute-force.");
  } else {
    console.log("   => GHI CHÚ: Backend đang chạy ở cấu hình test hoặc ngưỡng rate limit chưa đạt.");
  }
}

// ==========================================
// SCENARIO 3: Ghi giỏ hàng đồng thời (Concurrent Cart Write & Race Condition)
// ==========================================
async function runScenario3(testUser, testFood, testBranch) {
  console.log("\n=======================================================");
  console.log(" BÀI TEST 3: GHI GIỎ HÀNG ĐỒNG THỜI (Race Condition & OCC)");
  console.log("=======================================================");
  console.log("Mục tiêu: Bắn 10 request đồng thời thêm cùng 1 món vào giỏ hàng");
  console.log("để kiểm chứng Mongoose Optimistic Concurrency Control (__v retry)");
  console.log("và đảm bảo không xảy ra hiện tượng mất mát dữ liệu (Lost Update).\n");

  if (!testUser || !testFood) {
    console.log("KHÔNG TÌM THẤY DỮ LIỆU USER HOẶC MÓN ĂN ĐỂ TEST GIỎ HÀNG. BỎ QUA.");
    return;
  }

  // Tạo JWT token cho test user
  const token = jwt.sign(
    { id: testUser._id.toString(), role: testUser.role || "user" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Xóa sạch giỏ hàng của user trước khi test
  await Cart.deleteMany({ userId: testUser._id });
  console.log(`1. Đã dọn sạch giỏ hàng của user: ${testUser.email}`);

  // Xử lý các nhóm tùy chọn bắt buộc (required option groups) nếu có
  const selectedOptions = [];
  if (testFood.optionGroups && Array.isArray(testFood.optionGroups)) {
    for (const group of testFood.optionGroups) {
      if (group.required && group.options && group.options.length > 0) {
        selectedOptions.push({
          groupName: group.name,
          optionName: group.options[0].name,
        });
      }
    }
  }

  const cartAddUrl = `${BASE_URL}/api/cart/add`;
  const payload = {
    itemId: testFood._id.toString(),
    ...(testBranch && { branchId: testBranch._id.toString() }),
    ...(!testBranch && testFood.restaurantId && { restaurantId: testFood.restaurantId.toString() }),
    quantity: 1,
    selectedOptions,
    note: "loadtest-concurrency",
  };

  const CONCURRENT_COUNT = 10;
  console.log(`2. Bắn đồng thời ${CONCURRENT_COUNT} requests POST /api/cart/add (mỗi request quantity = 1)...`);
  console.log(`   (Món: "${testFood.name}", Chi nhánh: "${testBranch?.name || "N/A"}", Options: ${selectedOptions.length})`);

  const startTime = performance.now();
  // Gửi song song tất cả các request cùng một lúc (Promise.all)
  const promises = Array.from({ length: CONCURRENT_COUNT }, (_, i) =>
    executeRequest(cartAddUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
  );

  const responses = await Promise.all(promises);
  const durationMs = performance.now() - startTime;

  const successResponses = responses.filter((r) => r.ok);
  const statusCodes = {};
  for (const r of responses) {
    statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
  }

  console.log(`   - Thời gian hoàn tất: ${formatMs(durationMs)}`);
  console.log(`   - Trạng thái HTTP:    ${JSON.stringify(statusCodes)}`);
  console.log(`   - Số request HTTP 200: ${successResponses.length}/${CONCURRENT_COUNT}`);

  if (successResponses.length < CONCURRENT_COUNT) {
    const failed = responses.find((r) => !r.ok);
    console.log(`   - Chi tiết phản hồi lỗi: Status ${failed?.status}, Message: ${JSON.stringify(failed?.body || failed?.error)}`);
  }

  // 3. Kiểm tra tính toàn vẹn dữ liệu trong cơ sở dữ liệu
  console.log("3. Kiểm tra tính toàn vẹn dữ liệu trong database (Data Integrity)...");
  const finalCart = await Cart.findOne({ userId: testUser._id }).lean();

  if (!finalCart) {
    console.log("   => LỖI: Không tìm thấy giỏ hàng trong database!");
    return;
  }

  const items = finalCart.items || [];
  const totalQuantityInDb = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  console.log(`   - Số dòng item trong giỏ: ${items.length}`);
  console.log(`   - Tổng quantity thực tế trong DB: ${totalQuantityInDb}`);
  console.log(`   - Phiên bản version document (__v): ${finalCart.__v}`);

  if (totalQuantityInDb === CONCURRENT_COUNT) {
    console.log("\n   => KẾT QUẢ: TUYỆT ĐỐI CHÍNH XÁC (100% DATA INTEGRITY)!");
    console.log(`      Cơ chế mutateItems (__v optimistic lock & retry) đã hợp nhất thành công`);
    console.log(`      toàn bộ ${CONCURRENT_COUNT} lượt ghi đồng thời mà không bị mất bất kỳ item nào.`);
  } else if (totalQuantityInDb === successResponses.length) {
    console.log(`\n   => KẾT QUẢ: TOÀN VẸN VỚI SỐ REQUEST THÀNH CÔNG (${totalQuantityInDb}/${successResponses.length}).`);
    console.log("      Mọi request được server xác nhận đều đã được bảo toàn vào DB.");
  } else {
    console.log(`\n   => CẢNH BÁO: Phát hiện chênh lệch dữ liệu! DB: ${totalQuantityInDb}, Thành công: ${successResponses.length}`);
  }

  // Dọn dẹp giỏ test
  await Cart.deleteMany({ userId: testUser._id });
  console.log("4. Đã dọn dẹp giỏ hàng test.");
}

// ==========================================
// MAIN ENTRY POINT
// ==========================================
async function main() {
  console.log("=================================================================");
  console.log("    DRONEFOOD BACKEND CONCURRENT LOAD & STRESS TESTING SUITE     ");
  console.log("=================================================================");
  console.log(`Thời gian: ${new Date().toISOString()}`);
  console.log(`Mục tiêu API: ${BASE_URL}`);
  console.log(`Kịch bản:    ${SCENARIO}\n`);

  // 1. Kiểm tra kết nối tới server API
  console.log(`Kiểm tra kết nối tới backend tại ${BASE_URL}...`);
  const healthCheck = await executeRequest(`${BASE_URL}/api/health`);
  if (!healthCheck.ok) {
    console.error(`KHÔNG THỂ KẾT NỐI TỚI BACKEND TẠI ${BASE_URL} (Status: ${healthCheck.status})`);
    console.error("Vui lòng đảm bảo backend đang chạy (ví dụ: npm --prefix apps/api run dev).");
    process.exit(1);
  }
  console.log(`Backend phản hồi OK (Uptime: ${healthCheck.body?.uptime ? healthCheck.body.uptime.toFixed(1) + "s" : "N/A"}).\n`);

  // 2. Kết nối database để chuẩn bị dữ liệu test
  let testUser = null;
  let testFood = null;
  let testBranch = null;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    testUser = await User.findOne({ role: "user" }).lean();
    const activeMerchants = await Merchant.find({ status: "active" }).select("_id").lean();
    const activeMerchantIds = activeMerchants.map((m) => m._id);

    const candidateBranches = await Branch.find({
      merchantId: { $in: activeMerchantIds },
      status: "active",
      isOpen: true,
    }).lean();

    for (const b of candidateBranches) {
      const f = await Food.findOne({
        merchantId: b.merchantId,
        isAvailable: true,
        $or: [
          { unavailableBranchIds: { $exists: false } },
          { unavailableBranchIds: { $ne: b._id } },
        ],
      }).lean();
      if (f) {
        testBranch = b;
        testFood = f;
        break;
      }
    }

    if (!testFood) {
      testFood = await Food.findOne({ isAvailable: true }).lean();
      testBranch = null;
    }
  } catch (err) {
    console.warn(`Lưu ý: Không thể kết nối trực tiếp MongoDB (${err.message}). Một số bài test giỏ hàng có thể bị giới hạn.`);
  }

  try {
    if (SCENARIO === "all" || SCENARIO === "1") {
      await runScenario1();
    }
    if (SCENARIO === "all" || SCENARIO === "2") {
      await runScenario2(testUser);
    }
    if (SCENARIO === "all" || SCENARIO === "3") {
      await runScenario3(testUser, testFood, testBranch);
    }
  } catch (error) {
    console.error("Lỗi trong quá trình chạy test tải:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    console.log("\n=================================================================");
    console.log("              HOÀN THÀNH TOÀN BỘ BÀI TEST CHỊU TẢI               ");
    console.log("=================================================================");
  }
}

main().catch(console.error);
