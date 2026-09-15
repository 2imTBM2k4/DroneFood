import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowRight, HandCoins, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "react-toastify";
import "./Finance.css";

const money = (value) => `${new Intl.NumberFormat("vi-VN").format(value || 0)}đ`;
const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "-";
const maskAccount = (value = "") => value.length > 4 ? `•••• ${value.slice(-4)}` : value;

const Finance = ({ url }) => {
  const [refunds, setRefunds] = useState([]); const [withdrawals, setWithdrawals] = useState([]); const [loading, setLoading] = useState(true); const [tab, setTab] = useState("pending");
  const navigate = useNavigate(); const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => { try { setLoading(true); const [refundRes, withdrawalRes] = await Promise.all([axios.get(`${url}/api/refunds`, { headers: headers() }), axios.get(`${url}/api/withdrawals/admin`, { headers: headers() })]); setRefunds(refundRes.data.data || []); setWithdrawals(withdrawalRes.data.data || []); } catch (error) { toast.error(error.response?.data?.message || "Không thể tải quản lý tài chính."); } finally { setLoading(false); } }, [url]);
  useEffect(() => { load(); }, [load]);
  const entries = useMemo(() => [
    ...refunds.map((refund) => ({ id: `refund-${refund._id}`, type: "refund", status: refund.status, amount: refund.amount, createdAt: refund.createdAt, subject: refund.customer?.name || "Khách hàng", detail: `Đơn #${refund.order?._id?.slice(-8).toUpperCase() || "-"}`, bank: `${refund.bank?.bankName || "-"} · ${maskAccount(refund.bank?.accountNumber)}` })),
    ...withdrawals.map((withdrawal) => ({ id: `withdrawal-${withdrawal._id}`, type: "withdrawal", status: withdrawal.status, amount: withdrawal.amount, createdAt: withdrawal.createdAt, subject: withdrawal.actorType === "shipper" ? "Shipper" : "Nhà hàng", detail: `Yêu cầu #${withdrawal._id.slice(-8).toUpperCase()}`, bank: withdrawal.bankTransactionReference ? `Mã GD: ${withdrawal.bankTransactionReference}` : "Chưa có mã giao dịch" })),
  ].filter((entry) => tab === "pending" ? (entry.type === "refund" ? entry.status === "requested" : ["pending", "approved"].includes(entry.status)) : ["paid", "rejected"].includes(entry.status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [refunds, tab, withdrawals]);
  return <main className="finance-page"><header><div><p className="finance-kicker"><HandCoins size={15} /> Financial operations</p><h1>Quản lý tài chính</h1><p>Yêu cầu cần xử lý được ưu tiên trước, sau đó là lịch sử quyết định.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button></header><div className="finance-tabs" role="tablist" aria-label="Financial request state"><button type="button" role="tab" aria-selected={tab === "pending"} className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}>Cần xử lý</button><button type="button" role="tab" aria-selected={tab === "history"} className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Lịch sử</button></div>{loading ? <p className="finance-state">Đang tải…</p> : entries.length === 0 ? <section className="finance-empty"><HandCoins size={30} /><h2>Không có yêu cầu</h2><p>{tab === "pending" ? "Không có refund hoặc withdrawal cần xử lý." : "Chưa có lịch sử tài chính."}</p></section> : <section className="finance-list">{entries.map((entry) => <article key={entry.id} className="finance-card"><div className={`finance-type finance-type--${entry.type}`}>{entry.type === "refund" ? <RotateCcw size={16} /> : <HandCoins size={16} />}<span>{entry.type === "refund" ? "Hoàn tiền" : "Rút tiền"}</span></div><div><strong>{entry.subject}</strong><span>{entry.detail} · {date(entry.createdAt)}</span></div><div><strong>{money(entry.amount)}</strong><span>{entry.bank}</span></div><span className={`finance-status finance-status--${entry.status}`}>{entry.status === "requested" ? "Chờ duyệt" : entry.status === "pending" ? "Chờ duyệt" : entry.status === "approved" ? "Đã duyệt" : entry.status === "paid" ? "Đã trả" : "Từ chối"}</span><button type="button" onClick={() => navigate(entry.type === "refund" ? "/refunds" : "/withdrawals")}>Xử lý <ArrowRight size={15} /></button></article>)}</section>}</main>;
};
export default Finance;
