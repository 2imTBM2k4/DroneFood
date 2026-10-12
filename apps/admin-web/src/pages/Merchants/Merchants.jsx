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

  const closeDialog = useCallback(() => {
    if (working) return;
    setSelectedMerchant(null);
    setBranches([]);
    setAction(null);
    setSuspendReason("");
    requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, [working]);

  useEffect(() => {
    if (!selectedMerchant && !action) return undefined;
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
  }, [action, closeDialog, selectedMerchant, working]);

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
            Review ownership, branch coverage and approval status from one queue.
          </p>
        </div>
        <div className="merchants-total" aria-live="polite">
          <Building2 size={18} />
          <span>{pagination.total} merchants</span>
        </div>
      </header>

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
