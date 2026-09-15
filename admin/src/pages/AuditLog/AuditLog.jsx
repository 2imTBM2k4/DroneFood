import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import "./AuditLog.css";

// Every action the backend records today. Kept as a list so the filter offers
// real choices rather than whatever happens to be in the current page.
const ACTIONS = [
  "auth.login_succeeded",
  "auth.login_failed",
  "password.changed",
  "email.updated",
  "bank_account.viewed",
  "bank_account.updated",
  "money.transactions_viewed",
  "money.withdrawals_viewed",
  "withdrawal.requested",
  "order.status_changed",
  "order.status_overridden_by_admin",
  "user.updated_by_admin",
  "user.locked",
  "user.unlocked",
  "restaurant.locked",
  "restaurant.unlocked",
  "restaurant.opened",
  "restaurant.closed",
  "restaurant.deleted",
];

const TARGET_TYPES = ["user", "restaurant", "order", "food", "drone", "authentication", "bank_account", "wallet", "refund", "withdrawal"];
const CATEGORIES = [["authentication", "Đăng nhập & xác thực"], ["email", "Email"], ["password", "Mật khẩu"], ["banking", "Tài khoản ngân hàng"], ["money", "Tiền & giao dịch"], ["access", "Truy cập dữ liệu nhạy cảm"], ["operations", "Can thiệp vận hành"]];

// Actions are graded by how much they need scrutiny, not by which entity they
// touch: a deletion or an override should stand out when scanning the page.
const severityOf = (action) => {
  if (action.includes("deleted") || action.includes("overridden")) return "high";
  if (action.includes("locked") || action.includes("updated")) return "medium";
  return "low";
};

const formatAction = (action) => action.replace(/_/g, " ").replace(".", " · ");

const AuditLog = ({ url }) => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");
  const [category, setCategory] = useState("");

  const fetchLogs = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in again.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (targetType) params.set("targetType", targetType);
      if (action) params.set("action", action);
      if (category) params.set("category", category);

      const res = await axios.get(`${url}/api/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setLogs(res.data.data || []);
        setPagination(res.data.pagination || null);
      } else {
        throw new Error(res.data.message || "Could not load the audit log");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not load the audit log"
      );
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [url, page, targetType, action, category]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Changing a filter must restart at page 1, or an empty page 3 looks like
  // "no results".
  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1 className="audit-title">Audit Log</h1>
          <p className="audit-subtitle">
            Every privileged action — who did it, to what, and why. This trail is
            append-only: entries can never be edited or removed.
          </p>
        </div>
        {pagination && (
          <span className="audit-count">
            {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <div className="audit-filters">
        <label className="audit-filter">
          <span>Target</span>
          <select
            value={targetType}
            onChange={(e) => changeFilter(setTargetType)(e.target.value)}
          >
            <option value="">All targets</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="audit-filter">
          <span>Action</span>
          <select
            value={action}
            onChange={(e) => changeFilter(setAction)(e.target.value)}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
        </label>

        <label className="audit-filter">
          <span>Nhóm dữ liệu</span>
          <select value={category} onChange={(e) => changeFilter(setCategory)(e.target.value)}>
            <option value="">Tất cả dữ liệu</option>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        {(targetType || action || category) && (
          <button
            type="button"
            className="audit-clear"
            onClick={() => {
              setTargetType("");
              setAction("");
              setCategory("");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="audit-error">
          <p>{error}</p>
          <button type="button" onClick={fetchLogs}>
            Try again
          </button>
        </div>
      )}

      {!error && (
        <div className="audit-card">
          <div className="audit-table">
            <div className="audit-row audit-row--head">
              <b>When</b>
              <b>Who</b>
              <b>Action</b>
              <b>Category</b>
              <b>Target</b>
              <b>Reason / details</b>
            </div>

            {loading ? (
              <div className="audit-empty">Loading…</div>
            ) : logs.length === 0 ? (
              <div className="audit-empty">
                <ScrollText size={22} />
                <p>
                  {targetType || action || category
                    ? "No entries match these filters."
                    : "Nothing has been recorded yet."}
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <div className="audit-row" key={log._id}>
                  <span className="audit-time">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>

                  <span className="audit-actor">
                    <span className="audit-actor-email">
                      {log.actor?.email || log.actorEmail || "unknown"}
                    </span>
                    <span className="audit-role">{log.actorRole}</span>
                  </span>

                  <span
                    className={`audit-action audit-action--${severityOf(
                      log.action
                    )}`}
                  >
                    {formatAction(log.action)}
                  </span>

                  <span className="audit-category">{log.category || "operations"}</span>

                  <span className="audit-target">
                    <span className="audit-target-type">{log.targetType}</span>
                    <code>{log.targetId ? String(log.targetId).slice(-6) : "—"}</code>
                  </span>

                  <span className="audit-details">
                    {log.reason && (
                      <span className="audit-reason">{log.reason}</span>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="audit-meta">
                        {Object.entries(log.metadata)
                          .map(
                            ([k, v]) =>
                              `${k}: ${
                                Array.isArray(v) ? v.join(", ") || "—" : v
                              }`
                          )
                          .join("  ·  ")}
                      </span>
                    )}
                    {!log.reason &&
                      (!log.metadata ||
                        Object.keys(log.metadata).length === 0) && (
                        <span className="audit-meta">—</span>
                      )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="audit-pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((p) => Math.min(pagination.totalPages, p + 1))
            }
            disabled={page >= pagination.totalPages || loading}
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
