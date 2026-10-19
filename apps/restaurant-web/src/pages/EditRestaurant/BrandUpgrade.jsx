import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  ArrowRight,
  ShieldCheck,
  FileText,
  Store,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./BrandUpgrade.css";

const BrandUpgrade = ({ url = import.meta.env.VITE_API_URL || "http://localhost:4000", onUpgradeSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appData, setAppData] = useState(null);

  const [form, setForm] = useState({
    brandName: "",
    taxCode: "",
    representativeName: "",
    phone: "",
    licenseImages: "",
    notes: "",
  });

  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${url}/api/merchant/brand-application`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data.success) {
        setAppData(res.data.data);
        const app = res.data.data?.brandApplication;
        if (app && app.status !== "not_registered") {
          setForm({
            brandName: app.brandName || "",
            taxCode: app.taxCode || "",
            representativeName: app.representativeName || "",
            phone: app.phone || "",
            licenseImages: Array.isArray(app.licenseImages) ? app.licenseImages.join(", ") : "",
            notes: app.notes || "",
          });
        }
      }
    } catch (err) {
      console.error("Fetch brand application error:", err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.brandName.trim() || !form.representativeName.trim() || !form.phone.trim()) {
      notificationService.warning(
        "Thiếu thông tin",
        "Vui lòng điền đầy đủ Tên thương hiệu, Người đại diện và Số điện thoại.",
        { audience: "restaurant" }
      );
      return;
    }

    try {
      setSubmitting(true);
      const imageList = form.licenseImages
        ? form.licenseImages.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        brandName: form.brandName.trim(),
        taxCode: form.taxCode.trim(),
        representativeName: form.representativeName.trim(),
        phone: form.phone.trim(),
        licenseImages: imageList,
        notes: form.notes.trim(),
      };

      const res = await axios.post(`${url}/api/merchant/brand-application`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (res.data.success) {
        notificationService.success(
          "Nộp hồ sơ thành công!",
          "Hồ sơ nâng cấp chuỗi thương hiệu đã được gửi tới Quản trị viên để xét duyệt.",
          { audience: "restaurant" }
        );
        await fetchApplication();
        if (onUpgradeSuccess) onUpgradeSuccess();
      } else {
        notificationService.error(
          "Không thể gửi hồ sơ",
          res.data.message || "Vui lòng kiểm tra lại thông tin.",
          { audience: "restaurant" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Lỗi gửi hồ sơ",
        err.response?.data?.message || err.message || "Không thể kết nối đến máy chủ.",
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "260px" }}>
        <Loader2 size={32} className="spin" color="#3b82f6" />
      </div>
    );
  }

  const isBrand = appData?.type === "brand" || appData?.brandApplication?.status === "approved";
  const appStatus = appData?.brandApplication?.status || "not_registered";

  return (
    <div className="brand-upgrade-container">
      {/* TRẠNG THÁI 1: ĐÃ LÀ CHUỖI THƯƠNG HIỆU */}
      {isBrand && (
        <div className="brand-success-card">
          <div className="brand-success-header">
            <div className="brand-success-icon">
              <ShieldCheck size={28} />
            </div>
            <div className="brand-success-text">
              <h3>Chuỗi thương hiệu đa chi nhánh</h3>
              <p>Tài khoản của bạn đã được nâng cấp lên Chủ thương hiệu (Brand Owner).</p>
            </div>
          </div>

          <div className="brand-details-grid" style={{ marginTop: 12 }}>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Tên thương hiệu chuỗi</span>
              <span className="brand-detail-value">{appData?.name || appData?.brandApplication?.brandName}</span>
            </div>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Mô hình hoạt động</span>
              <span className="brand-detail-value" style={{ color: "#16a34a" }}>Đa chi nhánh tập trung</span>
            </div>
          </div>

          <div className="brand-perks-list">
            <div className="brand-perk-item">
              <CheckCircle2 size={18} />
              <span>Toàn quyền quản lý và cập nhật Menu gốc của thương hiệu trên toàn hệ thống.</span>
            </div>
            <div className="brand-perk-item">
              <CheckCircle2 size={18} />
              <span>Mở thêm nhiều chi nhánh con và phân quyền quản lý cho từng chi nhánh.</span>
            </div>
            <div className="brand-perk-item">
              <CheckCircle2 size={18} />
              <span>Quản trị doanh thu và giám sát vận hành drone delivery của toàn bộ chuỗi.</span>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="brand-btn-submit"
              onClick={() => navigate("/branches")}
              style={{ backgroundColor: "#15803d" }}
            >
              <span>Quản lý danh sách chi nhánh</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* TRẠNG THÁI 2: ĐANG CHỜ ADMIN DUYỆT (PENDING) */}
      {!isBrand && appStatus === "pending" && (
        <div className="brand-status-card">
          <div className="brand-status-header">
            <h3 className="brand-status-title">
              <Building2 size={22} color="#d97706" />
              <span>Hồ sơ nâng cấp chuỗi thương hiệu</span>
            </h3>
            <span className="brand-upgrade-badge pending">
              <Clock size={14} />
              <span>Đang chờ Admin duyệt</span>
            </span>
          </div>

          <p style={{ color: "#475569", fontSize: "0.92rem", marginBottom: 20 }}>
            Hồ sơ đăng ký nâng cấp quán cá nhân lên chuỗi thương hiệu đa chi nhánh của bạn đang được ban quản trị xét duyệt.
          </p>

          <div className="brand-details-grid">
            <div className="brand-detail-item">
              <span className="brand-detail-label">Tên chuỗi đề xuất</span>
              <span className="brand-detail-value">{appData?.brandApplication?.brandName || "—"}</span>
            </div>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Mã số thuế</span>
              <span className="brand-detail-value">{appData?.brandApplication?.taxCode || "—"}</span>
            </div>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Người đại diện pháp luật</span>
              <span className="brand-detail-value">{appData?.brandApplication?.representativeName || "—"}</span>
            </div>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Số điện thoại liên hệ</span>
              <span className="brand-detail-value">{appData?.brandApplication?.phone || "—"}</span>
            </div>
            <div className="brand-detail-item">
              <span className="brand-detail-label">Ngày nộp hồ sơ</span>
              <span className="brand-detail-value">
                {appData?.brandApplication?.submittedAt
                  ? new Date(appData.brandApplication.submittedAt).toLocaleDateString("vi-VN")
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TRẠNG THÁI 3: CHƯA NỘP HOẶC BỊ TỪ CHỐI (CẦN GỬI LẠI) */}
      {!isBrand && appStatus !== "pending" && (
        <form className="brand-upgrade-form" onSubmit={handleSubmit}>
          <div className="brand-status-header" style={{ marginBottom: 0, paddingBottom: 12 }}>
            <div>
              <h3 className="brand-status-title">
                <Store size={22} color="#2563eb" />
                <span>Đăng ký thương hiệu chuỗi nhà hàng</span>
              </h3>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.88rem" }}>
                Nâng cấp từ quán cá nhân lên chuỗi đa chi nhánh để mở rộng quy mô kinh doanh.
              </p>
            </div>
            {appStatus === "rejected" && (
              <span className="brand-upgrade-badge rejected">
                <AlertTriangle size={14} />
                <span>Bị từ chối</span>
              </span>
            )}
          </div>

          {appStatus === "rejected" && (
            <div className="brand-reject-alert">
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4>Lý do từ chối từ Quản trị viên:</h4>
                <p>{appData?.brandApplication?.rejectReason || "Hồ sơ chưa đạt tiêu chuẩn theo quy định."}</p>
                <p style={{ marginTop: 4, fontWeight: 500, color: "#7f1d1d" }}>
                  Vui lòng kiểm tra, bổ sung thông tin chính xác và gửi lại hồ sơ.
                </p>
              </div>
            </div>
          )}

          <div className="brand-form-row">
            <div className="brand-form-field">
              <label htmlFor="bu-brand-name">
                Tên chuỗi thương hiệu <span className="required">*</span>
              </label>
              <input
                id="bu-brand-name"
                type="text"
                placeholder="Ví dụ: Chuỗi Phở Bò Gia Truyền Nam Định"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                required
                disabled={submitting}
              />
              <span className="helper-text">Tên hiển thị thương hiệu chính thức trên ứng dụng khách hàng</span>
            </div>

            <div className="brand-form-field">
              <label htmlFor="bu-tax-code">Mã số thuế doanh nghiệp / hộ kinh doanh</label>
              <input
                id="bu-tax-code"
                type="text"
                placeholder="Ví dụ: 0312345678"
                value={form.taxCode}
                onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                disabled={submitting}
              />
              <span className="helper-text">Không bắt buộc nếu là hộ kinh doanh nhỏ</span>
            </div>
          </div>

          <div className="brand-form-row">
            <div className="brand-form-field">
              <label htmlFor="bu-rep-name">
                Họ và tên người đại diện <span className="required">*</span>
              </label>
              <input
                id="bu-rep-name"
                type="text"
                placeholder="Ví dụ: Nguyễn Văn An"
                value={form.representativeName}
                onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                required
                disabled={submitting}
              />
            </div>

            <div className="brand-form-field">
              <label htmlFor="bu-phone">
                Số điện thoại liên hệ <span className="required">*</span>
              </label>
              <input
                id="bu-phone"
                type="tel"
                placeholder="Ví dụ: 0912345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="brand-form-field">
            <label htmlFor="bu-license">Link ảnh Giấy phép kinh doanh / Vệ sinh ATTP</label>
            <input
              id="bu-license"
              type="text"
              placeholder="Nhập đường dẫn ảnh giấy phép (phân cách bởi dấu phẩy nếu nhiều ảnh)"
              value={form.licenseImages}
              onChange={(e) => setForm({ ...form, licenseImages: e.target.value })}
              disabled={submitting}
            />
            <span className="helper-text">Hỗ trợ các link ảnh chứng thực pháp lý cửa hàng</span>
          </div>

          <div className="brand-form-field">
            <label htmlFor="bu-notes">Ghi chú & Kế hoạch mở rộng chuỗi</label>
            <textarea
              id="bu-notes"
              rows={3}
              placeholder="Dự kiến mở thêm chi nhánh tại các khu vực nào, số lượng chi nhánh..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              disabled={submitting}
            />
          </div>

          <div className="brand-form-actions">
            <button type="submit" className="brand-btn-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Đang gửi hồ sơ...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>{appStatus === "rejected" ? "Sửa và nộp lại hồ sơ" : "Nộp hồ sơ xét duyệt"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BrandUpgrade;
