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
  Plane,
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./Branches.css";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "locked", label: "Locked" },
];

const DRONE_OPTIONS = [
  { value: "", label: "All delivery modes" },
  { value: "true", label: "Drone delivery enabled" },
  { value: "false", label: "Drone delivery disabled" },
];

const LIMIT_OPTIONS = [5, 10, 20, 50];

const BRANCH_COLUMNS = [
  { key: "name", label: "Branch" },
  { key: "code", label: "Code" },
  { key: "merchant", label: "Merchant" },
  { key: "address", label: "Address" },
  { key: "status", label: "Status" },
  { key: "droneDeliveryEnabled", label: "Drone delivery" },
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
  locked: "Locked",
})[status] || status || "Unknown";

const dayLabel = (day) => ([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
][day] || `Day ${day}`);

const ModalShell = ({
  children,
  titleId,
  descriptionId,
  onClose,
  closeRef,
  dialogRef,
  compact = false,
  busy = false,
}) => createPortal(
  <div
    className="branch-modal-backdrop"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}
  >
    <section
      ref={dialogRef}
      className={`branch-modal${compact ? " branch-modal--compact" : ""}`}
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
        className="branch-modal-close"
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

const StatusPill = ({ status }) => (
  <span className={`branch-status branch-status--${status}`}>
    {statusLabel(status)}
  </span>
);

const Branches = ({ url }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeMerchantId = searchParams.get("merchantId") || "";
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [droneDeliveryEnabled, setDroneDeliveryEnabled] = useState("");
  const [merchantId, setMerchantId] = useState(routeMerchantId);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [actionBranch, setActionBranch] = useState(null);
  const [lockReason, setLockReason] = useState("");
  const [working, setWorking] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  }), []);

  useEffect(() => {
    if (routeMerchantId !== merchantId) {
      setMerchantId(routeMerchantId);
      setPage(1);
    }
  }, [merchantId, routeMerchantId]);

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

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await axios.get(`${url}/api/branch/list`, {
        headers: authHeaders(),
        params: {
          ...(merchantId && { merchantId }),
          ...(status && { status }),
          ...(droneDeliveryEnabled && { droneDeliveryEnabled }),
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
        throw new Error(response.data.message || "Could not load branches");
      }
      setBranches(response.data.data || []);
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
      setLoadError(
        error.response?.data?.message || error.message || "Could not load branches"
      );
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, debouncedSearch, droneDeliveryEnabled, limit, merchantId, page, sortConfig, status, url]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const closeDialog = useCallback(() => {
    if (working) return;
    setSelectedBranch(null);
    setActionBranch(null);
    setLockReason("");
    requestAnimationFrame(() => lastFocusedRef.current?.focus());
  }, [working]);

  useEffect(() => {
    if (!selectedBranch && !actionBranch) return undefined;
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
  }, [actionBranch, closeDialog, selectedBranch, working]);

  const openDetail = (branch, trigger) => {
    lastFocusedRef.current = trigger;
    setSelectedBranch(branch);
  };

  const openLockDialog = (branch, trigger) => {
    lastFocusedRef.current = trigger;
    setSelectedBranch(null);
    setLockReason("");
    setActionBranch(branch);
  };

  const lockBranch = async () => {
    if (!actionBranch) return;
    const isLocked = actionBranch.status !== "locked";
    try {
      setWorking(true);
      const response = await axios.put(
        `${url}/api/branch/${actionBranch._id}/lock`,
        { isLocked, reason: lockReason.trim() },
        { headers: authHeaders() }
      );
      notificationService.success(response.data.message || "Cập nhật trạng thái chi nhánh thành công", undefined, { audience: "admin", key: `branch-status-success-${actionBranch._id}` });
      setActionBranch(null);
      setLockReason("");
      await fetchBranches();
    } catch (error) {
      notificationService.error(
        "Không thể cập nhật trạng thái chi nhánh",
        error.response?.data?.message || "Lỗi khi cập nhật trạng thái chi nhánh. Vui lòng thử lại.",
        {
          audience: "admin",
          priority: "high",
          key: `branch-status-${actionBranch?._id}`,
          actions: [{ label: "Thử lại", onClick: lockBranch }],
        }
      );
    } finally {
      setWorking(false);
    }
  };

  const goToMerchant = (branch) => {
    const merchant = branch.merchantId;
    if (!merchant?.name) return;
    navigate(`/merchants?search=${encodeURIComponent(merchant.name)}`);
  };

  const pageStart = pagination.total === 0
    ? 0
    : (pagination.page - 1) * pagination.limit + 1;
  const pageEnd = Math.min(pagination.page * pagination.limit, pagination.total);
  const actionIsLock = actionBranch?.status !== "locked";

  return (
    <section className="branches-page" aria-labelledby="branches-title">
      <header className="branches-header">
        <div>
          <p className="branches-kicker">Branch operations</p>
          <h1 id="branches-title">Locations & availability</h1>
          <p>Inspect branch coverage, delivery capability and operational access across every merchant.</p>
        </div>
        <div className="branches-total" aria-live="polite">
          <Store size={18} />
          <span>{pagination.total} branches</span>
        </div>
      </header>

      <div className="branches-toolbar" aria-label="Branch filters">
        <label className="branches-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search branches</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search branch, code or merchant"
            autoComplete="off"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <label className="branch-filter-control">
          <span>Status</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="branch-filter-control">
          <span>Drone delivery</span>
          <select value={droneDeliveryEnabled} onChange={(event) => { setDroneDeliveryEnabled(event.target.value); setPage(1); }}>
            {DRONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <button type="button" className="branch-refresh" onClick={fetchBranches} disabled={loading}>
          <RefreshCw size={16} className={loading ? "is-spinning" : ""} />
          Refresh
        </button>
      </div>

      <div className="branches-table-card">
        {loadError ? (
          <div className="branches-state branches-state--error">
            <CircleAlert size={28} />
            <strong>Could not load branches</strong>
            <span>{loadError}</span>
            <button type="button" onClick={fetchBranches}>Try again</button>
          </div>
        ) : loading ? (
          <div className="branches-state" role="status">Loading branches…</div>
        ) : branches.length === 0 ? (
          <div className="branches-state">
            <Store size={28} />
            <strong>No branches found</strong>
            <span>Change the filters or search to broaden the results.</span>
          </div>
        ) : (
          <div className="branches-table-scroll">
            <table className="branches-table">
              <thead>
                <tr>
                  {BRANCH_COLUMNS.map((column) => {
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
                          className={`branch-sort${active ? " branch-sort--active" : ""}`}
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
                  <th scope="col" className="branch-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch._id}>
                    <td data-label="Branch">
                      <button
                        type="button"
                        className="branch-name-button"
                        onClick={(event) => openDetail(branch, event.currentTarget)}
                      >
                        <Store size={16} />
                        <span>{branch.name}</span>
                      </button>
                    </td>
                    <td data-label="Code"><span className="branch-code">{branch.code}</span></td>
                    <td data-label="Merchant">
                      <button
                        type="button"
                        className="branch-merchant-link"
                        onClick={() => goToMerchant(branch)}
                      >
                        <strong>{branch.merchantId?.name || "Unknown merchant"}</strong>
                        <small>/{branch.merchantId?.slug || "—"}</small>
                      </button>
                    </td>
                    <td data-label="Address" className="branch-address">
                      <MapPin size={14} />
                      <span>{branch.address?.text || "No address"}</span>
                    </td>
                    <td data-label="Status"><StatusPill status={branch.status} /></td>
                    <td data-label="Drone delivery">
                      <span className={`drone-delivery-badge ${branch.droneDeliveryEnabled ? "drone-delivery-badge--enabled" : "drone-delivery-badge--disabled"}`}>
                        <Plane size={14} />
                        {branch.droneDeliveryEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td data-label="Created" className="branch-date">{formatDate(branch.createdAt)}</td>
                    <td data-label="Actions" className="branch-actions">
                      <button
                        type="button"
                        className="branch-action branch-action--view"
                        onClick={(event) => openDetail(branch, event.currentTarget)}
                      >
                        <Eye size={15} /> View
                      </button>
                      <button
                        type="button"
                        className={`branch-action ${branch.status === "locked" ? "branch-action--unlock" : "branch-action--lock"}`}
                        onClick={(event) => openLockDialog(branch, event.currentTarget)}
                      >
                        {branch.status === "locked" ? "Unlock" : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="branches-pagination">
          <div>
            <span>Showing {pageStart}–{pageEnd} of {pagination.total}</span>
            <label>
              Rows
              <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
                {LIMIT_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="branch-page-buttons">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} aria-label="Previous page"><ChevronLeft size={17} /></button>
            <span>Page {pagination.totalPages === 0 ? 0 : pagination.page} of {pagination.totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={loading || pagination.totalPages === 0 || page >= pagination.totalPages} aria-label="Next page"><ChevronRight size={17} /></button>
          </div>
        </footer>
      </div>

      {selectedBranch && (
        <ModalShell
          titleId="branch-detail-title"
          descriptionId="branch-detail-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="branch-modal-header">
            <div className="branch-modal-title">
              <span className="branch-detail-icon"><Store size={24} /></span>
              <div>
                <StatusPill status={selectedBranch.status} />
                <h2 id="branch-detail-title">{selectedBranch.name}</h2>
                <p id="branch-detail-description">{selectedBranch.code} · {selectedBranch.merchantId?.name || "Unknown merchant"}</p>
              </div>
            </div>
          </header>

          <div className="branch-modal-body">
            <section className="branch-detail-grid">
              <div><span>Code</span><strong>{selectedBranch.code}</strong></div>
              <div><span>Status</span><strong>{statusLabel(selectedBranch.status)}</strong></div>
              <div><span>Open to customers</span><strong>{selectedBranch.isOpen ? "Open" : "Closed"}</strong></div>
              <div><span>Drone delivery</span><strong>{selectedBranch.droneDeliveryEnabled ? "Enabled" : "Disabled"}</strong></div>
              <div><span>Phone</span><strong>{selectedBranch.phone || "N/A"}</strong></div>
              <div><span>Delivery radius</span><strong>{selectedBranch.deliveryRadiusKm == null ? "Default" : `${selectedBranch.deliveryRadiusKm} km`}</strong></div>
              <div><span>Latitude</span><strong>{selectedBranch.address?.lat ?? "N/A"}</strong></div>
              <div><span>Longitude</span><strong>{selectedBranch.address?.lng ?? "N/A"}</strong></div>
              <div className="branch-detail-wide"><span>Address</span><strong>{selectedBranch.address?.text || "N/A"}</strong></div>
            </section>

            <section className="branch-detail-section">
              <h3>Merchant</h3>
              <button type="button" className="branch-merchant-card" onClick={() => goToMerchant(selectedBranch)}>
                <Building2 size={18} />
                <span><strong>{selectedBranch.merchantId?.name || "Unknown merchant"}</strong><small>/{selectedBranch.merchantId?.slug || "—"} · {selectedBranch.merchantId?.type || "N/A"}</small></span>
                <ChevronRight size={17} />
              </button>
            </section>

            <section className="branch-detail-section">
              <h3>Operating hours</h3>
              {(selectedBranch.operatingHours || []).length === 0 ? (
                <p className="branch-empty-copy">No hours configured.</p>
              ) : (
                <div className="branch-hours-grid">
                  {(selectedBranch.operatingHours || []).map((hour) => (
                    <div key={hour.day}><span>{dayLabel(hour.day)}</span><strong>{hour.open} – {hour.close}</strong></div>
                  ))}
                </div>
              )}
            </section>

            <section className="branch-detail-section">
              <h3>Managers</h3>
              {(selectedBranch.managerUserIds || []).length === 0 ? (
                <p className="branch-empty-copy">No branch managers assigned.</p>
              ) : (
                <div className="branch-managers-list">
                  {selectedBranch.managerUserIds.map((manager) => (
                    <div key={manager._id || manager}>
                      <strong>{manager.name || "Manager"}</strong>
                      <small>{manager.email || manager._id || manager}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <footer className="branch-modal-footer">
            <button type="button" className={selectedBranch.status === "locked" ? "branch-primary-action" : "branch-danger-action"} onClick={(event) => openLockDialog(selectedBranch, event.currentTarget)}>
              {selectedBranch.status === "locked" ? "Unlock branch" : "Lock branch"}
            </button>
            <button type="button" className="branch-secondary-action" onClick={closeDialog}>Close</button>
          </footer>
        </ModalShell>
      )}

      {actionBranch && (
        <ModalShell
          compact
          busy={working}
          titleId="branch-lock-title"
          descriptionId="branch-lock-description"
          onClose={closeDialog}
          closeRef={closeRef}
          dialogRef={dialogRef}
        >
          <header className="branch-lock-dialog-header">
            <span className={`branch-lock-icon ${actionIsLock ? "branch-lock-icon--lock" : ""}`}>
              {actionIsLock ? <CircleAlert size={22} /> : <CheckCircle2 size={22} />}
            </span>
            <div>
              <h2 id="branch-lock-title">{actionIsLock ? "Lock branch" : "Unlock branch"}</h2>
              <p id="branch-lock-description">
                {actionIsLock ? `Lock ${actionBranch.name}? This removes it from active operations.` : `Restore ${actionBranch.name} to active status?`}
              </p>
            </div>
          </header>

          <label className="branch-reason-field">
            <span>Reason <em>Optional</em></span>
            <textarea value={lockReason} onChange={(event) => setLockReason(event.target.value)} maxLength={500} placeholder={actionIsLock ? "Optional compliance or operational reason" : "Optional unlock reason"} autoFocus />
            <small>{lockReason.trim().length}/500</small>
          </label>

          <footer className="branch-lock-dialog-footer">
            <button type="button" className="branch-secondary-action" onClick={closeDialog} disabled={working}>Cancel</button>
            <button type="button" className={actionIsLock ? "branch-danger-action" : "branch-primary-action"} onClick={lockBranch} disabled={working}>
              {working ? "Saving…" : actionIsLock ? "Lock branch" : "Unlock branch"}
            </button>
          </footer>
        </ModalShell>
      )}
    </section>
  );
};

export default Branches;
