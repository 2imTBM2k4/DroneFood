import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Check, RefreshCw, Search, X } from "lucide-react";
import "./Shippers.css";

const approvalLabel = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const Shippers = ({ url }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/shippers`, { headers: headers() });
      setProfiles(response.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách Shipper");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const approve = async (profile, approvalStatus) => {
    try {
      setSavingId(profile._id);
      await axios.put(`${url}/api/shippers/${profile.user._id}/approval`, { approvalStatus }, { headers: headers() });
      toast.success(approvalStatus === "approved" ? "Đã duyệt Shipper" : "Đã từ chối Shipper");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể cập nhật trạng thái Shipper");
    } finally {
      setSavingId("");
    }
  };

  const visible = useMemo(() => profiles.filter((profile) => {
    const text = `${profile.user?.name || ""} ${profile.user?.email || ""} ${profile.user?.phone || ""}`.toLowerCase();
    return (filter === "all" || profile.approvalStatus === filter) && text.includes(query.trim().toLowerCase());
  }), [profiles, filter, query]);

  const counts = profiles.reduce((result, profile) => ({ ...result, [profile.approvalStatus]: (result[profile.approvalStatus] || 0) + 1 }), {});

  return <section className="shipper-page">
    <header className="shipper-page-head">
      <div><p className="shipper-eyebrow">Delivery operations</p><h1>Shippers</h1><p>Duyệt tài khoản trước khi họ có thể chia sẻ GPS và nhận đơn trong bán kính 3 km.</p></div>
      <button type="button" className="shipper-refresh" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button>
    </header>
    <div className="shipper-toolbar">
      <label className="shipper-search"><Search size={17} /><span className="sr-only">Tìm Shipper</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại" /></label>
      <div className="shipper-filters" role="tablist" aria-label="Lọc trạng thái duyệt">{["pending", "approved", "rejected", "all"].map((status) => <button key={status} type="button" role="tab" aria-selected={filter === status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "all" ? "Tất cả" : approvalLabel[status]} <span>{status === "all" ? profiles.length : counts[status] || 0}</span></button>)}</div>
    </div>
    {loading ? <p className="shipper-state">Đang tải Shipper...</p> : visible.length === 0 ? <p className="shipper-state">Không có Shipper phù hợp.</p> : <div className="shipper-table-wrap"><table className="shipper-table"><thead><tr><th>Shipper</th><th>Phương tiện</th><th>Trạng thái</th><th>GPS gần nhất</th><th>Đơn hiện tại</th><th>Thao tác</th></tr></thead><tbody>{visible.map((profile) => <tr key={profile._id}><td><strong>{profile.user?.name || "Không rõ"}</strong><span>{profile.user?.email}</span><span>{profile.user?.phone || "Chưa có số điện thoại"}</span></td><td>{profile.vehicleType === "motorbike" ? "Xe máy" : profile.vehicleType === "bicycle" ? "Xe đạp" : "Ô tô"}</td><td><span className={`approval approval--${profile.approvalStatus}`}>{approvalLabel[profile.approvalStatus]}</span><small>{profile.status}</small></td><td>{profile.locationUpdatedAt ? new Date(profile.locationUpdatedAt).toLocaleString("vi-VN") : "Chưa gửi vị trí"}</td><td>{profile.currentOrder ? `#${profile.currentOrder._id?.slice(-6).toUpperCase() || ""} · ${profile.currentOrder.orderStatus}` : "Không có"}</td><td>{profile.approvalStatus === "pending" ? <div className="shipper-actions"><button type="button" className="approve" disabled={savingId === profile._id} onClick={() => approve(profile, "approved")}><Check size={15} /> Duyệt</button><button type="button" className="reject" disabled={savingId === profile._id} onClick={() => approve(profile, "rejected")}><X size={15} /> Từ chối</button></div> : <button type="button" className="review" disabled={savingId === profile._id} onClick={() => approve(profile, profile.approvalStatus === "approved" ? "rejected" : "approved")}>{profile.approvalStatus === "approved" ? "Thu hồi duyệt" : "Duyệt lại"}</button>}</td></tr>)}</tbody></table></div>}
  </section>;
};

export default Shippers;
