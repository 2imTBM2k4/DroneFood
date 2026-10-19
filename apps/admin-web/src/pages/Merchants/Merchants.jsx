import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  Store,
  X,
  FileCheck,
  Clock,
  ShieldAlert,
} from "lucide-react";
import axios from "axios";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./Merchants.css";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const APP_STATUS_OPTIONS = [
  { value: "pending", label: "Đang chờ duyệt (Pending)" },
  { value: "all", label: "Tất cả hồ sơ" },
  { value: "approved", label: "Đã duyệt (Approved)" },
  { value: "rejected", label: "Đã từ chối (Rejected)" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "individual", label: "Individual" },
  { value: "brand", label: "Brand" },
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

const MERCHANT_COLUMNS = [
  { key: "name", label: "Merchant" },
  { key: "type", label: "Type" },
  { key: "branchCount", label: "Branches" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "createdAt", label: "Created" },
];

const SortIcon = ({ active, direction }) => {
  if (!active) return <ChevronsUpDown size={14} aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp size={14} aria-hidden="true" />
  ) : (
    <ArrowDown size={14} aria-hidden="true" />
  );
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const statusLabel = (status) => ({
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
})[status] || status || "Unknown";

const typeLabel = (type) =>
  type === "brand" ? "Brand" : "Individual";

const MerchantMark = ({ merchant, size = "normal" }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const image = merchant.logoUrl || merchant.coverUrl;
  const initials = String(merchant.name || "M")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`merchant-mark merchant-mark--${size}`} aria-hidden="true">
      {image && !imageFailed ? (
        <img
          src={image}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

const ModalShell = ({
  children,
  titleId,
  descriptionId,
  onClose,
  closeRef,
  dialogRef,
  compact = false,
  busy = false,
}) =>
  createPortal(
    <div
      className="merchant-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`merchant-modal${compact ? " merchant-modal--compact" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy}
      >
        {children}
        <button
          ref={closeRef}
          type="button"
          className="merchant-modal-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </section>
    </div>,
    document.body
  );

const Merchants = ({ url }) => {
  const [searchParams] = useSearchParams();
  const routeSearch = searchParams.get("search") || "";
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState(routeSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(routeSearch);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
  });
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [action, setAction] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [working, setWorking] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocusedRef = useRef(null);

  // ── Brand Applications State ─────────────────────────────
  const [viewTab, setViewTab] = useState("merchants"); // "merchants" | "brand_applications"
  const [brandApps, setBrandApps] = useState([]);
  const [brandAppsLoading, setBrandAppsLoading] = useState(false);
  const [brandAppsError, setBrandAppsError] = useState("");
  const [brandAppFilter, setBrandAppFilter] = useState("pending");
  const [pendingAppsCount, setPendingAppsCount] = useState(0);
  const [brandAppAction, setBrandAppAction] = useState(null); // { kind: "approved" | "rejected", item: merchant }
  const [brandRejectReason, setBrandRejectReason] = useState("");
  const [selectedBrandApp, setSelectedBrandApp] = useState(null);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  useEffect(() => {
    if (routeSearch !== search) {
      setSearch(routeSearch);
      setDebouncedSearch(routeSearch);
      setPage(1);
    }
  }, [routeSearch, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  const fetchMerchants = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await axios.get(`${url}/api/merchant/list`, {
        headers: authHeaders(),
        params: {
          ...(status && { status }),
          ...(type && { type }),
          ...(debouncedSearch && { q: debouncedSearch }),
          ...(sortConfig.key && {
            sortBy: sortConfig.key,
            order: sortConfig.direction,
          }),
          page,
          limit,
        },
      });
      if (!response.data.success) {
        throw new Error(response.data.message || "Could not load merchants");
      }
      setMerchants(response.data.data || []);
      const nextPagination = response.data.pagination || {
        page,
        limit,
        total: response.data.data?.length || 0,
        totalPages: 1,
      };
      setPagination(nextPagination);
      if (nextPagination.totalPages > 0 && page > nextPagination.totalPages) {
        setPage(nextPagination.totalPages);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Could not load merchants";
      setLoadError(message);
      setMerchants([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, debouncedSearch, limit, page, sortConfig, status, type, url]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  const fetchBrandApps = useCallback(async () => {
    try {
      setBrandAppsLoading(true);
      setBrandAppsError("");
      const params = {};
      if (brandAppFilter && brandAppFilter !== "all") {
        params.status = brandAppFilter;
      }
      const response = await axios.get(`${url}/api/merchant/brand-applications`, {
        headers: authHeaders(),
        params,
      });
      if (response.data.success) {
        setBrandApps(response.data.data || []);
      } else {
        throw new Error(response.data.message || "Could not load brand applications");
      }
    } catch (err) {
      setBrandAppsError(err.response?.data?.message || err.message || "Lỗi khi tải danh sách hồ sơ");
      setBrandApps([]);
    } finally {
      setBrandAppsLoading(false);
    }
  }, [authHeaders, brandAppFilter, url]);

  const fetchPendingAppsCount = useCallback(async () => {
    try {
      const response = await axios.get(`${url}/api/merchant/brand-applications`, {
        headers: authHeaders(),
        params: { status: "pending" },
      });
      if (response.data.success) {
        setPendingAppsCount(response.data.data?.length || 0);
      }
    } catch {
      // Non-critical count error
    }
  }, [authHeaders, url]);

  useEffect(() => {
    fetchPendingAppsCount();
  }, [fetchPendingAppsCount]);

  useEffect(() => {
    if (viewTab === "brand_applications") {
      fetchBrandApps();
    }
  }, [viewTab, fetchBrandApps]);

  const closeDialog = useCallback(() => {
    if (working) return;
    setSelectedMerchant(null);
    setBranches([]);
    setAction(null);
    setSuspendReason("");
    setBrandAppAction(null);
    setSelectedBrandApp(null);
    setBrandRejectReason("");
    requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, [working]);

  const startBrandAppAction = (kind, item, trigger) => {
    lastFocusedRef.current = trigger;
    setBrandRejectReason("");
    setBrandAppAction({ kind, item });
  };

  const handleDecideBrandApp = async () => {
    if (!brandAppAction?.item) return;
    const { kind, item } = brandAppAction;
    if (kind === "rejected" && brandRejectReason.trim().length < 3) {
      notificationService.warning(
        "Thiếu lý do từ chối",
        "Vui lòng nhập lý do từ chối cụ thể (tối thiểu 3 ký tự).",
        { audience: "admin" }
      );
      return;
    }

    try {
      setWorking(true);
      const payload = {
        decision: kind,
        ...(kind === "rejected" ? { reason: brandRejectReason.trim() } : {}),
      };

      const response = await axios.post(
        `${url}/api/merchant/${item._id}/decide-brand-application`,
        payload,
        { headers: authHeaders() }
      );

      if (response.data.success) {
        notificationService.success(
          kind === "approved"
            ? "Đã phê duyệt lên Chuỗi thương hiệu thành công!"
            : "Đã từ chối hồ sơ nâng cấp chuỗi thương hiệu.",
          undefined,
          { audience: "admin" }
        );
        setBrandAppAction(null);
        setSelectedBrandApp(null);
        setBrandRejectReason("");
        await fetchBrandApps();
        await fetchPendingAppsCount();
        await fetchMerchants();
      } else {
        throw new Error(response.data.message || "Xử lý hồ sơ thất bại");
      }
    } catch (err) {
      notificationService.error(
        "Không thể xử lý hồ sơ",
        err.response?.data?.message || err.message || "Lỗi kết nối máy chủ.",
        { audience: "admin", priority: "high" }
      );
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    if (!selectedMerchant && !action && !brandAppAction && !selectedBrandApp) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !working) {
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [action, brandAppAction, closeDialog, selectedBrandApp, selectedMerchant, working]);

  const openDetail = async (merchant, trigger) => {
    lastFocusedRef.current = trigger;
    setSelectedMerchant(merchant);
    setBranches([]);
    setBranchesLoading(true);
    try {
      const response = await axios.get(`${url}/api/branch/list`, {
        params: { merchantId: merchant._id },
      });
      setBranches(response.data.data || []);
    } catch (error) {
      notificationService.error(
        "Không thể tải danh sách chi nhánh",
        error.response?.data?.message || "Lỗi khi lấy danh sách chi nhánh của đối tác.",
        {
          audience: "admin",
          priority: "high",
          key: `merchant-branches-${merchant._id}`,
          actions: [{ label: "Thử lại", onClick: () => openDetail(merchant) }],
        }
      );
    } finally {
      setBranchesLoading(false);
    }
  };

  const startAction = (kind, merchant, trigger) => {
    lastFocusedRef.current = trigger;
    setSelectedMerchant(null);
    setBranches([]);
    setSuspendReason("");
    setAction({ kind, merchant });
  };

  const approveMerchant = async () => {
    if (!action?.merchant) return;
    try {
      setWorking(true);
      const response = await axios.post(
        `${url}/api/merchant/${action.merchant._id}/approve`,
        {},
        { headers: authHeaders() }
      );
      notificationService.success(response.data.message || "Đã kích hoạt đối tác thành công", undefined, { audience: "admin", key: `merchant-approve-success-${action.merchant._id}` });
      setAction(null);
      await fetchMerchants();
    } catch (error) {
      notificationService.error(
        "Không thể kích hoạt đối tác",
        error.response?.data?.message || "Lỗi khi phê duyệt kích hoạt đối tác nhà hàng.",
        {
          audience: "admin",
          priority: "high",
          key: `merchant-approve-${action.merchant._id}`,
          actions: [{ label: "Thử lại", onClick: approveMerchant }],
        }
      );
    } finally {
      setWorking(false);
    }
  };

  const suspendMerchant = async () => {
    if (!action?.merchant || suspendReason.trim().length < 3) return;
    try {
      setWorking(true);
      const response = await axios.post(
        `${url}/api/merchant/${action.merchant._id}/suspend`,
        { reason: suspendReason.trim() },
        { headers: authHeaders() }
      );
      notificationService.success(response.data.message || "Đã đình chỉ đối tác thành công", undefined, { audience: "admin", key: `merchant-suspend-success-${action.merchant._id}` });
      setAction(null);
      setSuspendReason("");
      await fetchMerchants();
    } catch (error) {
      notificationService.error(
        "Không thể đình chỉ đối tác",
        error.response?.data?.message || "Lỗi khi đình chỉ tài khoản đối tác.",
        {
          audience: "admin",
          priority: "high",
          key: `merchant-suspend-${action.merchant._id}`,
          actions: [{ label: "Thử lại", onClick: suspendMerchant }],
        }
      );
    } finally {
      setWorking(false);
    }
  };

  const pageStart = pagination.total === 0
    ? 0
    : (pagination.page - 1) * pagination.limit + 1;
  const pageEnd = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  );

  return (
    <section className="merchants-page" aria-labelledby="merchants-title">
      <header className="merchants-header">
        <div>
          <p className="merchants-kicker">Merchant approvals</p>
          <h1 id="merchants-title">Restaurants & brands</h1>
          <p>
            Quản trị đối tác ẩm thực, kiểm duyệt hồ sơ nâng cấp chuỗi thương hiệu và vận hành chi nhánh.
          </p>
        </div>
        <div className="merchants-total" aria-live="polite">
          <Building2 size={18} />
          <span>
            {viewTab === "merchants"
              ? `${pagination.total} đối tác`
              : `${brandApps.length} hồ sơ nâng cấp`}
          </span>
        </div>
      </header>

      {/* ── View Navigation Tabs ───────────────────────────── */}
      <div className="merchants-view-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === "merchants"}
          className={`merchants-view-tab ${viewTab === "merchants" ? "active" : ""}`}
          onClick={() => setViewTab("merchants")}
        >
          <Store size={16} />
          <span>Danh sách đối tác</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewTab === "brand_applications"}
          className={`merchants-view-tab ${viewTab === "brand_applications" ? "active" : ""}`}
          onClick={() => setViewTab("brand_applications")}
        >
          <Building2 size={16} />
          <span>Duyệt hồ sơ lên chuỗi</span>
          {pendingAppsCount > 0 && (
            <span className="merchants-tab-badge">{pendingAppsCount}</span>
          )}
        </button>
      </div>

      {viewTab === "brand_applications" ? (
        /* ── BRAND UPGRADE APPLICATIONS QUEUE ─────────────── */
        <>
          <div className="merchants-toolbar" aria-label="Brand application filters">
            <label className="merchant-filter-control" style={{ gridColumn: "span 2" }}>
              <span>Trạng thái hồ sơ</span>
              <select
                value={brandAppFilter}
                onChange={(e) => setBrandAppFilter(e.target.value)}
              >
                {APP_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="merchant-refresh"
              onClick={fetchBrandApps}
              disabled={brandAppsLoading}
              style={{ justifySelf: "end" }}
            >
              <RefreshCw size={16} className={brandAppsLoading ? "is-spinning" : ""} />
              Làm mới danh sách
            </button>
          </div>

          <div className="merchants-table-card">
            {brandAppsError ? (
              <div className="merchants-state merchants-state--error">
                <CircleAlert size={28} />
                <strong>Không thể tải danh sách hồ sơ</strong>
                <span>{brandAppsError}</span>
                <button type="button" onClick={fetchBrandApps}>Thử lại</button>
              </div>
            ) : brandAppsLoading ? (
              <div className="merchants-state" role="status">
                Đang tải danh sách hồ sơ nâng cấp chuỗi...
              </div>
            ) : brandApps.length === 0 ? (
              <div className="merchants-state">
                <FileCheck size={28} />
                <strong>Không có hồ sơ nào</strong>
                <span>Hiện chưa có hồ sơ đăng ký thương hiệu chuỗi nào thuộc trạng thái này.</span>
              </div>
            ) : (
              <div className="merchants-table-scroll">
                <table className="merchants-table">
                  <thead>
                    <tr>
                      <th scope="col">Cửa hàng hiện tại</th>
                      <th scope="col">Tên chuỗi đề xuất</th>
                      <th scope="col">Mã số thuế</th>
                      <th scope="col">Người đại diện</th>
                      <th scope="col">SĐT liên hệ</th>
                      <th scope="col">Ngày nộp</th>
                      <th scope="col">Trạng thái hồ sơ</th>
                      <th scope="col" className="merchant-actions-heading">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandApps.map((merchant) => {
                      const app = merchant.brandApplication || {};
                      const appStatus = app.status || "pending";
                      return (
                        <tr key={merchant._id}>
                          <td data-label="Cửa hàng">
                            <div className="merchant-identity">
                              <MerchantMark merchant={merchant} />
                              <span>
                                <strong>{merchant.name}</strong>
                                <small>/{merchant.slug}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label="Chuỗi đề xuất">
                            <strong style={{ color: "var(--accent-color, #2563eb)" }}>
                              {app.brandName || "—"}
                            </strong>
                          </td>
                          <td data-label="Mã số thuế">
                            <code>{app.taxCode || "—"}</code>
                          </td>
                          <td data-label="Đại diện">
                            <strong>{app.representativeName || "—"}</strong>
                          </td>
                          <td data-label="SĐT">
                            <span>{app.phone || "—"}</span>
                          </td>
                          <td data-label="Ngày nộp" className="merchant-date">
                            {formatDate(app.submittedAt)}
                          </td>
                          <td data-label="Trạng thái">
                            <span className={`brand-app-status-badge ${appStatus}`}>
                              {appStatus === "pending" && <Clock size={12} />}
                              {appStatus === "approved" && <CheckCircle2 size={12} />}
                              {appStatus === "rejected" && <CircleAlert size={12} />}
                              {appStatus === "pending" && "Chờ duyệt"}
                              {appStatus === "approved" && "Đã duyệt lên chuỗi"}
                              {appStatus === "rejected" && "Từ chối"}
                            </span>
                          </td>
                          <td data-label="Thao tác" className="merchant-actions">
                            <button
                              type="button"
                              className="merchant-action merchant-action--view"
                              onClick={(e) => {
                                lastFocusedRef.current = e.currentTarget;
                                setSelectedBrandApp(merchant);
                              }}
                              title="Xem chi tiết hồ sơ"
                            >
                              <Eye size={15} /> Xem hồ sơ
                            </button>
                            {appStatus === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="merchant-action merchant-action--brand-approve"
                                  onClick={(e) =>
                                    startBrandAppAction("approved", merchant, e.currentTarget)
                                  }
                                  title="Duyệt cửa hàng thành chuỗi thương hiệu"
                                >
                                  Duyệt lên chuỗi
                                </button>
                                <button
                                  type="button"
                                  className="merchant-action merchant-action--brand-reject"
                                  onClick={(e) =>
                                    startBrandAppAction("rejected", merchant, e.currentTarget)
                                  }
                                  title="Từ chối hồ sơ nâng cấp"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── ALL MERCHANTS VIEW ────────────────────────────── */
        <>
          <div className="merchants-toolbar" aria-label="Merchant filters">
        <label className="merchants-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search merchants</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, slug or owner email"
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>

        <label className="merchant-filter-control">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="merchant-filter-control">
          <span>Type</span>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="merchant-refresh"
          onClick={fetchMerchants}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          Refresh
        </button>
      </div>

      <div className="merchants-table-card">
        {loadError ? (
          <div className="merchants-state merchants-state--error">
            <CircleAlert size={28} />
            <strong>Could not load merchants</strong>
            <span>{loadError}</span>
            <button type="button" onClick={fetchMerchants}>Try again</button>
          </div>
        ) : loading ? (
          <div className="merchants-state" role="status">
            Loading merchants…
          </div>
        ) : merchants.length === 0 ? (
          <div className="merchants-state">
            <Building2 size={28} />
            <strong>No merchants found</strong>
            <span>Change the search or filters to broaden the results.</span>
          </div>
        ) : (
          <div className="merchants-table-scroll">
            <table className="merchants-table">
              <thead>
                <tr>
                  {MERCHANT_COLUMNS.map((column) => {
                    const active = sortConfig.key === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          active
                            ? sortConfig.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={`merchant-sort${active ? " merchant-sort--active" : ""}`}
                          onClick={() => handleSort(column.key)}
                        >
                          <span>{column.label}</span>
                          <SortIcon
                            active={active}
                            direction={sortConfig.direction}
                          />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="merchant-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {merchants.map((merchant) => (
                  <tr key={merchant._id}>
                    <td data-label="Merchant">
                      <button
                        type="button"
                        className="merchant-identity"
                        onClick={(event) => openDetail(merchant, event.currentTarget)}
                      >
                        <MerchantMark merchant={merchant} />
                        <span>
                          <strong>{merchant.name}</strong>
                          <small>/{merchant.slug}</small>
                        </span>
                      </button>
                    </td>
                    <td data-label="Type">
                      <span className={`merchant-type merchant-type--${merchant.type}`}>
                        {typeLabel(merchant.type)}
                      </span>
                    </td>
                    <td data-label="Branches" className="merchant-number">
                      {merchant.branchCount ?? 0}
                    </td>
                    <td data-label="Status">
                      <span className={`merchant-status merchant-status--${merchant.status}`}>
                        {statusLabel(merchant.status)}
                      </span>
                    </td>
                    <td data-label="Owner">
                      <div className="merchant-owner">
                        <strong>{merchant.ownerUserId?.name || "Unknown owner"}</strong>
                        <small>{merchant.ownerUserId?.email || "No email"}</small>
                      </div>
                    </td>
                    <td data-label="Created" className="merchant-date">
                      {formatDate(merchant.createdAt)}
                    </td>
                    <td data-label="Actions" className="merchant-actions">
                      <button
                        type="button"
                        className="merchant-action merchant-action--view"
                        onClick={(event) => openDetail(merchant, event.currentTarget)}
                      >
                        <Eye size={15} /> View
                      </button>
                      {merchant.status === "pending" && (
                        <button
                          type="button"
                          className="merchant-action merchant-action--approve"
                          onClick={(event) =>
                            startAction("approve", merchant, event.currentTarget)
                          }
                        >
                          Approve
                        </button>
                      )}
                      {merchant.status === "active" && (
                        <button
                          type="button"
                          className="merchant-action merchant-action--suspend"
                          onClick={(event) =>
                            startAction("suspend", merchant, event.currentTarget)
                          }
                        >
                          Suspend
                        </button>
                      )}
                      {merchant.status === "suspended" && (
                        <button
                          type="button"
                          className="merchant-action merchant-action--approve"
                          onClick={(event) =>
                            startAction("reactivate", merchant, event.currentTarget)
                          }
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="merchants-pagination">
          <div>
            <span>
              Showing {pageStart}–{pageEnd} of {pagination.total}
            </span>
            <label>
              Rows
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
              >
                {LIMIT_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="merchant-page-buttons">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {pagination.totalPages === 0 ? 0 : pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1)
                )
              }
              disabled={
                loading ||
                pagination.totalPages === 0 ||
                page >= pagination.totalPages
              }
              aria-label="Next page"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </footer>
      </div>
    </>
  )}

      {/* ── Modal Chi tiết hồ sơ nâng cấp chuỗi ────────── */}
      {selectedBrandApp && (
        <ModalShell
          titleId="brand-app-detail-title"
          descriptionId="brand-app-detail-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="merchant-modal-header">
            <div className="merchant-modal-title">
              <MerchantMark merchant={selectedBrandApp} size="large" />
              <div>
                <span
                  className={`brand-app-status-badge ${
                    selectedBrandApp.brandApplication?.status || "pending"
                  }`}
                >
                  {selectedBrandApp.brandApplication?.status === "approved"
                    ? "Đã duyệt lên chuỗi"
                    : selectedBrandApp.brandApplication?.status === "rejected"
                    ? "Đã từ chối"
                    : "Đang chờ duyệt"}
                </span>
                <h2 id="brand-app-detail-title">
                  {selectedBrandApp.brandApplication?.brandName || selectedBrandApp.name}
                </h2>
                <p id="brand-app-detail-description">
                  Hồ sơ nâng cấp từ quán: <strong>{selectedBrandApp.name}</strong> (/{selectedBrandApp.slug})
                </p>
              </div>
            </div>
          </header>

          <div className="merchant-modal-body">
            <section className="merchant-detail-grid">
              <div>
                <span>Tên chuỗi đề xuất</span>
                <strong>{selectedBrandApp.brandApplication?.brandName || "—"}</strong>
              </div>
              <div>
                <span>Mã số thuế</span>
                <strong>{selectedBrandApp.brandApplication?.taxCode || "—"}</strong>
              </div>
              <div>
                <span>Người đại diện</span>
                <strong>{selectedBrandApp.brandApplication?.representativeName || "—"}</strong>
              </div>
              <div>
                <span>SĐT liên hệ</span>
                <strong>{selectedBrandApp.brandApplication?.phone || "—"}</strong>
              </div>
              <div>
                <span>Ngày nộp hồ sơ</span>
                <strong>{formatDate(selectedBrandApp.brandApplication?.submittedAt)}</strong>
              </div>
              <div>
                <span>Chủ tài khoản quán</span>
                <strong>{selectedBrandApp.ownerUserId?.name || selectedBrandApp.ownerUserId?.email || "—"}</strong>
              </div>
            </section>

            {selectedBrandApp.brandApplication?.notes && (
              <section className="merchant-description">
                <h3>Ghi chú & Kế hoạch mở rộng</h3>
                <p>{selectedBrandApp.brandApplication.notes}</p>
              </section>
            )}

            {selectedBrandApp.brandApplication?.rejectReason && (
              <section className="merchant-description" style={{ color: "#b91c1c" }}>
                <h3 style={{ color: "#b91c1c" }}>Lý do từ chối trước đó</h3>
                <p>{selectedBrandApp.brandApplication.rejectReason}</p>
              </section>
            )}

            {Array.isArray(selectedBrandApp.brandApplication?.licenseImages) &&
              selectedBrandApp.brandApplication.licenseImages.length > 0 && (
                <section className="merchant-branches-section">
                  <div className="merchant-section-heading">
                    <div>
                      <h3>Hình ảnh chứng thực / Giấy phép kinh doanh</h3>
                      <p>Giấy tờ pháp lý do đối tác tải lên</p>
                    </div>
                    <span>{selectedBrandApp.brandApplication.licenseImages.length}</span>
                  </div>
                  <div className="brand-app-images-list">
                    {selectedBrandApp.brandApplication.licenseImages.map((imgUrl, idx) => (
                      <a
                        key={idx}
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Bấm để mở ảnh kích thước lớn trong tab mới"
                      >
                        <img
                          src={imgUrl}
                          alt={`Giấy phép ${idx + 1}`}
                          className="brand-app-image-thumb"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/placeholder.jpg";
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </section>
              )}
          </div>

          <footer className="merchant-modal-footer">
            {selectedBrandApp.brandApplication?.status === "pending" && (
              <>
                <button
                  type="button"
                  className="merchant-action--brand-approve"
                  style={{ minHeight: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}
                  onClick={(e) => {
                    closeDialog();
                    startBrandAppAction("approved", selectedBrandApp, e.currentTarget);
                  }}
                >
                  Duyệt lên chuỗi
                </button>
                <button
                  type="button"
                  className="merchant-action--brand-reject"
                  style={{ minHeight: 36, padding: "0 14px", borderRadius: "var(--radius-sm)", fontWeight: 700 }}
                  onClick={(e) => {
                    closeDialog();
                    startBrandAppAction("rejected", selectedBrandApp, e.currentTarget);
                  }}
                >
                  Từ chối hồ sơ
                </button>
              </>
            )}
            <button type="button" className="merchant-secondary-action" onClick={closeDialog}>
              Đóng
            </button>
          </footer>
        </ModalShell>
      )}

      {/* ── Modal Xác nhận Duyệt / Từ chối hồ sơ lên chuỗi ── */}
      {brandAppAction && (
        <ModalShell
          compact
          busy={working}
          titleId="brand-app-action-title"
          descriptionId="brand-app-action-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="merchant-action-dialog-header">
            <span
              className={`merchant-action-icon ${
                brandAppAction.kind === "approved"
                  ? "merchant-action-icon--approve"
                  : "merchant-action-icon--suspend"
              }`}
            >
              {brandAppAction.kind === "approved" ? (
                <CheckCircle2 size={22} />
              ) : (
                <ShieldAlert size={22} />
              )}
            </span>
            <div>
              <h2 id="brand-app-action-title">
                {brandAppAction.kind === "approved"
                  ? "Phê duyệt lên Chuỗi thương hiệu"
                  : "Từ chối hồ sơ nâng cấp"}
              </h2>
              <p id="brand-app-action-description">
                {brandAppAction.kind === "approved"
                  ? `Phê duyệt đối tác "${brandAppAction.item.brandApplication?.brandName || brandAppAction.item.name}" chuyển đổi thành Chuỗi thương hiệu đa chi nhánh?`
                  : `Từ chối hồ sơ nâng cấp của quán "${brandAppAction.item.name}"?`}
              </p>
            </div>
          </header>

          {brandAppAction.kind === "approved" ? (
            <div style={{ marginTop: 16, padding: 12, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0", fontSize: 13, color: "#065f46", lineHeight: 1.55 }}>
              <strong>Tự động chuyển đổi sau khi duyệt:</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li>Mô hình kinh doanh chuyển từ <code>individual</code> sang <code>brand</code>.</li>
                <li>Tài khoản chủ quán được nâng cấp quyền thành <strong>Chủ thương hiệu (merchant_owner)</strong>.</li>
                <li>Quán ăn hiện tại trở thành <strong>chi nhánh con MAIN</strong> của chuỗi.</li>
                <li>Chủ thương hiệu có thể thêm nhiều chi nhánh và phân quyền quản lý chi nhánh.</li>
              </ul>
            </div>
          ) : (
            <label className="merchant-reason-field">
              <span>Lý do từ chối hồ sơ <strong style={{ color: "red" }}>*</strong></span>
              <textarea
                value={brandRejectReason}
                onChange={(event) => setBrandRejectReason(event.target.value)}
                placeholder="Vui lòng nêu rõ lý do từ chối (giấy tờ không hợp lệ, thông tin sai lệch...) để đối tác nắm được và gửi lại..."
                maxLength={500}
                autoFocus
              />
              <small>{brandRejectReason.trim().length}/500 · Tối thiểu 3 ký tự</small>
            </label>
          )}

          <footer className="merchant-action-dialog-footer">
            <button
              type="button"
              className="merchant-secondary-action"
              onClick={closeDialog}
              disabled={working}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className={
                brandAppAction.kind === "approved"
                  ? "merchant-primary-action"
                  : "merchant-danger-action"
              }
              onClick={handleDecideBrandApp}
              disabled={
                working ||
                (brandAppAction.kind === "rejected" && brandRejectReason.trim().length < 3)
              }
            >
              {working
                ? "Đang xử lý..."
                : brandAppAction.kind === "approved"
                ? "Xác nhận phê duyệt"
                : "Xác nhận từ chối"}
            </button>
          </footer>
        </ModalShell>
      )}

      {selectedMerchant && (
        <ModalShell
          titleId="merchant-detail-title"
          descriptionId="merchant-detail-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="merchant-modal-header">
            <div className="merchant-modal-title">
              <MerchantMark merchant={selectedMerchant} size="large" />
              <div>
                <span className={`merchant-status merchant-status--${selectedMerchant.status}`}>
                  {statusLabel(selectedMerchant.status)}
                </span>
                <h2 id="merchant-detail-title">{selectedMerchant.name}</h2>
                <p id="merchant-detail-description">/{selectedMerchant.slug}</p>
              </div>
            </div>
          </header>

          <div className="merchant-modal-body">
            <section className="merchant-detail-grid">
              <div><span>Type</span><strong>{typeLabel(selectedMerchant.type)}</strong></div>
              <div><span>Branches</span><strong>{selectedMerchant.branchCount ?? 0}</strong></div>
              <div><span>Owner</span><strong>{selectedMerchant.ownerUserId?.name || "N/A"}</strong></div>
              <div><span>Owner email</span><strong>{selectedMerchant.ownerUserId?.email || "N/A"}</strong></div>
              <div><span>Created</span><strong>{formatDate(selectedMerchant.createdAt)}</strong></div>
              <div><span>Merchant ID</span><strong>{selectedMerchant._id}</strong></div>
            </section>

            <section className="merchant-description">
              <h3>Description</h3>
              <p>{selectedMerchant.description || "No merchant description provided."}</p>
            </section>

            <section className="merchant-branches-section">
              <div className="merchant-section-heading">
                <div>
                  <h3>Branches</h3>
                  <p>Current operating locations under this merchant.</p>
                </div>
                <span>{branches.length}</span>
              </div>
              {branchesLoading ? (
                <div className="merchant-branches-state">Loading branches…</div>
              ) : branches.length === 0 ? (
                <div className="merchant-branches-state">No branches found.</div>
              ) : (
                <div className="merchant-branch-list">
                  {branches.map((branch) => (
                    <article key={branch._id} className="merchant-branch-row">
                      <span className="merchant-branch-icon"><Store size={17} /></span>
                      <div>
                        <strong>{branch.name}</strong>
                        <small>
                          <MapPin size={12} /> {branch.address?.text || "No address"}
                        </small>
                      </div>
                      <span className={`merchant-status merchant-status--${branch.status}`}>
                        {statusLabel(branch.status)}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <footer className="merchant-modal-footer">
            {selectedMerchant.status === "pending" && (
              <button
                type="button"
                className="merchant-primary-action"
                onClick={(event) =>
                  startAction("approve", selectedMerchant, event.currentTarget)
                }
              >
                Approve merchant
              </button>
            )}
            {selectedMerchant.status === "active" && (
              <button
                type="button"
                className="merchant-danger-action"
                onClick={(event) =>
                  startAction("suspend", selectedMerchant, event.currentTarget)
                }
              >
                Suspend merchant
              </button>
            )}
            {selectedMerchant.status === "suspended" && (
              <button
                type="button"
                className="merchant-primary-action"
                onClick={(event) =>
                  startAction("reactivate", selectedMerchant, event.currentTarget)
                }
              >
                Reactivate merchant
              </button>
            )}
            <button type="button" className="merchant-secondary-action" onClick={closeDialog}>
              Close
            </button>
          </footer>
        </ModalShell>
      )}

      {action && (
        <ModalShell
          compact
          busy={working}
          titleId="merchant-action-title"
          descriptionId="merchant-action-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="merchant-action-dialog-header">
            <span className={`merchant-action-icon merchant-action-icon--${action.kind}`}>
              {action.kind === "suspend" ? <CircleAlert size={22} /> : <CheckCircle2 size={22} />}
            </span>
            <div>
              <h2 id="merchant-action-title">
                {action.kind === "suspend"
                  ? "Suspend merchant"
                  : action.kind === "reactivate"
                    ? "Reactivate merchant"
                    : "Approve merchant"}
              </h2>
              <p id="merchant-action-description">
                {action.kind === "suspend"
                  ? `Suspend ${action.merchant.name} and close all branches?`
                  : `${action.kind === "reactivate" ? "Reactivate" : "Approve"} ${action.merchant.name}?`}
              </p>
            </div>
          </header>

          {action.kind === "suspend" && (
            <label className="merchant-reason-field">
              <span>Reason</span>
              <textarea
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                placeholder="Describe the compliance or operational reason"
                maxLength={500}
                autoFocus
              />
              <small>{suspendReason.trim().length}/500 · Minimum 3 characters</small>
            </label>
          )}

          <footer className="merchant-action-dialog-footer">
            <button
              type="button"
              className="merchant-secondary-action"
              onClick={closeDialog}
              disabled={working}
            >
              Cancel
            </button>
            <button
              type="button"
              className={
                action.kind === "suspend"
                  ? "merchant-danger-action"
                  : "merchant-primary-action"
              }
              onClick={action.kind === "suspend" ? suspendMerchant : approveMerchant}
              disabled={
                working ||
                (action.kind === "suspend" && suspendReason.trim().length < 3)
              }
            >
              {working
                ? "Saving…"
                : action.kind === "suspend"
                  ? "Suspend"
                  : action.kind === "reactivate"
                    ? "Reactivate"
                    : "Approve"}
            </button>
          </footer>
        </ModalShell>
      )}
    </section>
  );
};

export default Merchants;
