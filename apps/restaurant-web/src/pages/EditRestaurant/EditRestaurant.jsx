import React, { useState, useEffect, useContext, useRef } from "react";
import "./EditRestaurant.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { AuthContext } from "../../context/AuthContext";
import {
  User,
  MapPin,
  Shield,
  Loader2,
  Pencil,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Clock,
  Store,
} from "lucide-react";

const TABS = [
  { id: "info", label: "Thông tin cá nhân", icon: User },
  { id: "address", label: "Địa chỉ quán", icon: MapPin },
  { id: "security", label: "Bảo mật", icon: Shield },
];

const EditRestaurant = ({ url = import.meta.env.VITE_API_URL || "http://localhost:4000" }) => {
  const { user, setUser, fetchUserInfo } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState("info");
  const [subView, setSubView] = useState("overview"); // "overview" | "name" | "phone" | "email" | "description" | "address" | "hours"

  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [image, setImage] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);

  const [data, setData] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    description: "",
    openTime: "07:00",
    closeTime: "22:00",
    isOpen: true,
  });

  const [editFieldState, setEditFieldState] = useState("");
  const [editHoursState, setEditHoursState] = useState({ openTime: "07:00", closeTime: "22:00" });
  const [isFieldFocused, setIsFieldFocused] = useState(false);
  const [savingField, setSavingField] = useState(false);

  // Security password state
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const getRestaurantId = () => {
    let id = user?.restaurantId;
    if (!id) return null;
    if (typeof id === "string") return id;
    if (id._id) return id._id.toString();
    if (typeof id.toString === "function") return id.toString();
    return null;
  };

  useEffect(() => {
    const restaurantId = getRestaurantId();
    if (restaurantId) {
      fetchRestaurant(restaurantId);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchRestaurant = async (restaurantId) => {
    try {
      const response = await axios.get(`${url}/api/restaurant/${restaurantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.data.success) {
        const myRestaurant = response.data.data;
        if (myRestaurant) {
          setData({
            name: myRestaurant.name || "",
            address: myRestaurant.address || "",
            email: myRestaurant.email || "",
            phone: myRestaurant.phone || "",
            description: myRestaurant.description || "",
            openTime: myRestaurant.openingHours?.openTime || "07:00",
            closeTime: myRestaurant.openingHours?.closeTime || "22:00",
            isOpen: myRestaurant.isOpen !== false,
          });
          setCurrentImageUrl(myRestaurant.image || null);
          setImage(null);
        }
      }
    } catch (error) {
      console.error("Error fetching restaurant:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notificationService.warning("Tệp không hợp lệ", "Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG...).", {
        audience: "restaurant",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notificationService.warning("Kích thước tệp quá lớn", "Dung lượng hình ảnh phải nhỏ hơn 5MB.", {
        audience: "restaurant",
      });
      return;
    }

    const restaurantId = getRestaurantId();
    if (!restaurantId) return;

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("address", data.address);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    formData.append("description", data.description);
    formData.append(
      "openingHours",
      JSON.stringify({ openTime: data.openTime, closeTime: data.closeTime })
    );
    formData.append("isOpen", Boolean(data.isOpen));
    formData.append("image", file);

    try {
      setUploadingImage(true);
      const response = await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        notificationService.success("Cập nhật ảnh đại diện thành công!", undefined, {
          audience: "restaurant",
        });
        setImage(null);
        await fetchRestaurant(restaurantId);
        const token = localStorage.getItem("token");
        if (token && fetchUserInfo) {
          fetchUserInfo(token);
        }
      } else {
        notificationService.error(
          "Không thể cập nhật ảnh",
          response.data.message || "Lỗi khi tải ảnh lên. Vui lòng thử lại.",
          { audience: "restaurant", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể cập nhật ảnh",
        err.response?.data?.message || err.message || "Lỗi khi cập nhật ảnh đại diện.",
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUpdateField = async (field, value) => {
    const restaurantId = getRestaurantId();
    if (!restaurantId) return;

    const updated = { ...data, [field]: value };
    const formData = new FormData();
    formData.append("name", updated.name);
    formData.append("address", updated.address);
    formData.append("email", updated.email);
    formData.append("phone", updated.phone);
    formData.append("description", updated.description);
    formData.append(
      "openingHours",
      JSON.stringify({ openTime: updated.openTime, closeTime: updated.closeTime })
    );
    formData.append("isOpen", Boolean(updated.isOpen));

    try {
      setSavingField(true);
      const response = await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setData(updated);
        notificationService.success("Cập nhật thành công!", undefined, { audience: "restaurant" });
        setSubView("overview");
        const token = localStorage.getItem("token");
        if (token && fetchUserInfo) {
          fetchUserInfo(token);
        }
      } else {
        notificationService.error(
          "Không thể cập nhật",
          response.data.message || "Lỗi khi lưu thông tin. Vui lòng thử lại.",
          { audience: "restaurant", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể cập nhật",
        err.response?.data?.message || err.message || "Lỗi khi lưu thông tin.",
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };


  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      notificationService.warning("Mật khẩu không khớp", "Mật khẩu xác nhận không khớp.", {
        audience: "restaurant",
      });
      return;
    }
    if (password.newPassword.length < 8) {
      notificationService.warning("Mật khẩu quá ngắn", "Mật khẩu mới phải có ít nhất 8 ký tự.", {
        audience: "restaurant",
      });
      return;
    }

    try {
      setSavingPassword(true);
      const res = await axios.put(
        `${url}/api/user/change-password`,
        {
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (res.data.success) {
        notificationService.success(res.data.message || "Đổi mật khẩu thành công!", undefined, {
          audience: "restaurant",
        });
        setPassword({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        notificationService.error(
          "Không thể đổi mật khẩu",
          res.data.message || "Lỗi khi đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.",
          { audience: "restaurant", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể đổi mật khẩu",
        err.response?.data?.message || err.message || "Lỗi khi đổi mật khẩu.",
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page" style={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
        <Loader2 size={32} className="spin" />
      </div>
    );
  }

  const avatarSource =
    (image && URL.createObjectURL(image)) ||
    currentImageUrl ||
    user?.restaurantImage ||
    user?.restaurant?.image ||
    assets.profile_image;

  return (
    <div className="profile-page">
      <div className="profile-layout-container">
        {/* Left Sidebar Menu */}
        <aside className="profile-sidebar" aria-label="Menu tài khoản">
          <nav className="profile-sidebar-nav" role="tablist">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`profile-sidebar-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSubView("overview");
                  }}
                >
                  <Icon size={18} className="profile-sidebar-icon" />
                  <span className="profile-sidebar-label">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Main Content Area */}
        <main className="profile-main-content">
          {/* TAB 1: THÔNG TIN CÁ NHÂN / QUÁN */}
          {activeTab === "info" && (
            <>
              {/* SUBVIEW: OVERVIEW */}
              {subView === "overview" && (
                <div className="profile-overview-view">
                  <h1 className="profile-page-title">Thông tin cá nhân</h1>

                  <div className="profile-avatar-container">
                    <div className="profile-avatar-disc">
                      <img src={avatarSource} alt="Restaurant Avatar" className="profile-avatar-img" />
                      <button
                        type="button"
                        className="profile-avatar-badge-btn"
                        onClick={handleAvatarPick}
                        disabled={uploadingImage}
                        aria-label="Thay đổi ảnh đại diện"
                        title="Thay đổi ảnh đại diện"
                      >
                        {uploadingImage ? (
                          <Loader2 size={15} className="spin" />
                        ) : (
                          <Pencil size={15} color="#111827" />
                        )}
                      </button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarChange}
                    />
                  </div>

                  <div className="profile-list-section">
                    {/* Row 1: Tên */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditFieldState(data.name);
                        setSubView("name");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("name")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Tên</span>
                        <span className="profile-row-value">{data.name || "Chưa thiết lập"}</span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 2: Số điện thoại */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditFieldState(data.phone);
                        setSubView("phone");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("phone")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Số điện thoại</span>
                        <div className="profile-row-value-group">
                          <span className="profile-row-value">{data.phone || "Chưa thiết lập"}</span>
                          {data.phone ? (
                            <span className="profile-status-icon verified" title="Đã có số điện thoại">
                              <CheckCircle2 size={16} />
                            </span>
                          ) : (
                            <span className="profile-status-icon unverified" title="Chưa thiết lập">
                              <AlertTriangle size={16} />
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 3: Email */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditFieldState(data.email);
                        setSubView("email");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("email")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Email</span>
                        <div className="profile-row-value-group">
                          <span className="profile-row-value">{data.email || "Chưa thiết lập"}</span>
                          <span className="profile-status-icon verified" title="Email hợp lệ">
                            <CheckCircle2 size={16} />
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 4: Mô tả quán */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditFieldState(data.description);
                        setSubView("description");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("description")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Mô tả quán</span>
                        <span className="profile-row-value">{data.description || "Chưa thiết lập mô tả"}</span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                  </div>
                </div>
              )}

              {/* SUBVIEW: EDIT NAME */}
              {subView === "name" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Tên nhà hàng</h1>
                  <p className="profile-sub-desc">
                    Đây là tên nhà hàng / quán ăn sẽ hiển thị công khai cho thực khách.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("name", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-name" className="profile-field-label">
                        Tên nhà hàng
                      </label>
                      <div className={`profile-input-box ${isFieldFocused ? "is-focused" : "is-idle"}`}>
                        <input
                          id="pf-restaurant-name"
                          type="text"
                          value={editFieldState}
                          onFocus={() => setIsFieldFocused(true)}
                          onBlur={() => setIsFieldFocused(false)}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="Nhập tên quán"
                          autoFocus
                          required
                        />
                        {editFieldState && (
                          <button
                            type="button"
                            className="profile-clear-circle"
                            onClick={() => setEditFieldState("")}
                            aria-label="Xóa"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW: EDIT PHONE */}
              {subView === "phone" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Số điện thoại</h1>
                  <p className="profile-sub-desc">
                    Số điện thoại liên hệ của nhà hàng để khách hàng và tài xế liên lạc khi xử lý đơn.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("phone", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-phone" className="profile-field-label">
                        Số điện thoại
                      </label>
                      <div className={`profile-input-box ${isFieldFocused ? "is-focused" : "is-idle"}`}>
                        <input
                          id="pf-restaurant-phone"
                          type="tel"
                          value={editFieldState}
                          onFocus={() => setIsFieldFocused(true)}
                          onBlur={() => setIsFieldFocused(false)}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="0912345678"
                          autoFocus
                          required
                        />
                        {editFieldState && (
                          <button
                            type="button"
                            className="profile-clear-circle"
                            onClick={() => setEditFieldState("")}
                            aria-label="Xóa"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW: EDIT EMAIL */}
              {subView === "email" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Địa chỉ Email</h1>
                  <p className="profile-sub-desc">
                    Email dùng để nhận thông báo vận hành, đơn đặt món và báo cáo doanh thu.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("email", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-email" className="profile-field-label">
                        Email
                      </label>
                      <div className={`profile-input-box ${isFieldFocused ? "is-focused" : "is-idle"}`}>
                        <input
                          id="pf-restaurant-email"
                          type="email"
                          value={editFieldState}
                          onFocus={() => setIsFieldFocused(true)}
                          onBlur={() => setIsFieldFocused(false)}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="restaurant@example.com"
                          autoFocus
                          required
                        />
                        {editFieldState && (
                          <button
                            type="button"
                            className="profile-clear-circle"
                            onClick={() => setEditFieldState("")}
                            aria-label="Xóa"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW: EDIT DESCRIPTION */}
              {subView === "description" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Mô tả quán</h1>
                  <p className="profile-sub-desc">
                    Giới thiệu phong cách ẩm thực, thông điệp hoặc điểm nổi bật của món ăn để thu hút khách hàng.
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("description", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-desc" className="profile-field-label">
                        Mô tả chi tiết
                      </label>
                      <div className="profile-textarea-box">
                        <textarea
                          id="pf-restaurant-desc"
                          rows={6}
                          value={editFieldState}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="Nhập thông tin giới thiệu..."
                          autoFocus
                        />
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* TAB 2: ĐỊA CHỈ & GIỜ HOẠT ĐỘNG */}
          {activeTab === "address" && (
            <>
              {subView === "overview" && (
                <div className="profile-overview-view">
                  <h1 className="profile-page-title">Địa chỉ quán</h1>
                  <p className="profile-sub-desc" style={{ marginBottom: 20 }}>
                    Địa chỉ chính xác quyết định khu vực giao hàng và cước phí định vị của Drone.
                  </p>

                  <div className="profile-list-section">
                    {/* Row 1: Địa chỉ */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditFieldState(data.address);
                        setSubView("address");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("address")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Địa chỉ quán</span>
                        <span className="profile-row-value">{data.address || "Chưa thiết lập địa chỉ"}</span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 2: Giờ hoạt động */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEditHoursState({ openTime: data.openTime, closeTime: data.closeTime });
                        setSubView("hours");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("hours")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Giờ hoạt động</span>
                        <span className="profile-row-value">
                          {data.openTime} - {data.closeTime}
                        </span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW: EDIT ADDRESS */}
              {subView === "address" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Địa chỉ quán</h1>
                  <p className="profile-sub-desc">
                    Vui lòng nhập địa chỉ đầy đủ (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố).
                  </p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("address", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-address" className="profile-field-label">
                        Địa chỉ
                      </label>
                      <div className="profile-textarea-box">
                        <textarea
                          id="pf-restaurant-address"
                          rows={4}
                          value={editFieldState}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="Ví dụ: 24 Thạch Lam, Phường Phú Thạnh, Quận Tân Phú, TP. HCM"
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW: EDIT HOURS */}
              {subView === "hours" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Giờ hoạt động</h1>
                  <p className="profile-sub-desc">
                    Hệ thống sẽ tự động cập nhật trạng thái mở cửa và chặn khách đặt ngoài khung giờ này.
                  </p>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const restaurantId = getRestaurantId();
                      if (!restaurantId) return;

                      const updated = {
                        ...data,
                        openTime: editHoursState.openTime,
                        closeTime: editHoursState.closeTime,
                      };
                      const formData = new FormData();
                      formData.append("name", updated.name);
                      formData.append("address", updated.address);
                      formData.append("email", updated.email);
                      formData.append("phone", updated.phone);
                      formData.append("description", updated.description);
                      formData.append(
                        "openingHours",
                        JSON.stringify({
                          openTime: editHoursState.openTime,
                          closeTime: editHoursState.closeTime,
                        })
                      );
                      formData.append("isOpen", Boolean(updated.isOpen));

                      try {
                        setSavingField(true);
                        const res = await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
                          headers: {
                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                            "Content-Type": "multipart/form-data",
                          },
                        });
                        if (res.data.success) {
                          setData(updated);
                          notificationService.success("Cập nhật giờ hoạt động thành công!", undefined, {
                            audience: "restaurant",
                          });
                          setSubView("overview");
                        }
                      } catch (err) {
                        notificationService.error(
                          "Lỗi khi cập nhật giờ",
                          err.response?.data?.message || err.message,
                          { audience: "restaurant", priority: "high" }
                        );
                      } finally {
                        setSavingField(false);
                      }
                    }}
                    className="profile-name-form"
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div className="profile-field-block">
                        <label htmlFor="pf-open-time" className="profile-field-label">
                          Giờ mở cửa
                        </label>
                        <div className="profile-input-box is-idle">
                          <input
                            id="pf-open-time"
                            type="time"
                            value={editHoursState.openTime}
                            onChange={(e) =>
                              setEditHoursState((prev) => ({ ...prev, openTime: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="profile-field-block">
                        <label htmlFor="pf-close-time" className="profile-field-label">
                          Giờ đóng cửa
                        </label>
                        <div className="profile-input-box is-idle">
                          <input
                            id="pf-close-time"
                            type="time"
                            value={editHoursState.closeTime}
                            onChange={(e) =>
                              setEditHoursState((prev) => ({ ...prev, closeTime: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="profile-btn-primary profile-btn-full" disabled={savingField}>
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* TAB 3: BẢO MẬT */}
          {activeTab === "security" && (
            <div className="profile-overview-view">
              <h1 className="profile-page-title">Bảo mật</h1>
              <p className="profile-sub-desc" style={{ marginBottom: 24 }}>
                Quản lý mật khẩu để bảo vệ an toàn cho tài khoản nhà hàng của bạn.
              </p>

              <form className="profile-form" onSubmit={handleChangePassword}>
                <h2 className="profile-tab-section-title">Đổi mật khẩu</h2>

                <div className="profile-field">
                  <label htmlFor="pf-current-pass">Mật khẩu hiện tại</label>
                  <div className="profile-password-input-wrap">
                    <input
                      id="pf-current-pass"
                      type={showPassword.current ? "text" : "password"}
                      value={password.currentPassword}
                      onChange={(e) =>
                        setPassword({ ...password, currentPassword: e.target.value })
                      }
                      placeholder="Nhập mật khẩu hiện tại"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="profile-password-toggle-btn"
                      onClick={() =>
                        setShowPassword((prev) => ({ ...prev, current: !prev.current }))
                      }
                    >
                      {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="profile-field">
                  <label htmlFor="pf-new-pass">Mật khẩu mới</label>
                  <div className="profile-password-input-wrap">
                    <input
                      id="pf-new-pass"
                      type={showPassword.new ? "text" : "password"}
                      value={password.newPassword}
                      onChange={(e) =>
                        setPassword({ ...password, newPassword: e.target.value })
                      }
                      placeholder="Ít nhất 8 ký tự"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="profile-password-toggle-btn"
                      onClick={() =>
                        setShowPassword((prev) => ({ ...prev, new: !prev.new }))
                      }
                    >
                      {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="profile-field">
                  <label htmlFor="pf-confirm-pass">Xác nhận mật khẩu mới</label>
                  <div className="profile-password-input-wrap">
                    <input
                      id="pf-confirm-pass"
                      type={showPassword.confirm ? "text" : "password"}
                      value={password.confirmPassword}
                      onChange={(e) =>
                        setPassword({ ...password, confirmPassword: e.target.value })
                      }
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="profile-password-toggle-btn"
                      onClick={() =>
                        setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))
                      }
                    >
                      {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {password.newPassword &&
                    password.confirmPassword &&
                    password.newPassword !== password.confirmPassword && (
                      <span className="profile-field-error">Mật khẩu xác nhận không khớp</span>
                    )}
                </div>

                <button
                  type="submit"
                  className="profile-btn-primary"
                  style={{ alignSelf: "flex-start", marginTop: 8 }}
                  disabled={
                    savingPassword ||
                    !password.currentPassword ||
                    !password.newPassword ||
                    password.newPassword !== password.confirmPassword
                  }
                >
                  {savingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default EditRestaurant;
