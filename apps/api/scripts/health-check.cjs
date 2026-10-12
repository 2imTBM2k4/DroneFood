/*
 * Staging / Production Health Check Script for DroneFood Backend API
 *
 * Usage:
 *   node scripts/health-check.cjs [options]
 *
 * Options:
 *   --base-url=<url>     Target API base URL (default: http://localhost:4000)
 *   --token=<jwt>        Optional JWT token to test authenticated endpoints
 *   --timeout=<ms>       Request timeout in milliseconds (default: 5000)
 *   --json               Output JSON format instead of human-readable text
 *   --help               Display this help message
 */

const DEFAULT_BASE_URL = "http://localhost:4000";
const DEFAULT_TIMEOUT_MS = 5000;

const runHealthChecks = async ({
  baseUrl = DEFAULT_BASE_URL,
  token = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const results = [];

  const executeRequest = async (path, options = {}) => {
    const url = `${normalizedBase}${path}`;
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const durationMs = Date.now() - startTime;
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return {
        ok: true,
        status: response.status,
        durationMs,
        data,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return {
        ok: false,
        error: err.message,
        durationMs,
      };
    }
  };

  const record = (endpoint, method, expectedStatus, result, validator) => {
    let passed = false;
    let message = "";

    if (!result.ok) {
      passed = false;
      message = `Lỗi mạng / Timeout: ${result.error}`;
    } else if (result.status !== expectedStatus) {
      passed = false;
      message = `Kỳ vọng HTTP ${expectedStatus}, nhận được ${result.status}`;
    } else {
      const validation = validator ? validator(result.data) : { valid: true };
      if (validation.valid) {
        passed = true;
        message = validation.message || "Phản hồi đúng chuẩn";
      } else {
        passed = false;
        message = validation.message || "Dữ liệu trả về không khớp cấu trúc";
      }
    }

    results.push({
      endpoint,
      method,
      expectedStatus,
      actualStatus: result.status || null,
      durationMs: result.durationMs,
      passed,
      isSlow: result.durationMs > 500,
      message,
    });
  };

  // 1. GET /api/health -> verify 200 + DB connected
  const healthRes = await executeRequest("/api/health");
  record("/api/health", "GET", 200, healthRes, (data) => {
    if (data?.status === "ok" && data?.database === "connected") {
      return { valid: true, message: `Hệ thống OK, DB connected (uptime: ${Math.round(data.uptime)}s)` };
    }
    return { valid: false, message: `Database chưa sẵn sàng: status=${data?.status}, db=${data?.database}` };
  });

  // 2. GET /api/branch/nearby -> verify 200, valid structure
  const nearbyRes = await executeRequest("/api/branch/nearby?lat=10.7769&lng=106.7009&radius=15");
  record("/api/branch/nearby", "GET", 200, nearbyRes, (data) => {
    if (data?.success === true && Array.isArray(data?.data)) {
      return { valid: true, message: `Tìm thấy ${data.data.length} cụm thương hiệu gần vị trí` };
    }
    return { valid: false, message: "Cấu trúc phản hồi nearby không hợp lệ" };
  });

  // 3. GET /api/merchant/list (unauthenticated) -> verify 401
  const merchantListUnauth = await executeRequest("/api/merchant/list");
  record("/api/merchant/list", "GET", 401, merchantListUnauth, () => ({
    valid: true,
    message: "Bảo mật tốt: Chặn truy cập trái phép",
  }));

  // 4. GET /api/restaurant/list (legacy) -> verify 200
  const legacyRestRes = await executeRequest("/api/restaurant/list");
  record("/api/restaurant/list (legacy)", "GET", 200, legacyRestRes, (data) => {
    if (data?.success === true && Array.isArray(data?.data)) {
      return { valid: true, message: `Tương thích ngược OK: trả về ${data.data.length} nhà hàng` };
    }
    return { valid: false, message: "Legacy endpoint phản hồi không hợp lệ" };
  });

  // 5. GET /api/audit (unauthenticated) -> verify 401
  const auditUnauth = await executeRequest("/api/audit");
  record("/api/audit", "GET", 401, auditUnauth, () => ({
    valid: true,
    message: "Bảo mật tốt: Chặn truy cập audit log",
  }));

  // 6. Optional: Token-based authenticated tests
  if (token) {
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    const meRes = await executeRequest("/api/merchant/me", authHeaders);
    record("/api/merchant/me", "GET", meRes.status === 404 ? 404 : 200, meRes, (data) => {
      if (meRes.status === 404) {
        return { valid: true, message: "Tài khoản hợp lệ (chưa sở hữu merchant)" };
      }
      if (data?.success === true && data?.data?.merchant) {
        return { valid: true, message: `Đã kết nối merchant "${data.data.merchant.name}"` };
      }
      return { valid: false, message: "Không thể lấy thông tin merchant" };
    });

    if (meRes.status === 200 && meRes.data?.data?.merchant?._id) {
      const merchantId = meRes.data.data.merchant._id;
      const branchListRes = await executeRequest(`/api/branch/list?merchantId=${merchantId}`);
      record(`/api/branch/list?merchantId=${merchantId}`, "GET", 200, branchListRes, (data) => {
        if (data?.success === true && Array.isArray(data?.data)) {
          return { valid: true, message: `Lấy được ${data.data.length} chi nhánh của merchant` };
        }
        return { valid: false, message: "Không thể lấy danh sách chi nhánh" };
      });
    }
  }

  const allPassed = results.every((r) => r.passed);
  return {
    allPassed,
    baseUrl: normalizedBase,
    timestamp: new Date().toISOString(),
    results,
  };
};

const runCli = async () => {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Kiểm tra sức khỏe Backend API (Staging / Production)

Cách dùng:
  node scripts/health-check.cjs [options]

Tùy chọn:
  --base-url=<url>     URL gốc của API (mặc định: http://localhost:4000)
  --token=<jwt>        JWT token để kiểm tra các endpoint cần đăng nhập
  --timeout=<ms>       Thời gian chờ tối đa cho mỗi request (mặc định: 5000ms)
  --json               Xuất kết quả định dạng JSON
  --help               Xem trợ giúp
`);
    return;
  }

  const getArgValue = (prefix) => {
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
  };

  const baseUrl = getArgValue("--base-url=") || DEFAULT_BASE_URL;
  const token = getArgValue("--token=");
  const timeoutMs = parseInt(getArgValue("--timeout=") || String(DEFAULT_TIMEOUT_MS), 10);
  const jsonOutput = args.includes("--json");

  const report = await runHealthChecks({ baseUrl, token, timeoutMs });

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.allPassed ? 0 : 1;
    return;
  }

  console.log("\n========================================================================");
  console.log(`       BÁO CÁO HEALTH CHECK API: ${report.baseUrl}`);
  console.log("========================================================================\n");

  for (const r of report.results) {
    const tag = r.passed ? "[\x1b[32mPASS\x1b[0m]" : "[\x1b[31mFAIL\x1b[0m]";
    const speedTag = r.isSlow ? `\x1b[33m${r.durationMs}ms (SLOW)\x1b[0m` : `\x1b[32m${r.durationMs}ms\x1b[0m`;
    console.log(`${tag} ${r.method.padEnd(5)} ${r.endpoint.padEnd(35)} | ${speedTag.padEnd(16)} | ${r.message}`);
  }

  console.log("\n------------------------------------------------------------------------");
  if (report.allPassed) {
    console.log("\x1b[32m✔ TẤT CẢ ENDPOINT ĐẠT YÊU CẦU HEALTH CHECK!\x1b[0m\n");
    process.exitCode = 0;
  } else {
    console.error("\x1b[31m✖ PHÁT HIỆN ENDPOINT BỊ LỖI HOẶC KHÔNG PHẢN HỒI ĐÚNG KỲ VỌNG.\x1b[0m\n");
    process.exitCode = 1;
  }
};

module.exports = {
  runHealthChecks,
};

if (require.main === module) {
  runCli().catch((err) => {
    console.error("Lỗi thực thi:", err);
    process.exit(1);
  });
}
