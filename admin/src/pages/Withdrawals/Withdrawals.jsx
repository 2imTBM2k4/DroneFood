import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Check, HandCoins, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import "./Withdrawals.css";

const money = (value) => `${new Intl.NumberFormat("vi-VN").format(value || 0)}đ`;
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "-";
const statusLabel = { pending: "Chờ duyệt", approved: "Đã duyệt", paid: "Đã thanh toán", rejected: "Đã từ chối" };

const Withdrawals = ({ url }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [references, setReferences] = useState({});
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => {
    try { setLoading(true); const response = await axios.get(`${url}/api/withdrawals/admin`, { headers: headers() }); setRequests(response.data.data || []); }
    catch (error) { toast.error(error.response?.data?.message || "Không thể tải yêu cầu rút tiền."); }
    finally { setLoading(false); }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const act = async (request, action) => {
    const reference = references[request._id]?.trim();
    if (action === "paid" && !reference) return toast.error("Cần nhập mã giao dịch ngân hàng trước khi xác nhận đã chuyển tiền.");
    if (action === "rejected" && !window.confirm(`Từ chối yêu cầu rút ${money(request.amount)}? Số tiền giữ chỗ sẽ được giải phóng.`)) return;
    try {
      setSavingId(request._id);
      await axios.post(`${url}/api/withdrawals/${request._id}/${action}`, action === "paid" ? { bankTransactionReference: reference } : {}, { headers: headers() });
      toast.success(action === "approved" ? "Đã duyệt yêu cầu." : action === "paid" ? "Đã ghi nhận chuyển khoản và trừ ví." : "Đã từ chối, số tiền giữ chỗ đã được giải phóng.");
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Không thể cập nhật yêu cầu rút tiền."); }
    finally { setSavingId(""); }
  };

  if (loading) return <main className="withdrawal-page"><p>Đang tải yêu cầu rút tiền...</p></main>;
  return <main className="withdrawal-page"><header className="withdrawal-page__header"><div><p className="withdrawal-kicker"><HandCoins size={15} /> Thanh toán thủ công</p><h1>Yêu cầu rút tiền</h1><p>Chỉ đánh dấu “Đã thanh toán” sau khi đã chuyển khoản và có mã giao dịch ngân hàng.</p></div><button type="button" onClick={load}><RefreshCw size={16} /> Làm mới</button></header>
    {requests.length === 0 ? <section className="withdrawal-empty"><HandCoins size={32} /><h2>Chưa có yêu cầu rút tiền</h2><p>Yêu cầu từ nhà hàng và shipper sẽ xuất hiện tại đây.</p></section> : <section className="withdrawal-list">{requests.map((request) => <article key={request._id} className="withdrawal-card"><div className="withdrawal-card__identity"><strong>{request.actorType === "shipper" ? "Shipper" : "Nhà hàng"} · #{request._id.slice(-8).toUpperCase()}</strong><span>{date(request.createdAt)}</span></div><div><strong>{money(request.amount)}</strong><span className={`withdrawal-status withdrawal-status--${request.status}`}>{statusLabel[request.status]}</span></div><div className="withdrawal-card__actions">{request.status === "pending" && <><button type="button" className="withdrawal-approve" disabled={savingId === request._id} onClick={() => act(request, "approve")}><Check size={16} /> Duyệt</button><button type="button" className="withdrawal-reject" disabled={savingId === request._id} onClick={() => act(request, "reject")}><X size={16} /> Từ chối</button></>}{request.status === "approved" && <><label><span className="sr-only">Mã giao dịch ngân hàng</span><input value={references[request._id] || ""} onChange={(event) => setReferences((current) => ({ ...current, [request._id]: event.target.value }))} placeholder="Mã giao dịch ngân hàng" /></label><button type="button" className="withdrawal-paid" disabled={savingId === request._id} onClick={() => act(request, "paid")}>Xác nhận đã chuyển</button><button type="button" className="withdrawal-reject" disabled={savingId === request._id} onClick={() => act(request, "reject")}><X size={16} /><span className="sr-only">Từ chối</span></button></>}{request.status === "paid" && <span>Mã GD: {request.bankTransactionReference}</span>}{request.status === "rejected" && <span>{request.rejectionReason || "Đã giải phóng tiền giữ chỗ"}</span>}</div></article>)}</section>}
  </main>;
};

export default Withdrawals;
