import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Eye, HandCoins, X } from "lucide-react";
import { toast } from "react-toastify";
import "./Refunds.css";

const money = (value) => new Intl.NumberFormat("vi-VN").format(value || 0);
const date = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

const RefundDialog = ({ refund, onClose, onComplete }) => {
  const [mode, setMode] = useState("paid");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (mode === "paid" && !reference.trim()) return;
    if (mode === "rejected" && !note.trim()) return;
    setSaving(true);
    try {
      await onComplete(refund._id, mode, { transferReference: reference.trim(), adminNote: note.trim() });
      onClose();
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="refund-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <section className="refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="refund-kicker">Hoàn tiền thủ công</p><h2 id="refund-dialog-title">Yêu cầu #{refund._id.slice(-8).toUpperCase()}</h2></div><button type="button" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
        <div className="refund-dialog__details">
          <p><span>Khách hàng</span><strong>{refund.customer?.name || "-"}</strong></p>
          <p><span>Số tiền</span><strong>{money(refund.amount)}đ</strong></p>
          <p><span>Ngân hàng</span><strong>{refund.bank.bankName}</strong></p>
          <p><span>Số tài khoản</span><strong>{refund.bank.accountNumber}</strong></p>
          <p><span>Chủ tài khoản</span><strong>{refund.bank.accountHolder}</strong></p>
          <p><span>Lý do</span><strong>{refund.reason}</strong></p>
        </div>
        <form onSubmit={submit}>
          <label className="refund-choice"><input type="radio" name="refund-action" checked={mode === "paid"} onChange={() => setMode("paid")} /> Đã chuyển tiền</label>
          {mode === "paid" && <label className="refund-field">Mã giao dịch <input value={reference} onChange={(event) => setReference(event.target.value)} required /></label>}
          <label className="refund-choice"><input type="radio" name="refund-action" checked={mode === "rejected"} onChange={() => setMode("rejected")} /> Từ chối yêu cầu</label>
          <label className="refund-field">Ghi chú {mode === "rejected" ? "(bắt buộc)" : "(tuỳ chọn)"}<textarea value={note} onChange={(event) => setNote(event.target.value)} required={mode === "rejected"} rows="3" /></label>
          <footer><button type="button" onClick={onClose} disabled={saving}>Hủy</button><button type="submit" disabled={saving}>{saving ? "Đang lưu..." : mode === "paid" ? "Xác nhận đã hoàn" : "Từ chối"}</button></footer>
        </form>
      </section>
    </div>, document.body
  );
};

const Refunds = ({ url }) => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => {
    try { const response = await axios.get(`${url}/api/refunds?status=requested`, { headers: headers() }); setRefunds(response.data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể tải yêu cầu hoàn tiền."); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  const complete = async (id, mode, payload) => {
    try {
      await axios.post(`${url}/api/refunds/${id}/${mode === "paid" ? "mark-paid" : "reject"}`, mode === "paid" ? payload : { adminNote: payload.adminNote }, { headers: headers() });
      toast.success(mode === "paid" ? "Đã ghi nhận hoàn tiền." : "Đã từ chối yêu cầu hoàn tiền.");
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Không thể cập nhật yêu cầu hoàn tiền."); throw error; }
  };
  if (loading) return <div className="refund-page"><p>Đang tải yêu cầu hoàn tiền...</p></div>;
  return <main className="refund-page"><header className="refund-page__header"><div><p className="refund-kicker"><HandCoins size={15} /> Hoàn tiền</p><h1>Yêu cầu hoàn tiền</h1><p>Chỉ xác nhận sau khi đã kiểm tra và chuyển tiền cho khách.</p></div></header>
    {refunds.length === 0 ? <section className="refund-empty"><HandCoins size={32} /><h2>Không có yêu cầu chờ xử lý</h2><p>Các yêu cầu hoàn tiền PayOS mới sẽ hiển thị ở đây.</p></section> : <section className="refund-list">{refunds.map((refund) => <article key={refund._id} className="refund-card"><div><strong>#{refund.order?._id?.slice(-8).toUpperCase()}</strong><span>{refund.customer?.name} · {date(refund.createdAt)}</span></div><div><strong>{money(refund.amount)}đ</strong><span>{refund.bank.bankName} · {refund.bank.accountNumber}</span></div><button onClick={() => setSelected(refund)}><Eye size={17} /> Xử lý</button></article>)}</section>}
    {selected && <RefundDialog refund={selected} onClose={() => setSelected(null)} onComplete={complete} />}
  </main>;
};

export default Refunds;
