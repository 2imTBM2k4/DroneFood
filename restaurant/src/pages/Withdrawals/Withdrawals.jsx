import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { HandCoins, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import "./Withdrawals.css";
import { formatVND } from "../../../../shared/utils/money";

const statusLabel = { pending: "Chờ duyệt", approved: "Đã duyệt", paid: "Đã thanh toán", rejected: "Đã từ chối" };

const Withdrawals = ({ url }) => {
  const [amount, setAmount] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => {
    try { setLoading(true); const response = await axios.get(`${url}/api/restaurant-withdrawals`, { headers: headers() }); setRequests(response.data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể tải yêu cầu rút tiền."); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(value) || value < 500000) return toast.error("Mỗi lần rút tối thiểu 500.000đ.");
    setSaving(true);
    try { await axios.post(`${url}/api/restaurant-withdrawals`, { amount: value }, { headers: headers() }); setAmount(""); toast.success("Đã gửi yêu cầu rút tiền. Số tiền được giữ chỗ đến khi admin xử lý."); await load(); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể gửi yêu cầu rút tiền."); }
    finally { setSaving(false); }
  };
  return <main className="restaurant-withdrawals"><header><div><p className="restaurant-withdrawals__kicker"><HandCoins size={15} /> Ví nhà hàng</p><h1>Rút tiền</h1><p>Yêu cầu được giữ chỗ trước, chỉ trừ số dư khi admin xác nhận đã chuyển khoản.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button></header><section className="restaurant-withdrawals__form"><h2>Tạo yêu cầu</h2><form onSubmit={submit}><label>Số tiền rút<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="Tối thiểu 500.000đ" /></label><button type="submit" disabled={saving}>{saving ? "Đang gửi..." : "Gửi yêu cầu"}</button></form></section><section className="restaurant-withdrawals__history"><h2>Lịch sử yêu cầu</h2>{loading ? <p>Đang tải...</p> : requests.length === 0 ? <p>Chưa có yêu cầu rút tiền.</p> : <div>{requests.map((request) => <article key={request._id}><div><strong>{formatVND(request.amount)}</strong><span>{new Date(request.createdAt).toLocaleString("vi-VN")}</span></div><span className={`restaurant-withdrawal-status restaurant-withdrawal-status--${request.status}`}>{statusLabel[request.status]}</span>{request.status === "paid" && <small>Mã GD: {request.bankTransactionReference}</small>}{request.status === "rejected" && <small>{request.rejectionReason || "Số tiền giữ chỗ đã được giải phóng."}</small>}</article>)}</div>}</section></main>;
};

export default Withdrawals;
