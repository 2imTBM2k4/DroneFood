import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Pencil, Plus, Power, Ticket, X } from "lucide-react";
import "./Vouchers.css";

const emptyForm = () => ({
  code: "",
  kind: "percent",
  value: 10,
  appliesTo: "items_subtotal",
  minOrderAmount: 0,
  maxDiscountAmount: 50000,
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: "",
  totalQuota: 100,
  perUserQuota: 1,
  enabled: true,
});

const formatMoney = (amount) => new Intl.NumberFormat("vi-VN").format(amount || 0);
const formatDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "-");
const toLocalInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const VoucherForm = ({ form, setForm, onSubmit, onClose, saving, editing, error }) => {
  const setValue = (event) => {
    const { name, value, type, checked } = event.target;
    const numericFields = ["value", "minOrderAmount", "maxDiscountAmount", "totalQuota", "perUserQuota"];
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : numericFields.includes(name) ? Number(value) : value,
    }));
  };

  return createPortal(
    <div className="voucher-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="voucher-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="voucher-modal__header">
          <div>
            <p className="voucher-eyebrow">Khuyến mãi toàn nền tảng</p>
            <h2 id="voucher-dialog-title">{editing ? "Chỉnh sửa voucher" : "Tạo voucher mới"}</h2>
          </div>
          <button type="button" className="voucher-icon-button" onClick={onClose} aria-label="Đóng biểu mẫu voucher">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form className="voucher-form" onSubmit={onSubmit}>
          {error && <p className="voucher-form__error" role="alert">{error}</p>}

          <fieldset className="voucher-form__group">
            <legend>Thiết lập giảm giá</legend>
            <div className="voucher-form__grid">
              <label className="voucher-field voucher-field--wide">
                <span>Mã voucher <b aria-hidden="true">*</b></span>
                <input name="code" value={form.code} onChange={setValue} required minLength="3" maxLength="32" autoComplete="off" placeholder="VD: DRONEFOOD10" />
                <small>Chỉ dùng chữ in hoa, số, gạch nối hoặc gạch dưới.</small>
              </label>
              <label className="voucher-field">
                <span>Loại giảm <b aria-hidden="true">*</b></span>
                <select name="kind" value={form.kind} onChange={setValue}>
                  <option value="percent">Phần trăm</option>
                  <option value="fixed">Số tiền cố định</option>
                </select>
              </label>
              <label className="voucher-field">
                <span>Giá trị giảm <b aria-hidden="true">*</b></span>
                <input name="value" type="number" value={form.value} onChange={setValue} min="1" max={form.kind === "percent" ? "100" : undefined} required />
              </label>
              <label className="voucher-field">
                <span>Áp dụng vào <b aria-hidden="true">*</b></span>
                <select name="appliesTo" value={form.appliesTo} onChange={setValue}>
                  <option value="items_subtotal">Giá trị món ăn</option>
                  <option value="shipping_fee">Phí giao hàng</option>
                </select>
              </label>
              <label className="voucher-field">
                <span>Đơn tối thiểu (đ)</span>
                <input name="minOrderAmount" type="number" value={form.minOrderAmount} onChange={setValue} min="0" required />
              </label>
              <label className="voucher-field">
                <span>Mức giảm tối đa (đ) <b aria-hidden="true">*</b></span>
                <input name="maxDiscountAmount" type="number" value={form.maxDiscountAmount} onChange={setValue} min="1" required />
                <small>Bắt buộc để giới hạn mức giảm cho mỗi đơn.</small>
              </label>
            </div>
          </fieldset>

          <fieldset className="voucher-form__group">
            <legend>Thời gian và quota</legend>
            <div className="voucher-form__grid">
              <label className="voucher-field">
                <span>Bắt đầu <b aria-hidden="true">*</b></span>
                <input name="startsAt" type="datetime-local" value={form.startsAt} onChange={setValue} required />
              </label>
              <label className="voucher-field">
                <span>Kết thúc <b aria-hidden="true">*</b></span>
                <input name="endsAt" type="datetime-local" value={form.endsAt} onChange={setValue} required />
              </label>
              <label className="voucher-field">
                <span>Tổng lượt dùng <b aria-hidden="true">*</b></span>
                <input name="totalQuota" type="number" value={form.totalQuota} onChange={setValue} min="1" required />
              </label>
              <label className="voucher-field">
                <span>Lượt dùng mỗi khách <b aria-hidden="true">*</b></span>
                <input name="perUserQuota" type="number" value={form.perUserQuota} onChange={setValue} min="1" max={form.totalQuota || undefined} required />
              </label>
            </div>
          </fieldset>

          <label className="voucher-switch">
            <input name="enabled" type="checkbox" checked={form.enabled} onChange={setValue} />
            <span aria-hidden="true" />
            Kích hoạt ngay sau khi lưu
          </label>

          <footer className="voucher-form__actions">
            <button type="button" className="voucher-button voucher-button--secondary" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="voucher-button voucher-button--primary" disabled={saving}>
              {saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo voucher"}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
};

const Vouchers = ({ url }) => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const loadVouchers = useCallback(async () => {
    try {
      const response = await axios.get(`${url}/api/vouchers`, { headers: headers() });
      setVouchers(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách voucher.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { loadVouchers(); }, [loadVouchers]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (voucher) => {
    setEditing(voucher);
    setForm({
      ...voucher,
      startsAt: toLocalInputValue(voucher.startsAt),
      endsAt: toLocalInputValue(voucher.endsAt),
      maxDiscountAmount: voucher.maxDiscountAmount || "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      setFormError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }
    if (Number(form.perUserQuota) > Number(form.totalQuota)) {
      setFormError("Quota của mỗi khách không thể lớn hơn tổng quota.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      if (editing) {
        await axios.put(`${url}/api/vouchers/${editing.id}`, payload, { headers: headers() });
        toast.success("Đã cập nhật voucher.");
      } else {
        await axios.post(`${url}/api/vouchers`, payload, { headers: headers() });
        toast.success("Đã tạo voucher.");
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await loadVouchers();
    } catch (error) {
      setFormError(error.response?.data?.message || "Không thể lưu voucher. Hãy kiểm tra lại thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (voucher) => {
    const voucherId = voucher.id || voucher._id;
    try {
      await axios.patch(`${url}/api/vouchers/${voucherId}/enabled`, { enabled: !voucher.enabled }, { headers: headers() });
      setVouchers((current) => current.map((item) => ((item.id || item._id) === voucherId ? { ...item, enabled: !voucher.enabled } : item)));
      toast.success(voucher.enabled ? "Voucher đã được tắt." : "Voucher đã được bật.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể đổi trạng thái voucher.");
    }
  };

  if (loading) return <div className="voucher-loading">Đang tải voucher...</div>;

  return (
    <main className="voucher-page">
      <header className="voucher-page__header">
        <div>
          <p className="voucher-eyebrow"><Ticket size={15} aria-hidden="true" /> Khuyến mãi toàn nền tảng</p>
          <h1>Voucher</h1>
          <p className="voucher-page__description">Quản lý mức giảm, thời gian hiệu lực và quota dùng mã của khách hàng.</p>
        </div>
        <button className="voucher-button voucher-button--primary" onClick={openCreate}>
          <Plus size={18} aria-hidden="true" /> Tạo voucher
        </button>
      </header>

      {vouchers.length === 0 ? (
        <section className="voucher-empty">
          <Ticket size={32} aria-hidden="true" />
          <h2>Chưa có voucher nào</h2>
          <p>Tạo voucher đầu tiên để áp dụng cho toàn bộ nhà hàng trên nền tảng.</p>
          <button className="voucher-button voucher-button--primary" onClick={openCreate}><Plus size={18} aria-hidden="true" /> Tạo voucher</button>
        </section>
      ) : (
        <section className="voucher-table-card" aria-label="Danh sách voucher">
          <div className="voucher-table-wrap">
            <table className="voucher-table">
              <thead><tr><th>Mã & phạm vi</th><th>Giảm giá</th><th>Hiệu lực</th><th>Quota</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const percentage = voucher.kind === "percent";
                  return <tr key={voucher.id || voucher._id}>
                    <td data-label="Mã & phạm vi"><strong className="voucher-code">{voucher.code}</strong><span className="voucher-subtext">{voucher.appliesTo === "shipping_fee" ? "Phí giao hàng" : "Giá trị món ăn"}</span></td>
                    <td data-label="Giảm giá"><strong>{percentage ? `${voucher.value}%` : `${formatMoney(voucher.value)}đ`}</strong><span className="voucher-subtext">Tối đa {formatMoney(voucher.maxDiscountAmount)}đ</span></td>
                    <td data-label="Hiệu lực"><span>{formatDate(voucher.startsAt)}</span><span className="voucher-subtext">đến {formatDate(voucher.endsAt)}</span></td>
                    <td data-label="Quota"><strong>{voucher.usageCount}/{voucher.totalQuota}</strong><span className="voucher-subtext">{voucher.perUserQuota} lượt/khách</span></td>
                    <td data-label="Trạng thái"><span className={`voucher-status ${voucher.enabled ? "voucher-status--on" : "voucher-status--off"}`}>{voucher.enabled ? "Đang bật" : "Đã tắt"}</span></td>
                    <td className="voucher-table__actions" data-label="Thao tác">
                      <button className="voucher-action" onClick={() => openEdit(voucher)} aria-label={`Sửa voucher ${voucher.code}`}><Pencil size={17} aria-hidden="true" /></button>
                      <button className="voucher-action" onClick={() => toggleEnabled(voucher)} aria-label={`${voucher.enabled ? "Tắt" : "Bật"} voucher ${voucher.code}`} aria-pressed={voucher.enabled}><Power size={17} aria-hidden="true" /></button>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {modalOpen && <VoucherForm form={form} setForm={setForm} onSubmit={submit} onClose={closeModal} saving={saving} editing={editing} error={formError} />}
    </main>
  );
};

export default Vouchers;
