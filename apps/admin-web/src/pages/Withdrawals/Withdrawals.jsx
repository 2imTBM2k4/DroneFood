import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Check,
  HandCoins,
  Landmark,
  RefreshCw,
  X,
  Store,
  Bike,
  Clock3,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import "./Withdrawals.css";

const money = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(String(text));
    toast.success(`Đã sao chép ${label}!`);
  } catch {
    toast.error(`Không thể sao chép ${label}.`);
  }
};

const STATUS_CONFIG = {
  pending: {
    label: "Chờ duyệt",
    className: "status-pending",
    icon: Clock3,
  },
  approved: {
    label: "Đã duyệt (Chờ chuyển)",
    className: "status-approved",
    icon: Landmark,
  },
  paid: {
    label: "Đã thanh toán",
    className: "status-paid",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Đã từ chối",
    className: "status-rejected",
    icon: XCircle,
  },
};

/* ============================================================
   Dialog Thông tin nhận tiền & Xác nhận chuyển khoản
   ============================================================ */
const PayoutModal = ({ request, payoutDetails, onClose, onConfirmPaid, onReject }) => {
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const isApproved = request.status === "approved";
  const isPaid = request.status === "paid";
  const reqCode = request._id.slice(-8).toUpperCase();
  const isShipper = request.actorType === "shipper";

  const handleCopyAcc = () => {
    copyToClipboard(payoutDetails.accountNumber, "số tài khoản");
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleCopyAmount = () => {
    copyToClipboard(request.amount, "số tiền");
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleConfirmPaid = async (e) => {
    e.preventDefault();
    if (!reference.trim()) {
      toast.warning("Vui lòng nhập mã giao dịch ngân hàng để đối soát.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmPaid(request, reference.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = async () => {
    if (!window.confirm(`Từ chối yêu cầu rút ${money(request.amount)}? Số tiền giữ chỗ sẽ được giải phóng về ví.`)) {
      return;
    }
    setSubmitting(true);
    try {
      await onReject(request);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="withdrawal-modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="withdrawal-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payout-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Landmark size={18} />
            </div>
            <div>
              <div className="modal-kicker">Snapshot tài khoản nhận</div>
              <h2 id="payout-modal-title">
                Yêu cầu rút tiền #{reqCode}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Visual Titanium Bank Card */}
        <div className="modal-bank-card">
          <div className="bank-card-header">
            <div className="bank-card-logo">
              <Landmark size={18} className="bank-card-icon" />
              <span className="bank-card-title">{payoutDetails.bankName}</span>
            </div>
            <span className="bank-actor-badge">
              {isShipper ? "Tài khoản Shipper" : "Tài khoản Nhà hàng"}
            </span>
          </div>

          <div className="bank-card-acc-box">
            <span className="acc-label">Số tài khoản thụ hưởng</span>
            <div className="acc-number-row">
              <span className="acc-number-display">{payoutDetails.accountNumber}</span>
              <button
                type="button"
                className={`btn-copy-tag ${copiedAcc ? "copied" : ""}`}
                onClick={handleCopyAcc}
                title="Sao chép số tài khoản"
              >
                {copiedAcc ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedAcc ? "Đã chép" : "Sao chép"}</span>
              </button>
            </div>
          </div>

          <div className="bank-card-footer-row">
            <div className="holder-col">
              <span className="acc-label">Chủ tài khoản</span>
              <strong className="holder-name">
                {payoutDetails.accountHolder?.toUpperCase()}
              </strong>
            </div>

            <div className="amount-col">
              <span className="acc-label">Số tiền cần chuyển</span>
              <div className="amount-action-row">
                <span className="amount-num">{money(request.amount)}</span>
                <button
                  type="button"
                  className={`btn-copy-icon-sm ${copiedAmount ? "copied" : ""}`}
                  onClick={handleCopyAmount}
                  title="Sao chép số tiền để chuyển khoản"
                >
                  {copiedAmount ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bank-card-footnote">
            <AlertCircle size={13} />
            <span>
              Đối chiếu chính xác thông tin trên trước khi chuyển. Thay đổi hồ sơ sau thời điểm này không ảnh hưởng yêu cầu này.
            </span>
          </div>
        </div>

        {/* Form xác nhận chuyển khoản (nếu status là approved) */}
        {isApproved && (
          <form onSubmit={handleConfirmPaid} className="modal-confirm-form">
            <div className="form-group">
              <label htmlFor="ref-code">
                Mã giao dịch ngân hàng (Transaction Reference) *
              </label>
              <input
                id="ref-code"
                className="modal-input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="VD: FT240915... hoặc MB99283..."
                required
                autoFocus
              />
              <span className="field-hint">
                Nhập mã tham chiếu chuyển khoản để lưu đối soát và trừ số dư khỏi ví.
              </span>
            </div>

            <footer className="modal-actions-footer">
              <button
                type="button"
                className="btn-modal-reject"
                onClick={handleRejectClick}
                disabled={submitting}
              >
                <X size={15} />
                <span>Từ chối yêu cầu</span>
              </button>

              <div className="modal-right-buttons">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={submitting}
                >
                  {submitting ? "Đang xử lý..." : "Xác nhận đã chuyển tiền"}
                </button>
              </div>
            </footer>
          </form>
        )}

        {/* Xem thông tin đã thanh toán */}
        {isPaid && (
          <div className="modal-paid-summary">
            <div className="paid-summary-box">
              <CheckCircle2 size={18} className="paid-icon" />
              <div>
                <strong>Đã thanh toán thành công</strong>
                <span>Mã giao dịch: <code>{request.bankTransactionReference || "—"}</code></span>
              </div>
            </div>
            <footer className="modal-actions-footer single-action">
              <button type="button" className="btn-modal-cancel" onClick={onClose}>
                Đóng
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
};

/* ============================================================
   Trang Quản lý Rút tiền (Withdrawals)
   ============================================================ */
const Withdrawals = ({ url }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // State quản lý Dialog
  const [activeDialogRequest, setActiveDialogRequest] = useState(null);
  const [activePayoutDetails, setActivePayoutDetails] = useState(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState("");

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/withdrawals/admin`, {
        headers: headers(),
      });
      setRequests(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải yêu cầu rút tiền.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  // Mở Dialog Thông tin nhận tiền
  const openPayoutDialog = async (request) => {
    try {
      setDetailsLoadingId(request._id);
      const response = await axios.get(
        `${url}/api/withdrawals/${request._id}/payout-details`,
        { headers: headers() }
      );
      setActiveDialogRequest(request);
      setActivePayoutDetails(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải thông tin chuyển khoản.");
    } finally {
      setDetailsLoadingId("");
    }
  };

  // Thao tác duyệt/từ chối từ dòng thẻ
  const act = async (request, action, payload = {}) => {
    if (action === "rejected") {
      if (
        !window.confirm(
          `Từ chối yêu cầu rút ${money(request.amount)}? Số tiền giữ chỗ sẽ được giải phóng về ví.`
        )
      ) {
        return;
      }
    }
    try {
      setSavingId(request._id);
      await axios.post(
        `${url}/api/withdrawals/${request._id}/${action}`,
        payload,
        { headers: headers() }
      );
      toast.success(
        action === "approved"
          ? "Đã duyệt yêu cầu rút tiền thành công."
          : action === "paid"
          ? "Đã xác nhận chuyển tiền và trừ ví."
          : "Đã từ chối, số tiền giữ chỗ đã được giải phóng."
      );
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật yêu cầu rút tiền.");
    } finally {
      setSavingId("");
    }
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "pending");
    const approved = requests.filter((r) => r.status === "approved");
    const paid = requests.filter((r) => r.status === "paid");
    const rejected = requests.filter((r) => r.status === "rejected");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, r) => sum + (r.amount || 0), 0),
      approvedCount: approved.length,
      approvedAmount: approved.reduce((sum, r) => sum + (r.amount || 0), 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((sum, r) => sum + (r.amount || 0), 0),
      rejectedCount: rejected.length,
    };
  }, [requests]);

  // Danh sách đã lọc theo tab & tìm kiếm
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (activeTab !== "all" && req.status !== activeTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const code = req._id ? req._id.toLowerCase() : "";
      const actor = req.actorType ? req.actorType.toLowerCase() : "";
      const ref = req.bankTransactionReference
        ? req.bankTransactionReference.toLowerCase()
        : "";
      const reason = req.rejectionReason ? req.rejectionReason.toLowerCase() : "";
      return (
        code.includes(q) ||
        actor.includes(q) ||
        ref.includes(q) ||
        reason.includes(q)
      );
    });
  }, [requests, activeTab, searchQuery]);

  return (
    <main className="withdrawal-page">
      {/* Header Card */}
      <header className="withdrawal-header-card">
        <div className="header-text-block">
          <div className="header-kicker">
            <HandCoins size={14} />
            <span>Thanh toán thủ công · Rút tiền ví</span>
          </div>
          <h1>Yêu cầu rút tiền</h1>
          <p>
            Duyệt yêu cầu rút tiền từ Đối tác Nhà hàng & Shipper. Mở thông tin tài khoản
            nhận dạng popup, chuyển khoản và xác nhận mã giao dịch.
          </p>
        </div>

        <button
          type="button"
          className="btn-refresh-withdrawals"
          onClick={load}
          disabled={loading}
          title="Làm mới danh sách"
        >
          <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* KPI Stats */}
      <section className="withdrawal-stats-grid">
        <article className="stat-card pending">
          <div className="stat-icon-box pending">
            <Clock3 size={20} />
          </div>
          <div className="stat-body">
            <span className="stat-title">Chờ duyệt</span>
            <div className="stat-value">{stats.pendingCount} yêu cầu</div>
            <span className="stat-sub">
              Tổng tiền: <strong>{money(stats.pendingAmount)}</strong>
            </span>
          </div>
        </article>

        <article className="stat-card approved">
          <div className="stat-icon-box approved">
            <Landmark size={20} />
          </div>
          <div className="stat-body">
            <span className="stat-title">Đã duyệt (Chờ chuyển)</span>
            <div className="stat-value">{stats.approvedCount} yêu cầu</div>
            <span className="stat-sub">
              Cần chuyển: <strong>{money(stats.approvedAmount)}</strong>
            </span>
          </div>
        </article>

        <article className="stat-card paid">
          <div className="stat-icon-box paid">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-body">
            <span className="stat-title">Đã hoàn tất chuyển</span>
            <div className="stat-value">{stats.paidCount} yêu cầu</div>
            <span className="stat-sub">
              Đã chi: <strong>{money(stats.paidAmount)}</strong>
            </span>
          </div>
        </article>
      </section>

      {/* Toolbar: Tabs & Search */}
      <section className="withdrawal-toolbar">
        <div className="withdrawal-tabs-list" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>Tất cả</span>
            <span className="tab-badge">{requests.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pending"}
            className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            <span>Chờ duyệt</span>
            {stats.pendingCount > 0 && (
              <span className="tab-badge warning">{stats.pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "approved"}
            className={`tab-btn ${activeTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            <span>Chờ chuyển tiền</span>
            {stats.approvedCount > 0 && (
              <span className="tab-badge blue">{stats.approvedCount}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "paid"}
            className={`tab-btn ${activeTab === "paid" ? "active" : ""}`}
            onClick={() => setActiveTab("paid")}
          >
            <span>Đã chuyển tiền</span>
            <span className="tab-badge">{stats.paidCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rejected"}
            className={`tab-btn ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            <span>Đã từ chối</span>
            <span className="tab-badge">{stats.rejectedCount}</span>
          </button>
        </div>

        <div className="withdrawal-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, đối tác, mã GD..."
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </section>

      {/* Main Content List */}
      {loading ? (
        <section className="withdrawal-state-box">
          <div className="apple-spinner" />
          <p>Đang tải danh sách yêu cầu rút tiền...</p>
        </section>
      ) : filteredRequests.length === 0 ? (
        <section className="withdrawal-state-box empty">
          <div className="empty-icon-circle">
            <HandCoins size={36} />
          </div>
          <h3>Không tìm thấy yêu cầu rút tiền</h3>
          <p>
            {searchQuery
              ? `Không có kết quả nào khớp với "${searchQuery}".`
              : "Hiện không có yêu cầu nào trong danh mục này."}
          </p>
          {searchQuery && (
            <button
              type="button"
              className="btn-reset-search"
              onClick={() => setSearchQuery("")}
            >
              Xóa tìm kiếm
            </button>
          )}
        </section>
      ) : (
        <section className="withdrawal-card-list">
          {filteredRequests.map((request) => {
            const isShipper = request.actorType === "shipper";
            const reqCode = request._id.slice(-8).toUpperCase();
            const statusConfig =
              STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const isSaving = savingId === request._id;
            const isOpening = detailsLoadingId === request._id;

            return (
              <article key={request._id} className="withdrawal-item-card">
                {/* Cột 1: Thông tin đối tác & mã đơn */}
                <div className="card-cell cell-identity">
                  <div className="actor-badge-row">
                    <span className={`actor-type-tag ${isShipper ? "shipper" : "restaurant"}`}>
                      {isShipper ? <Bike size={13} /> : <Store size={13} />}
                      <span>{isShipper ? "Shipper" : "Nhà hàng"}</span>
                    </span>
                    <span className="req-code-mono">#{reqCode}</span>
                  </div>

                  <div className="req-time-row">
                    <Clock3 size={13} />
                    <span>{date(request.createdAt)}</span>
                  </div>
                </div>

                {/* Cột 2: Số tiền & Trạng thái */}
                <div className="card-cell cell-amount">
                  <div className="amount-display">{money(request.amount)}</div>
                  <div className={`status-pill ${statusConfig.className}`}>
                    <StatusIcon size={13} />
                    <span>{statusConfig.label}</span>
                  </div>
                </div>

                {/* Cột 3: Nút thao tác (Gọn gàng, cân đối) */}
                <div className="card-cell cell-actions">
                  {request.status === "pending" && (
                    <div className="button-pair-row">
                      <button
                        type="button"
                        className="btn-action-approve"
                        disabled={isSaving}
                        onClick={() => act(request, "approve")}
                      >
                        <Check size={15} />
                        <span>{isSaving ? "Đang duyệt…" : "Duyệt yêu cầu"}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-reject"
                        disabled={isSaving}
                        onClick={() => act(request, "reject")}
                      >
                        <X size={15} />
                        <span>Từ chối</span>
                      </button>
                    </div>
                  )}

                  {request.status === "approved" && (
                    <div className="button-pair-row">
                      <button
                        type="button"
                        className="btn-action-payout"
                        disabled={isOpening || isSaving}
                        onClick={() => openPayoutDialog(request)}
                      >
                        <Landmark size={15} />
                        <span>
                          {isOpening ? "Đang mở…" : "Thông tin nhận tiền & Chuyển"}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="btn-action-reject"
                        disabled={isSaving || isOpening}
                        onClick={() => act(request, "reject")}
                        title="Từ chối yêu cầu này"
                      >
                        <X size={15} />
                        <span>Từ chối</span>
                      </button>
                    </div>
                  )}

                  {request.status === "paid" && (
                    <div className="paid-ref-cluster">
                      <div className="ref-tag-box" title="Mã giao dịch ngân hàng">
                        Ref: <code>{request.bankTransactionReference || "—"}</code>
                      </div>
                      <button
                        type="button"
                        className="btn-action-view"
                        disabled={isOpening}
                        onClick={() => openPayoutDialog(request)}
                        title="Xem lại tài khoản đã nhận tiền"
                      >
                        <Eye size={14} />
                        <span>{isOpening ? "Đang tải…" : "Xem tài khoản"}</span>
                      </button>
                    </div>
                  )}

                  {request.status === "rejected" && (
                    <div className="rejected-reason-box">
                      <XCircle size={14} />
                      <span>{request.rejectionReason || "Đã giải phóng tiền giữ chỗ"}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Dialog Thông tin nhận tiền */}
      {activeDialogRequest && activePayoutDetails && (
        <PayoutModal
          request={activeDialogRequest}
          payoutDetails={activePayoutDetails}
          onClose={() => {
            setActiveDialogRequest(null);
            setActivePayoutDetails(null);
          }}
          onConfirmPaid={(req, ref) =>
            act(req, "paid", { bankTransactionReference: ref })
          }
          onReject={(req) => act(req, "reject")}
        />
      )}
    </main>
  );
};

export default Withdrawals;
