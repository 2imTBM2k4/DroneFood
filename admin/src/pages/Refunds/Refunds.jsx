import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  HandCoins,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock3,
  Landmark,
  Copy,
  Check,
  Eye,
  X,
  AlertCircle,
  FileText,
  User,
  CreditCard,
  Building2,
  Calendar,
  Hash,
} from "lucide-react";
import { toast } from "react-toastify";
import "./Refunds.css";

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
  requested: {
    label: "Chờ xử lý",
    className: "status-requested",
    icon: Clock3,
  },
  paid: {
    label: "Đã hoàn tiền",
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
   Dialog Xử lý Hoàn tiền (Pending / Requested)
   ============================================================ */
const RefundDialog = ({ refund, payoutDetails, onClose, onComplete }) => {
  const [mode, setMode] = useState("paid");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const handleCopyAcc = () => {
    copyToClipboard(payoutDetails.accountNumber, "số tài khoản");
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleCopyAmount = () => {
    copyToClipboard(refund.amount, "số tiền");
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (mode === "paid" && !reference.trim()) {
      toast.warning("Vui lòng nhập mã giao dịch chuyển khoản ngân hàng.");
      return;
    }
    if (mode === "rejected" && !note.trim()) {
      toast.warning("Vui lòng nhập lý do từ chối để phản hồi khách hàng.");
      return;
    }
    setSaving(true);
    try {
      await onComplete(refund._id, mode, {
        transferReference: reference.trim(),
        adminNote: note.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const orderCode = refund.order?._id
    ? refund.order._id.slice(-8).toUpperCase()
    : "—";

  return createPortal(
    <div className="refund-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="refund-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="dialog-header">
          <div className="dialog-title-box">
            <span className="dialog-badge-icon">
              <HandCoins size={18} />
            </span>
            <div>
              <div className="dialog-kicker">Hoàn tiền thủ công PayOS</div>
              <h2 id="refund-dialog-title">Xử lý yêu cầu #{orderCode}</h2>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Visual Bank Preview Card */}
        <div className="dialog-bank-card">
          <div className="bank-card-top">
            <div className="bank-brand">
              <Landmark size={20} className="bank-icon" />
              <span className="bank-name">{payoutDetails.bankName || "Ngân hàng"}</span>
            </div>
            <span className="bank-card-tag">Tài khoản thụ hưởng</span>
          </div>

          <div className="bank-card-acc-row">
            <div className="bank-acc-info">
              <span className="bank-acc-label">Số tài khoản</span>
              <span className="bank-acc-number">{payoutDetails.accountNumber}</span>
            </div>
            <button
              type="button"
              className={`btn-copy-acc ${copiedAcc ? "copied" : ""}`}
              onClick={handleCopyAcc}
              title="Sao chép số tài khoản"
            >
              {copiedAcc ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedAcc ? "Đã chép" : "Sao chép"}</span>
            </button>
          </div>

          <div className="bank-card-holder-row">
            <div>
              <span className="bank-acc-label">Chủ tài khoản</span>
              <span className="bank-holder-name">
                {payoutDetails.accountHolder?.toUpperCase()}
              </span>
            </div>
            <div className="bank-amount-box">
              <span className="bank-acc-label">Số tiền cần chuyển</span>
              <div className="bank-amount-row">
                <span className="bank-amount-val">{money(refund.amount)}</span>
                <button
                  type="button"
                  className={`btn-copy-amount ${copiedAmount ? "copied" : ""}`}
                  onClick={handleCopyAmount}
                  title="Sao chép số tiền để chuyển khoản"
                >
                  {copiedAmount ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          <div className="bank-card-reason">
            <span className="reason-label">Lý do hủy đơn:</span>
            <span className="reason-text">"{refund.reason}"</span>
          </div>
        </div>

        {/* Customer & Order Metadata Strip */}
        <div className="dialog-meta-strip">
          <div className="meta-item">
            <User size={14} />
            <span>
              Khách hàng: <strong>{refund.customer?.name || "—"}</strong>
            </span>
          </div>
          <div className="meta-item">
            <Calendar size={14} />
            <span>
              Yêu cầu lúc: <strong>{date(refund.createdAt)}</strong>
            </span>
          </div>
        </div>

        {/* Action Choice & Form */}
        <form onSubmit={submit} className="dialog-form">
          <div className="form-action-group">
            <label className="form-action-label">Hành động xử lý *</label>
            <div className="segmented-action-picker">
              <button
                type="button"
                className={`action-pill-btn approve ${mode === "paid" ? "active" : ""}`}
                onClick={() => setMode("paid")}
              >
                <CheckCircle2 size={16} />
                <div>
                  <strong>Xác nhận đã chuyển tiền</strong>
                  <small>Đã gửi tiền qua Internet Banking</small>
                </div>
              </button>

              <button
                type="button"
                className={`action-pill-btn reject ${mode === "rejected" ? "active" : ""}`}
                onClick={() => setMode("rejected")}
              >
                <XCircle size={16} />
                <div>
                  <strong>Từ chối hoàn tiền</strong>
                  <small>Thông tin sai hoặc không hợp lệ</small>
                </div>
              </button>
            </div>
          </div>

          {mode === "paid" ? (
            <div className="form-fields-wrap">
              <div className="form-group">
                <label htmlFor="ref-input">
                  Mã giao dịch chuyển khoản ngân hàng (FT/Trace code) *
                </label>
                <input
                  id="ref-input"
                  className="dialog-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="VD: FT2409158372648 hoặc MB9928374..."
                  required
                  autoFocus
                />
                <span className="field-hint">
                  Nhập mã tham chiếu từ biên lai ngân hàng để khách hàng và kế toán đối soát.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="note-input">Ghi chú nội bộ (tuỳ chọn)</label>
                <textarea
                  id="note-input"
                  className="dialog-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm nếu có..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="form-fields-wrap">
              <div className="form-group">
                <label htmlFor="reject-reason">Lý do từ chối hoàn tiền *</label>
                <textarea
                  id="reject-reason"
                  className="dialog-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập lý do từ chối để phản hồi cho khách hàng..."
                  required
                  rows={3}
                  autoFocus
                />
                <span className="field-hint">
                  Lý do này sẽ được ghi nhận vào lịch sử đơn hàng của khách.
                </span>
              </div>
            </div>
          )}

          {/* Dialog Footer */}
          <footer className="dialog-footer">
            <button
              type="button"
              className="btn-dialog-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className={`btn-dialog-submit ${mode === "rejected" ? "danger" : "primary"}`}
              disabled={saving}
            >
              {saving
                ? "Đang lưu..."
                : mode === "paid"
                ? "Xác nhận đã hoàn tiền"
                : "Từ chối yêu cầu"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
};

/* ============================================================
   Dialog Xem chi tiết Lịch sử (Paid / Rejected)
   ============================================================ */
const DetailDialog = ({ refund, onClose }) => {
  const isPaid = refund.status === "paid";
  const orderCode = refund.order?._id
    ? refund.order._id.slice(-8).toUpperCase()
    : "—";

  return createPortal(
    <div className="refund-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section
        className="refund-dialog detail-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <div className="dialog-title-box">
            <span className={`dialog-badge-icon ${isPaid ? "paid" : "rejected"}`}>
              {isPaid ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </span>
            <div>
              <div className="dialog-kicker">Chi tiết xử lý yêu cầu</div>
              <h2>Đơn hàng #{orderCode}</h2>
            </div>
          </div>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="detail-dialog-content">
          <div className="detail-status-banner">
            <div className="status-banner-left">
              <span className="banner-title">Trạng thái quyết định</span>
              <span className={`banner-status-tag ${isPaid ? "paid" : "rejected"}`}>
                {isPaid ? "Đã chuyển tiền hoàn" : "Đã từ chối hoàn tiền"}
              </span>
            </div>
            <div className="status-banner-amount">
              <span className="banner-title">Số tiền</span>
              <span className="banner-amount-value">{money(refund.amount)}</span>
            </div>
          </div>

          <div className="detail-info-grid">
            <div className="info-group">
              <span className="info-label">Khách hàng</span>
              <span className="info-value">{refund.customer?.name || "—"}</span>
              {refund.customer?.phone && (
                <span className="info-sub">{refund.customer.phone}</span>
              )}
            </div>

            <div className="info-group">
              <span className="info-label">Ngân hàng nhận</span>
              <span className="info-value">{refund.bank?.bankName || "—"}</span>
              <span className="info-sub">
                {refund.bank?.accountNumberLast4
                  ? `•••• ${refund.bank.accountNumberLast4}`
                  : "Chưa lưu"} · {refund.bank?.accountHolder}
              </span>
            </div>

            <div className="info-group">
              <span className="info-label">Lý do yêu cầu</span>
              <span className="info-value reason-quote">"{refund.reason}"</span>
            </div>

            {isPaid && (
              <div className="info-group highlight">
                <span className="info-label">Mã giao dịch chuyển khoản</span>
                <span className="info-value mono">
                  {refund.transferReference || "Chưa ghi nhận mã"}
                </span>
              </div>
            )}

            {refund.adminNote && (
              <div className="info-group">
                <span className="info-label">
                  {isPaid ? "Ghi chú admin" : "Lý do từ chối của admin"}
                </span>
                <span className="info-value note-box">{refund.adminNote}</span>
              </div>
            )}

            <div className="info-group">
              <span className="info-label">Người xử lý & Thời gian</span>
              <span className="info-value">
                {refund.processedBy?.name || "Quản trị viên"}
              </span>
              <span className="info-sub">{date(refund.processedAt || refund.updatedAt)}</span>
            </div>
          </div>
        </div>

        <footer className="dialog-footer">
          <button type="button" className="btn-dialog-cancel" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
};

/* ============================================================
   Component Chính: Refunds
   ============================================================ */
const Refunds = ({ url }) => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("requested");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [openingId, setOpeningId] = useState("");

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${url}/api/refunds`, {
        headers: headers(),
      });
      setRefunds(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách hoàn tiền.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = refunds.filter((r) => r.status === "requested");
    const paid = refunds.filter((r) => r.status === "paid");
    const rejected = refunds.filter((r) => r.status === "rejected");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, r) => sum + (r.amount || 0), 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((sum, r) => sum + (r.amount || 0), 0),
      rejectedCount: rejected.length,
    };
  }, [refunds]);

  const filteredRefunds = useMemo(() => {
    return refunds.filter((refund) => {
      if (activeTab !== "all" && refund.status !== activeTab) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const orderCode = refund.order?._id ? refund.order._id.toLowerCase() : "";
      const customerName = refund.customer?.name ? refund.customer.name.toLowerCase() : "";
      const customerPhone = refund.customer?.phone ? refund.customer.phone.toLowerCase() : "";
      const bankName = refund.bank?.bankName ? refund.bank.bankName.toLowerCase() : "";
      const accountHolder = refund.bank?.accountHolder
        ? refund.bank.accountHolder.toLowerCase()
        : "";
      const reason = refund.reason ? refund.reason.toLowerCase() : "";
      const ref = refund.transferReference ? refund.transferReference.toLowerCase() : "";
      return (
        orderCode.includes(q) ||
        customerName.includes(q) ||
        customerPhone.includes(q) ||
        bankName.includes(q) ||
        accountHolder.includes(q) ||
        reason.includes(q) ||
        ref.includes(q)
      );
    });
  }, [refunds, activeTab, searchQuery]);

  const openRefund = async (refund) => {
    try {
      setOpeningId(refund._id);
      const response = await axios.get(
        `${url}/api/refunds/${refund._id}/payout-details`,
        { headers: headers() }
      );
      setSelected({ refund, payoutDetails: response.data.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải thông tin chuyển khoản.");
    } finally {
      setOpeningId("");
    }
  };

  const complete = async (id, mode, payload) => {
    try {
      await axios.post(
        `${url}/api/refunds/${id}/${mode === "paid" ? "mark-paid" : "reject"}`,
        mode === "paid" ? payload : { adminNote: payload.adminNote },
        { headers: headers() }
      );
      toast.success(
        mode === "paid"
          ? "Đã xác nhận hoàn tiền thành công."
          : "Đã từ chối yêu cầu hoàn tiền."
      );
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật yêu cầu hoàn tiền.");
      throw error;
    }
  };

  return (
    <main className="refund-page">
      {/* Page Header */}
      <header className="refund-header-card">
        <div className="header-text-group">
          <div className="header-kicker">
            <HandCoins size={14} />
            <span>Hoàn tiền thủ công · PayOS Gateway</span>
          </div>
          <h1>Duyệt & Quản lý hoàn tiền</h1>
          <p>
            Kiểm tra tài khoản thụ hưởng, thực hiện chuyển tiền và xác nhận mã giao dịch
            hoặc từ chối yêu cầu hoàn tiền.
          </p>
        </div>

        <button
          type="button"
          className="btn-refresh-refunds"
          onClick={load}
          disabled={loading}
          title="Làm mới danh sách"
        >
          <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* KPI Stats Grid */}
      <section className="refund-stats-grid">
        <article className="stat-card stat-pending">
          <div className="stat-card-icon pending">
            <Clock3 size={20} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-title">Yêu cầu chờ xử lý</span>
            <div className="stat-card-number">{stats.pendingCount} đơn</div>
            <span className="stat-card-sub">
              Tổng tiền: <strong>{money(stats.pendingAmount)}</strong>
            </span>
          </div>
        </article>

        <article className="stat-card stat-paid">
          <div className="stat-card-icon paid">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-title">Đã chuyển tiền thành công</span>
            <div className="stat-card-number">{stats.paidCount} đơn</div>
            <span className="stat-card-sub">
              Tổng tiền: <strong>{money(stats.paidAmount)}</strong>
            </span>
          </div>
        </article>

        <article className="stat-card stat-rejected">
          <div className="stat-card-icon rejected">
            <XCircle size={20} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-title">Yêu cầu đã từ chối</span>
            <div className="stat-card-number">{stats.rejectedCount} đơn</div>
            <span className="stat-card-sub">Đơn không đủ điều kiện hoàn</span>
          </div>
        </article>
      </section>

      {/* Toolbar: Tabs & Search Input */}
      <section className="refund-toolbar">
        <div className="refund-tabs-list" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "requested"}
            className={`tab-btn ${activeTab === "requested" ? "active" : ""}`}
            onClick={() => setActiveTab("requested")}
          >
            <span>Chờ xử lý</span>
            {stats.pendingCount > 0 && (
              <span className="tab-count-badge warning">{stats.pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "paid"}
            className={`tab-btn ${activeTab === "paid" ? "active" : ""}`}
            onClick={() => setActiveTab("paid")}
          >
            <span>Đã hoàn tiền</span>
            <span className="tab-count-badge">{stats.paidCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rejected"}
            className={`tab-btn ${activeTab === "rejected" ? "active" : ""}`}
            onClick={() => setActiveTab("rejected")}
          >
            <span>Đã từ chối</span>
            <span className="tab-count-badge">{stats.rejectedCount}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>Tất cả</span>
            <span className="tab-count-badge">{refunds.length}</span>
          </button>
        </div>

        <div className="refund-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, tên khách, ngân hàng..."
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </section>

      {/* Content List */}
      {loading ? (
        <section className="refund-loading-state">
          <div className="apple-spinner" />
          <p>Đang tải dữ liệu yêu cầu hoàn tiền...</p>
        </section>
      ) : filteredRefunds.length === 0 ? (
        <section className="refund-empty-state">
          <div className="empty-icon-box">
            <HandCoins size={36} />
          </div>
          <h3>Không tìm thấy yêu cầu hoàn tiền</h3>
          <p>
            {searchQuery
              ? `Không có kết quả nào khớp với từ khóa "${searchQuery}".`
              : activeTab === "requested"
              ? "Hiện không có yêu cầu hoàn tiền nào đang chờ xử lý."
              : "Không có dữ liệu trong mục này."}
          </p>
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchQuery("")}
            >
              Xóa tìm kiếm
            </button>
          )}
        </section>
      ) : (
        <section className="refund-card-feed">
          {filteredRefunds.map((refund) => {
            const statusConfig = STATUS_CONFIG[refund.status] || STATUS_CONFIG.requested;
            const StatusIcon = statusConfig.icon;
            const isPending = refund.status === "requested";
            const orderCode = refund.order?._id
              ? refund.order._id.slice(-8).toUpperCase()
              : "—";

            return (
              <article key={refund._id} className="refund-item-card">
                {/* Order & Customer */}
                <div className="card-col col-order">
                  <div className="order-tag-row">
                    <span className="order-mono-code">#{orderCode}</span>
                    <span className="order-time">
                      <Clock3 size={12} />
                      {date(refund.createdAt)}
                    </span>
                  </div>

                  <div className="customer-info-row">
                    <div className="customer-avatar">
                      <User size={14} />
                    </div>
                    <div className="customer-text">
                      <strong className="customer-name">
                        {refund.customer?.name || "Khách hàng"}
                      </strong>
                      <span className="customer-sub">
                        {refund.customer?.phone || refund.customer?.email || "Chưa có liên hệ"}
                      </span>
                    </div>
                  </div>

                  <div className="order-reason-preview" title={refund.reason}>
                    <span className="reason-label">Lý do:</span>
                    <span className="reason-snippet">{refund.reason}</span>
                  </div>
                </div>

                {/* Bank Snapshot */}
                <div className="card-col col-bank">
                  <div className="bank-pill-badge">
                    <Building2 size={13} />
                    <span>{refund.bank?.bankName || "Ngân hàng"}</span>
                  </div>
                  <div className="bank-account-text">
                    {refund.bank?.accountNumberLast4 ? (
                      <code>•••• {refund.bank.accountNumberLast4}</code>
                    ) : (
                      <code>•••• ••••</code>
                    )}
                  </div>
                  <div className="bank-holder-text">
                    {refund.bank?.accountHolder || "Chưa rõ chủ thẻ"}
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="card-col col-amount">
                  <div className="amount-display">{money(refund.amount)}</div>
                  <div className={`status-pill ${statusConfig.className}`}>
                    <StatusIcon size={13} />
                    <span>{statusConfig.label}</span>
                  </div>
                  {refund.transferReference && (
                    <div className="ref-badge" title="Mã giao dịch chuyển khoản">
                      Ref: {refund.transferReference}
                    </div>
                  )}
                </div>

                {/* Action CTA */}
                <div className="card-col col-action">
                  {isPending ? (
                    <button
                      type="button"
                      className="btn-process-action"
                      onClick={() => openRefund(refund)}
                      disabled={openingId === refund._id}
                    >
                      <HandCoins size={15} />
                      <span>{openingId === refund._id ? "Đang mở…" : "Xử lý hoàn tiền"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-view-detail"
                      onClick={() => setViewDetail(refund)}
                    >
                      <Eye size={15} />
                      <span>Xem chi tiết</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Dialog Xử lý hoàn tiền */}
      {selected && (
        <RefundDialog
          refund={selected.refund}
          payoutDetails={selected.payoutDetails}
          onClose={() => setSelected(null)}
          onComplete={complete}
        />
      )}

      {/* Dialog Xem chi tiết đơn đã xử lý */}
      {viewDetail && (
        <DetailDialog refund={viewDetail} onClose={() => setViewDetail(null)} />
      )}
    </main>
  );
};

export default Refunds;
