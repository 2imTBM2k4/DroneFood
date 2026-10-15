import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Plane, RefreshCw, CheckCircle2, Clock, AlertTriangle, HelpCircle } from "lucide-react";
import { applicationLabels, applicationState } from "./droneDelivery.js";
import "./DroneDelivery.css";

const statusIcons = {
  approved: CheckCircle2,
  pending: Clock,
  rejected: AlertTriangle,
  not_registered: HelpCircle,
};

/** Manage the private drone delivery application for one authorized location. */
const LocationApplication = ({ branch, url, onRefresh }) => {
  const application = branch.droneDeliveryApplication || {};
  const state = applicationState(branch);
  const StatusIcon = statusIcons[state.status] || HelpCircle;
  const [form, setForm] = useState(() => ({
    address: application.address?.text || branch.address?.text || "",
    lat: application.address?.lat ?? branch.address?.lat ?? "",
    lng: application.address?.lng ?? branch.address?.lng ?? "",
    contactName: application.contactName || "",
    contactPhone: application.contactPhone || branch.phone || "",
    handoverNotes: application.handoverNotes || "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await axios.post(`${url}/api/branch/${branch._id}/drone-application`, {
        address: { text: form.address.trim(), lat: Number(form.lat), lng: Number(form.lng) },
        contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim(), handoverNotes: form.handoverNotes.trim(),
      }, { headers: headers() });
      setMessage(response.data.message);
      await onRefresh();
    } catch (cause) {
      setError(cause.response?.data?.message || "Không thể gửi hồ sơ. Vui lòng thử lại.");
      if (cause.response?.status === 409) await onRefresh();
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await axios.patch(`${url}/api/branch/${branch._id}/drone-delivery`, { enabled: !state.enabled }, { headers: headers() });
      setMessage(response.data.message);
      await onRefresh();
    } catch (cause) { setError(cause.response?.data?.message || "Không thể thay đổi dịch vụ."); }
    finally { setBusy(false); }
  };

  return <article className="drone-application-card" aria-busy={busy}>
    <header className="drone-card-header">
      <div>
        <h2>{branch.merchantId?.name ? `${branch.merchantId.name} · ` : ""}{branch.name}</h2>
        <p className="drone-card-meta">{branch.code} · {branch.address?.text || "Chưa có địa chỉ"}</p>
      </div>
      <span className={`drone-application-status drone-application-status--${state.status}`}>
        <StatusIcon size={14} />
        {applicationLabels[state.status]}
      </span>
    </header>

    {application.reviewReason && (
      <div className="drone-application-decision">
        <strong>Lý do xét duyệt:</strong> {application.reviewReason}
      </div>
    )}

    {error && <p className="drone-application-error" role="alert">{error}</p>}
    {message && <p className="drone-application-success" role="status">{message}</p>}

    {state.canSubmit ? (
      <form onSubmit={submit} className="drone-application-form">
        <label className="drone-application-wide">
          <span>Địa chỉ chi nhánh quán</span>
          <input name="address" value={form.address} onChange={change} required minLength={3} maxLength={255} disabled={busy} placeholder="Ví dụ: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1" />
        </label>
        <label>
          <span>Vĩ độ (Latitude)</span>
          <input name="lat" type="number" step="any" min="-90" max="90" value={form.lat} onChange={change} required disabled={busy} placeholder="Ví dụ: 10.7769" />
        </label>
        <label>
          <span>Kinh độ (Longitude)</span>
          <input name="lng" type="number" step="any" min="-180" max="180" value={form.lng} onChange={change} required disabled={busy} placeholder="Ví dụ: 106.7009" />
        </label>
        <label>
          <span>Người liên hệ giao nhận</span>
          <input name="contactName" value={form.contactName} onChange={change} required minLength={2} maxLength={100} disabled={busy} placeholder="Tên quản lý hoặc nhân viên phụ trách" />
        </label>
        <label>
          <span>Số điện thoại bàn giao</span>
          <input name="contactPhone" type="tel" value={form.contactPhone} onChange={change} required pattern="[0-9+\-\s()]{8,15}" maxLength={15} disabled={busy} placeholder="0901234567" />
        </label>
        <label className="drone-application-wide">
          <span>Mô tả vị trí bàn giao cho drone</span>
          <textarea name="handoverNotes" value={form.handoverNotes} onChange={change} required minLength={3} maxLength={1000} rows={3} disabled={busy} placeholder="Ví dụ: Sân thượng tòa nhà, bãi đỗ xe phía sau quán, gọi hotline trước 5 phút khi drone tới..." />
        </label>
        <div className="drone-form-actions">
          <button type="submit" className="drone-btn-primary" disabled={busy}>
            {busy ? "Đang gửi…" : state.status === "rejected" ? "Sửa và gửi lại hồ sơ" : "Gửi hồ sơ đăng ký"}
          </button>
        </div>
      </form>
    ) : (
      <>
        <dl className="drone-application-details">
          <div><dt>Địa chỉ trong hồ sơ</dt><dd>{application.address?.text || "—"}</dd></div>
          <div><dt>Tọa độ</dt><dd>{application.address?.lat ?? "—"}, {application.address?.lng ?? "—"}</dd></div>
          <div><dt>Người liên hệ</dt><dd>{application.contactName || "—"} · {application.contactPhone || "—"}</dd></div>
          <div><dt>Vị trí bàn giao</dt><dd>{application.handoverNotes || "—"}</dd></div>
        </dl>
        {state.status === "pending" && (
          <div className="drone-pending-notice">
            <Clock size={16} />
            <span>Hồ sơ đang chờ quản trị viên xét duyệt. Chưa thể bật giao hàng bằng drone.</span>
          </div>
        )}
        {state.canToggle && (
          <div className="drone-application-operation">
            <div>
              <strong>Trạng thái vận hành: <span className={state.enabled ? "text-success" : "text-muted"}>{state.enabled ? "Đang bật" : "Đang tắt"}</span></strong>
              <p>Kết quả duyệt được giữ nguyên khi tắt. Đơn hàng drone đã tiếp nhận không bị ảnh hưởng.</p>
            </div>
            <button
              type="button"
              className={`drone-toggle-btn ${state.enabled ? "drone-toggle-btn--active" : ""}`}
              disabled={busy}
              onClick={toggle}
            >
              {busy ? "Đang lưu…" : state.enabled ? "Tắt dịch vụ drone" : "Bật dịch vụ drone"}
            </button>
          </div>
        )}
      </>
    )}
  </article>;
};

const DroneDelivery = ({ url, embedded = false }) => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await axios.get(`${url}/api/branch/managed`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setBranches(response.data.data || []);
    } catch (cause) { setError(cause.response?.data?.message || "Không thể tải địa điểm thuộc quyền quản lý."); }
    finally { setLoading(false); }
  }, [url]);

  useEffect(() => { refresh(); }, [refresh]);

  return <section className={`drone-applications-page ${embedded ? "drone-applications-page--embedded" : ""}`}>
    <header className="drone-applications-heading">
      <div>
        <h1 className={embedded ? "profile-page-title" : ""}>
          <Plane size={24} /> Giao hàng bằng drone
        </h1>
        <p className="profile-sub-desc">
          Đăng ký hồ sơ giao hàng bằng drone cho từng địa điểm quán. Sau khi quản trị viên phê duyệt, bạn có thể chủ động bật/tắt dịch vụ.
        </p>
      </div>
      <button type="button" className="drone-refresh-btn" onClick={refresh} disabled={loading}>
        <RefreshCw size={15} className={loading ? "spin" : ""} /> Tải lại
      </button>
    </header>
    {loading && <p role="status" className="drone-loading-text">Đang tải địa điểm…</p>}
    {error && <p className="drone-application-error" role="alert">{error}</p>}
    {!loading && !error && branches.length === 0 && <p className="drone-empty-text">Bạn chưa có địa điểm thuộc quyền quản lý.</p>}
    {branches.map((branch) => (
      <LocationApplication
        key={`${branch._id}-${branch.droneDeliveryApplication?.submissionId || "new"}`}
        branch={branch}
        url={url}
        onRefresh={refresh}
      />
    ))}
  </section>;
};

export default DroneDelivery;
