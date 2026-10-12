import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { HandCoins, Landmark, RefreshCw, WalletCards } from "lucide-react";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { AuthContext } from "../../context/AuthContext";
import { formatVND } from "@drone-food/web-ui/utils/money";
import "./Withdrawals.css";

const statusLabel = { pending: "Chờ duyệt", approved: "Đã duyệt", paid: "Đã trả", rejected: "Từ chối" };
const Withdrawals = ({ url }) => {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState([]); const [transactions, setTransactions] = useState([]); const [amount, setAmount] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState({ bankName: "", accountHolder: "", accountNumber: "" }); const [bankMasked, setBankMasked] = useState(""); const [bankSaving, setBankSaving] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [withdrawals, account, ledger, balanceRes] = await Promise.all([
        axios.get(`${url}/api/restaurant-withdrawals`, { headers: headers() }),
        axios.get(`${url}/api/restaurant/me/bank-account`, { headers: headers() }),
        axios.get(`${url}/api/restaurant-withdrawals/transactions`, { headers: headers() }),
        axios.get(`${url}/api/restaurant-withdrawals/balance`, { headers: headers() }).catch(() => null),
      ]);
      setRequests(withdrawals.data.data || []);
      setTransactions(ledger.data.data || []);
      if (balanceRes?.data?.data?.balance !== undefined) {
        setWalletBalance(balanceRes.data.data.balance);
      }
      setBank((current) => ({
        ...current,
        bankName: account.data.data?.bankName || "",
        accountHolder: account.data.data?.accountHolder || "",
      }));
      setBankMasked(account.data.data?.accountNumberMasked || "");
    } catch (error) {
      notificationService.error(
        "Không thể tải ví nhà hàng",
        error.response?.data?.message || "Vui lòng kiểm tra kết nối mạng và thử lại.",
        {
          audience: "restaurant",
          priority: "high",
          key: "restaurant-wallet-load",
          actions: [{ label: "Thử lại", onClick: load }],
        }
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const submitWithdrawal = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      notificationService.warning(
        "Số tiền rút không hợp lệ",
        "Vui lòng nhập số tiền rút hợp lệ là số nguyên dương.",
        { audience: "restaurant", key: "restaurant-withdrawal-amount-invalid" }
      );
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${url}/api/restaurant-withdrawals`, { amount: value }, { headers: headers() });
      setAmount("");
      notificationService.success("Đã gửi yêu cầu rút tiền", "Số dư chỉ bị trừ sau khi chuyển khoản được xác nhận.", { audience: "restaurant" });
      await load();
    } catch (error) {
      notificationService.error(
        "Không thể tạo yêu cầu rút tiền",
        error.response?.data?.message || "Vui lòng kiểm tra lại số dư khả dụng và thử lại.",
        { audience: "restaurant", priority: "high", key: "restaurant-withdrawal-create-error" }
      );
    } finally {
      setSaving(false);
    }
  };

  const submitBank = async (event) => {
    event.preventDefault();
    if (!bank.bankName.trim() || !bank.accountHolder.trim() || !bank.accountNumber.trim()) {
      notificationService.warning(
        "Thiếu thông tin ngân hàng",
        "Vui lòng nhập đầy đủ tên ngân hàng, chủ tài khoản và số tài khoản.",
        { audience: "restaurant", key: "restaurant-bank-incomplete" }
      );
      return;
    }
    setBankSaving(true);
    try {
      const response = await axios.put(`${url}/api/restaurant/me/bank-account`, bank, { headers: headers() });
      setBankMasked(response.data.data?.accountNumberMasked || "");
      setBank((current) => ({ ...current, accountNumber: "" }));
      notificationService.success("Đã lưu tài khoản ngân hàng", undefined, { audience: "restaurant" });
    } catch (error) {
      notificationService.error(
        "Không thể lưu tài khoản ngân hàng",
        error.response?.data?.message || "Vui lòng thử lại sau.",
        { audience: "restaurant", priority: "high", key: "restaurant-bank-save-error" }
      );
    } finally {
      setBankSaving(false);
    }
  };
  const reserved = requests.filter((request) => ["pending", "approved"].includes(request.status)).reduce((sum, request) => sum + (request.reservedAmount || request.amount || 0), 0); const balance = walletBalance !== null ? walletBalance : (user?.walletBalance || 0);
  return <main className="restaurant-withdrawals"><header><div><p className="restaurant-withdrawals__kicker"><WalletCards size={15} /> Ví nhà hàng</p><h1>Wallet</h1><p>Quản lý số dư, tài khoản nhận tiền và yêu cầu rút tiền.</p></div><button type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button></header><section className="restaurant-wallet-stats" aria-label="Wallet balance"><article><span>Số dư</span><strong>{formatVND(balance)}</strong></article><article><span>Đang giữ chỗ</span><strong>{formatVND(reserved)}</strong></article><article><span>Có thể rút</span><strong>{formatVND(Math.max(0, balance - reserved))}</strong></article></section><div className="restaurant-wallet-grid"><section className="restaurant-withdrawals__form"><h2><HandCoins size={18} /> Rút tiền</h2><p>Yêu cầu được giữ chỗ trước, chỉ trừ số dư khi admin xác nhận đã chuyển khoản.</p><form onSubmit={submitWithdrawal}><label>Số tiền rút<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="Tối thiểu 500.000đ" /></label><button type="submit" disabled={saving}>{saving ? "Đang gửi..." : "Gửi yêu cầu"}</button></form></section><section className="restaurant-withdrawals__form"><h2><Landmark size={18} /> Tài khoản nhận tiền</h2>{bankMasked && <p>Tài khoản hiện tại: {bankMasked}</p>}<form onSubmit={submitBank}><label>Ngân hàng<input required value={bank.bankName} onChange={(event) => setBank((current) => ({ ...current, bankName: event.target.value }))} /></label><label>Chủ tài khoản<input required value={bank.accountHolder} onChange={(event) => setBank((current) => ({ ...current, accountHolder: event.target.value }))} /></label><label>Số tài khoản {bankMasked ? "mới" : ""}<input required value={bank.accountNumber} onChange={(event) => setBank((current) => ({ ...current, accountNumber: event.target.value }))} inputMode="numeric" /></label><button type="submit" disabled={bankSaving}>{bankSaving ? "Đang lưu..." : "Lưu tài khoản"}</button></form></section></div><section className="restaurant-withdrawals__history"><h2>Lịch sử giao dịch</h2>{loading ? <p>Đang tải...</p> : transactions.length === 0 ? <p>Chưa có giao dịch đã hạch toán.</p> : <div>{transactions.map((transaction) => <article key={transaction._id}><div><strong>{transaction.amount >= 0 ? "+" : ""}{formatVND(transaction.amount)}</strong><span>{new Date(transaction.createdAt).toLocaleString("vi-VN")}</span></div><span>{transaction.transactionType.replaceAll("_", " ")}</span></article>)}</div>}</section><section className="restaurant-withdrawals__history"><h2>Lịch sử yêu cầu rút tiền</h2>{loading ? <p>Đang tải...</p> : requests.length === 0 ? <p>Chưa có yêu cầu rút tiền.</p> : <div>{requests.map((request) => <article key={request._id}><div><strong>{formatVND(request.amount)}</strong><span>{new Date(request.createdAt).toLocaleString("vi-VN")}</span></div><span className={`restaurant-withdrawal-status restaurant-withdrawal-status--${request.status}`}>{statusLabel[request.status] || request.status}</span>{request.status === "paid" && <small>Mã GD: {request.bankTransactionReference}</small>}{request.status === "rejected" && <small>{request.rejectionReason || "Số tiền giữ chỗ đã được giải phóng."}</small>}</article>)}</div>}</section></main>;
};
export default Withdrawals;
