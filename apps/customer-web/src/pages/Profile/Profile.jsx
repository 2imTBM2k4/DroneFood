import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import {
  User,
  MapPin,
  Shield,
  Loader2,
  LogIn,
  Pencil,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  Mail,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";
import "./Profile.css";
import AddressBookManager from "../../components/AddressBookManager/AddressBookManager";

const TABS = [
  { id: "info", label: "Thông tin cá nhân", icon: User },
  { id: "address", label: "Địa chỉ giao hàng", icon: MapPin },
  { id: "security", label: "Bảo mật", icon: Shield },
];

const parseName = (fullName = "") => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
};

const Profile = () => {
  const { token, customerApi, user, setUser, setShowLogin } = useContext(StoreContext);
  const [activeTab, setActiveTab] = useState("info");
  const [subView, setSubView] = useState("overview"); // "overview" | "name" | "phone" | "email"
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Sub-field states
  const [nameState, setNameState] = useState({ firstName: "", lastName: "" });
  const [isFirstNameFocused, setIsFirstNameFocused] = useState(false);
  const [isLastNameFocused, setIsLastNameFocused] = useState(false);

  const [phoneState, setPhoneState] = useState("");
  const [emailState, setEmailState] = useState("");
  const [savingField, setSavingField] = useState(false);

  // Email change state (Phương án B: 2 bước bảo mật)
  const [emailStep, setEmailStep] = useState("input"); // "input" | "otp"
  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Phone change state (Xác thực 2 bước qua Email OTP)
  const [phoneStep, setPhoneStep] = useState("input"); // "input" | "otp"
  const [phoneForm, setPhoneForm] = useState({ newPhone: "", currentPassword: "" });
  const [showPhonePassword, setShowPhonePassword] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);

  // Security password state
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Sync state whenever user object changes
  useEffect(() => {
    if (!user) return;
    const { firstName, lastName } = parseName(user.name || "");
    setNameState({ firstName, lastName });
    setPhoneState(user.phone || "");
    setEmailState(user.email || "");
  }, [user]);

  // Countdown timer for email OTP
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Countdown timer for phone OTP
  useEffect(() => {
    let timer;
    if (phoneOtpCountdown > 0) {
      timer = setInterval(() => {
        setPhoneOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phoneOtpCountdown]);

  const handleAddressBookChange = useCallback((addressBook) => {
    setUser((current) => current ? { ...current, addressBook } : current);
  }, [setUser]);

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notificationService.warning(
        "Tệp không hợp lệ",
        "Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG...).",
        { audience: "user", key: "avatar-file-type" }
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notificationService.warning(
        "Kích thước tệp quá lớn",
        "Dung lượng hình ảnh đại diện phải nhỏ hơn 5MB.",
        { audience: "user", key: "avatar-file-size" }
      );
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      setUploadingAvatar(true);
      const res = await customerApi.put("/api/user/avatar", formData);
      if (res.data.success) {
        setUser(res.data.data);
        notificationService.success("Cập nhật ảnh đại diện thành công", undefined, { audience: "user" });
      } else {
        notificationService.error(
          "Không thể tải lên ảnh đại diện",
          res.data.message || "Lỗi khi cập nhật ảnh đại diện. Vui lòng thử lại.",
          { audience: "user", priority: "high", key: "profile-avatar-upload" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể tải lên ảnh đại diện",
        err.response?.data?.message || "Lỗi khi cập nhật ảnh đại diện. Vui lòng thử lại.",
        { audience: "user", priority: "high", key: "profile-avatar-upload" }
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveName = async (e) => {
    e?.preventDefault?.();
    const combinedName = [nameState.firstName.trim(), nameState.lastName.trim()]
      .filter(Boolean)
      .join(" ");

    if (!combinedName || combinedName.length < 2) {
      notificationService.warning("Tên không hợp lệ", "Vui lòng nhập tên có ít nhất 2 ký tự.", { audience: "user" });
      return;
    }

    try {
      setSavingField(true);
      const res = await customerApi.put("/api/user/profile", {
        name: combinedName,
      });
      if (res.data.success) {
        setUser(res.data.data);
        notificationService.success("Cập nhật tên thành công", undefined, { audience: "user" });
        setSubView("overview");
      } else {
        notificationService.error(
          "Không thể cập nhật tên",
          res.data.message || "Lỗi khi lưu thông tin người dùng. Vui lòng thử lại.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể cập nhật tên",
        err.response?.data?.message || "Lỗi khi lưu thông tin người dùng. Vui lòng thử lại.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleRequestPhoneChange = async (e) => {
    e?.preventDefault?.();
    const trimmedPhone = phoneForm.newPhone.trim();
    if (!trimmedPhone || !/^[0-9+\-\s()]{8,15}$/.test(trimmedPhone)) {
      notificationService.warning(
        "Số điện thoại không hợp lệ",
        "Vui lòng nhập số điện thoại hợp lệ (8 - 15 chữ số).",
        { audience: "user" }
      );
      return;
    }

    if (user?.phone && trimmedPhone === user.phone.trim()) {
      notificationService.warning(
        "Số điện thoại không đổi",
        "Số điện thoại mới phải khác số điện thoại hiện tại.",
        { audience: "user" }
      );
      return;
    }

    if (!phoneForm.currentPassword) {
      notificationService.warning(
        "Thiếu mật khẩu",
        "Vui lòng nhập mật khẩu hiện tại để xác thực bảo mật.",
        { audience: "user" }
      );
      return;
    }

    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/request-phone-change", {
        newPhone: trimmedPhone,
        currentPassword: phoneForm.currentPassword,
      });
      if (res.data.success) {
        notificationService.success(
          "Đã gửi mã xác nhận",
          res.data.message || `Mã OTP đã được gửi đến email ${user?.email}. Vui lòng kiểm tra hộp thư.`,
          { audience: "user" }
        );
        setPhoneStep("otp");
        setPhoneOtp("");
        setPhoneOtpCountdown(60);
      } else {
        notificationService.error(
          "Không thể gửi mã xác nhận",
          res.data.message || "Lỗi khi yêu cầu đổi số điện thoại. Vui lòng thử lại.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi mã xác nhận",
        err.response?.data?.message || "Lỗi khi yêu cầu đổi số điện thoại. Vui lòng thử lại.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleConfirmPhoneChange = async (e) => {
    e?.preventDefault?.();
    const trimmedOtp = phoneOtp.trim();
    if (!trimmedOtp || !/^\d{6}$/.test(trimmedOtp)) {
      notificationService.warning("Mã OTP không hợp lệ", "Vui lòng nhập đầy đủ 6 chữ số mã xác nhận.", { audience: "user" });
      return;
    }

    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/confirm-phone-change", {
        otp: trimmedOtp,
      });
      if (res.data.success) {
        setUser(res.data.data);
        notificationService.success("Thành công", "Cập nhật số điện thoại thành công!", { audience: "user" });
        setSubView("overview");
        setPhoneStep("input");
        setPhoneForm({ newPhone: "", currentPassword: "" });
        setPhoneOtp("");
        setPhoneOtpCountdown(0);
      } else {
        notificationService.error(
          "Xác nhận thất bại",
          res.data.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Xác nhận thất bại",
        err.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (phoneOtpCountdown > 0 || savingField) return;
    const trimmedPhone = phoneForm.newPhone.trim();
    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/request-phone-change", {
        newPhone: trimmedPhone,
        currentPassword: phoneForm.currentPassword,
      });
      if (res.data.success) {
        notificationService.success(
          "Đã gửi lại mã",
          `Mã OTP mới đã được gửi đến email ${user?.email}.`,
          { audience: "user" }
        );
        setPhoneOtpCountdown(60);
      } else {
        notificationService.error(
          "Không thể gửi lại mã",
          res.data.message || "Lỗi khi gửi lại mã OTP.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi lại mã",
        err.response?.data?.message || "Lỗi khi gửi lại mã OTP.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleRequestEmailChange = async (e) => {
    e?.preventDefault?.();
    const trimmedEmail = emailForm.newEmail.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      notificationService.warning("Email không hợp lệ", "Vui lòng nhập định dạng email hợp lệ.", { audience: "user" });
      return;
    }

    if (user?.email && trimmedEmail === user.email.toLowerCase()) {
      notificationService.warning("Email không đổi", "Email mới phải khác email hiện tại.", { audience: "user" });
      return;
    }

    if (!emailForm.currentPassword) {
      notificationService.warning("Thiếu mật khẩu", "Vui lòng nhập mật khẩu hiện tại để xác thực danh tính.", { audience: "user" });
      return;
    }

    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/request-email-change", {
        newEmail: trimmedEmail,
        currentPassword: emailForm.currentPassword,
      });
      if (res.data.success) {
        notificationService.success(
          "Đã gửi mã xác nhận",
          res.data.message || `Mã OTP đã được gửi đến ${trimmedEmail}. Vui lòng kiểm tra hộp thư.`,
          { audience: "user" }
        );
        setEmailStep("otp");
        setEmailOtp("");
        setOtpCountdown(60);
      } else {
        notificationService.error(
          "Không thể gửi mã xác nhận",
          res.data.message || "Lỗi khi yêu cầu đổi email. Vui lòng thử lại.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi mã xác nhận",
        err.response?.data?.message || "Lỗi khi yêu cầu đổi email. Vui lòng thử lại.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleConfirmEmailChange = async (e) => {
    e?.preventDefault?.();
    const trimmedOtp = emailOtp.trim();
    if (!trimmedOtp || !/^\d{6}$/.test(trimmedOtp)) {
      notificationService.warning("Mã OTP không hợp lệ", "Vui lòng nhập đầy đủ 6 chữ số mã xác nhận.", { audience: "user" });
      return;
    }

    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/confirm-email-change", {
        otp: trimmedOtp,
      });
      if (res.data.success) {
        setUser(res.data.data);
        notificationService.success("Thành công", "Cập nhật email thành công!", { audience: "user" });
        setSubView("overview");
        setEmailStep("input");
        setEmailForm({ newEmail: "", currentPassword: "" });
        setEmailOtp("");
        setOtpCountdown(0);
      } else {
        notificationService.error(
          "Xác nhận thất bại",
          res.data.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Xác nhận thất bại",
        err.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (otpCountdown > 0 || savingField) return;
    const trimmedEmail = emailForm.newEmail.trim().toLowerCase();
    try {
      setSavingField(true);
      const res = await customerApi.post("/api/user/request-email-change", {
        newEmail: trimmedEmail,
        currentPassword: emailForm.currentPassword,
      });
      if (res.data.success) {
        notificationService.success(
          "Đã gửi lại mã",
          `Mã OTP mới đã được gửi đến ${trimmedEmail}.`,
          { audience: "user" }
        );
        setOtpCountdown(60);
      } else {
        notificationService.error(
          "Không thể gửi lại mã",
          res.data.message || "Lỗi khi gửi lại mã OTP.",
          { audience: "user", priority: "high" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi lại mã",
        err.response?.data?.message || "Lỗi khi gửi lại mã OTP.",
        { audience: "user", priority: "high" }
      );
    } finally {
      setSavingField(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      notificationService.warning("Mật khẩu không khớp", "Mật khẩu xác nhận không khớp.", { audience: "user" });
      return;
    }
    if (password.newPassword.length < 8) {
      notificationService.warning("Mật khẩu quá ngắn", "Mật khẩu mới phải có ít nhất 8 ký tự.", { audience: "user" });
      return;
    }
    try {
      setSavingPassword(true);
      const res = await customerApi.put("/api/user/change-password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      if (res.data.success) {
        notificationService.success(res.data.message || "Đổi mật khẩu thành công", undefined, { audience: "user" });
        setPassword({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        notificationService.error(
          "Không thể đổi mật khẩu",
          res.data.message || "Lỗi khi đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.",
          { audience: "user", priority: "high", key: "profile-password-change" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể đổi mật khẩu",
        err.response?.data?.message || "Lỗi khi đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.",
        { audience: "user", priority: "high", key: "profile-password-change" }
      );
    } finally {
      setSavingPassword(false);
    }
  };

  if (!token) {
    return (
      <div className="profile-page">
        <EmptyState
          icon={LogIn}
          title="Đăng nhập để quản lý tài khoản"
          description="Thông tin tài khoản, địa chỉ nhận hàng và cài đặt bảo mật nằm trong tài khoản của bạn."
          actionLabel="Đăng nhập"
          onAction={() => setShowLogin(true)}
        />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-layout-container">
        {/* Left Sidebar Menu (Catalog) */}
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
          {/* TAB 1: THÔNG TIN CÁ NHÂN */}
          {activeTab === "info" && (
            <>
              {/* SUBVIEW 1: OVERVIEW SCREEN (Screenshot) */}
              {subView === "overview" && (
                <div className="profile-overview-view">
                  <h1 className="profile-page-title">Thông tin cá nhân</h1>

                  <div className="profile-avatar-container">
                    <div className="profile-avatar-disc">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user?.name || "Avatar"}
                          className="profile-avatar-img"
                        />
                      ) : (
                        <div className="profile-avatar-default">
                          <User size={50} color="#ffffff" strokeWidth={1.8} />
                        </div>
                      )}
                      <button
                        type="button"
                        className="profile-avatar-badge-btn"
                        onClick={handleAvatarPick}
                        disabled={uploadingAvatar}
                        aria-label="Thay đổi ảnh đại diện"
                        title="Thay đổi ảnh đại diện"
                      >
                        {uploadingAvatar ? (
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
                        const { firstName, lastName } = parseName(user?.name || "");
                        setNameState({ firstName, lastName });
                        setSubView("name");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSubView("name")}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Tên</span>
                        <span className="profile-row-value">{user?.name || "Chưa thiết lập"}</span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 2: Số điện thoại */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setPhoneForm({ newPhone: "", currentPassword: "" });
                        setShowPhonePassword(false);
                        setPhoneOtp("");
                        setPhoneStep("input");
                        setPhoneOtpCountdown(0);
                        setSubView("phone");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setPhoneForm({ newPhone: "", currentPassword: "" });
                          setShowPhonePassword(false);
                          setPhoneOtp("");
                          setPhoneStep("input");
                          setPhoneOtpCountdown(0);
                          setSubView("phone");
                        }
                      }}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Số điện thoại</span>
                        <div className="profile-row-value-group">
                          <span className="profile-row-value">
                            {user?.phone || "Chưa thiết lập"}
                          </span>
                          {user?.phone ? (
                            user?.phoneVerified ? (
                              <span className="profile-status-icon verified" title="Đã xác minh">
                                <CheckCircle2 size={16} />
                              </span>
                            ) : (
                              <span className="profile-status-icon unverified" title="Chưa xác thực">
                                <AlertTriangle size={16} />
                              </span>
                            )
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 3: Email */}
                    <div
                      className="profile-row-item"
                      onClick={() => {
                        setEmailForm({ newEmail: "", currentPassword: "" });
                        setShowEmailPassword(false);
                        setEmailOtp("");
                        setEmailStep("input");
                        setOtpCountdown(0);
                        setSubView("email");
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setEmailForm({ newEmail: "", currentPassword: "" });
                          setShowEmailPassword(false);
                          setEmailOtp("");
                          setEmailStep("input");
                          setOtpCountdown(0);
                          setSubView("email");
                        }
                      }}
                    >
                      <div className="profile-row-text">
                        <span className="profile-row-label">Email</span>
                        <div className="profile-row-value-group">
                          <span className="profile-row-value">{user?.email || "Chưa thiết lập"}</span>
                          <span className="profile-status-icon verified" title="Đã xác minh">
                            <CheckCircle2 size={16} />
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 2: EDIT NAME SCREEN */}
              {subView === "name" && (
                <div className="profile-sub-view">
                  <button
                    type="button"
                    className="profile-back-action"
                    onClick={() => setSubView("overview")}
                  >
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Tên</h1>
                  <p className="profile-sub-desc">
                    Đây là tên bạn muốn người khác sử dụng khi đề cập đến bạn.
                  </p>

                  <form onSubmit={handleSaveName} className="profile-name-form">
                    <div className="profile-field-block">
                      <label htmlFor="pf-first-name" className="profile-field-label">
                        Tên
                      </label>
                      <div
                        className={`profile-input-box ${
                          isFirstNameFocused ? "is-focused" : "is-idle"
                        }`}
                      >
                        <input
                          id="pf-first-name"
                          type="text"
                          value={nameState.firstName}
                          onFocus={() => setIsFirstNameFocused(true)}
                          onBlur={() => setIsFirstNameFocused(false)}
                          onChange={(e) =>
                            setNameState((prev) => ({ ...prev, firstName: e.target.value }))
                          }
                          placeholder="Nhập tên"
                          autoFocus
                        />
                        {nameState.firstName && (
                          <button
                            type="button"
                            className="profile-clear-circle"
                            onClick={() =>
                              setNameState((prev) => ({ ...prev, firstName: "" }))
                            }
                            aria-label="Xóa tên"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="profile-field-block">
                      <label htmlFor="pf-last-name" className="profile-field-label">
                        Họ
                      </label>
                      <div
                        className={`profile-input-box ${
                          isLastNameFocused ? "is-focused" : "is-idle"
                        }`}
                      >
                        <input
                          id="pf-last-name"
                          type="text"
                          value={nameState.lastName}
                          onFocus={() => setIsLastNameFocused(true)}
                          onBlur={() => setIsLastNameFocused(false)}
                          onChange={(e) =>
                            setNameState((prev) => ({ ...prev, lastName: e.target.value }))
                          }
                          placeholder="Nhập họ"
                        />
                        {nameState.lastName && (
                          <button
                            type="button"
                            className="profile-clear-circle"
                            onClick={() =>
                              setNameState((prev) => ({ ...prev, lastName: "" }))
                            }
                            aria-label="Xóa họ"
                          >
                            <X size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="profile-btn-primary profile-btn-full"
                      disabled={savingField}
                    >
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW 3: EDIT PHONE SCREEN (Xác thực 2 bước qua Email OTP) */}
              {subView === "phone" && (
                <div className="profile-sub-view">
                  <button
                    type="button"
                    className="profile-back-action"
                    onClick={() => {
                      setSubView("overview");
                      setPhoneStep("input");
                      setPhoneOtp("");
                    }}
                  >
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">
                    {phoneStep === "input" ? "Đổi Số điện thoại" : "Xác thực mã OTP"}
                  </h1>
                  <p className="profile-sub-desc">
                    {phoneStep === "input"
                      ? "Để bảo vệ an toàn tài khoản, vui lòng xác nhận mật khẩu hiện tại. Mã OTP xác thực sẽ được gửi về email đăng ký của bạn."
                      : `Mã OTP xác thực 6 chữ số đã được gửi đến email tài khoản của bạn: ${user?.email}`}
                  </p>

                  <div className="profile-current-email-badge">
                    <span className="profile-current-email-label">Số điện thoại hiện tại:</span>
                    <strong className="profile-current-email-value">{user?.phone || "Chưa thiết lập"}</strong>
                  </div>

                  {phoneStep === "input" ? (
                    <form onSubmit={handleRequestPhoneChange} className="profile-phone-form">
                      <div className="profile-field-block">
                        <label htmlFor="pf-new-phone-input" className="profile-field-label">
                          Số điện thoại mới
                        </label>
                        <div className="profile-phone-input-row">
                          <div className="profile-country-dropdown-pill">
                            <span className="profile-country-code">VN</span>
                            <ChevronDown size={16} className="profile-country-arrow" />
                          </div>
                          <div className="profile-phone-field-wrap">
                            <input
                              id="pf-new-phone-input"
                              type="tel"
                              value={phoneForm.newPhone}
                              onChange={(e) =>
                                setPhoneForm((prev) => ({ ...prev, newPhone: e.target.value }))
                              }
                              placeholder="0912345678"
                              className="profile-phone-input"
                              autoFocus
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <div className="profile-field-block">
                        <label htmlFor="pf-phone-password" className="profile-field-label">
                          Mật khẩu hiện tại
                        </label>
                        <div className="profile-email-input-wrap">
                          <input
                            id="pf-phone-password"
                            type={showPhonePassword ? "text" : "password"}
                            value={phoneForm.currentPassword}
                            onChange={(e) =>
                              setPhoneForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                            }
                            placeholder="Nhập mật khẩu hiện tại của bạn"
                            className="profile-email-input"
                            required
                          />
                          <button
                            type="button"
                            className="profile-password-toggle-btn"
                            onClick={() => setShowPhonePassword((prev) => !prev)}
                            aria-label={showPhonePassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                          >
                            {showPhonePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <p className="profile-helper-note">
                          Mã xác thực sẽ được gửi đến email đăng ký: {user?.email ? <strong>{user.email}</strong> : "của bạn"}
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="profile-btn-primary"
                        disabled={savingField || !phoneForm.newPhone || !phoneForm.currentPassword}
                      >
                        {savingField ? <Loader2 size={16} className="spin" /> : "Gửi mã xác minh"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmPhoneChange} className="profile-phone-form">
                      <div className="profile-otp-card">
                        <div className="profile-otp-card-header">
                          <ShieldCheck size={24} className="profile-otp-card-icon" />
                          <div>
                            <div className="profile-otp-card-title">Kiểm tra hộp thư email</div>
                            <div className="profile-otp-card-subtitle">
                              Chúng tôi đã gửi mã xác nhận 6 số đến email <strong>{user?.email}</strong> để xác nhận đổi sang số điện thoại <strong>{phoneForm.newPhone}</strong>.
                            </div>
                          </div>
                        </div>

                        <div className="profile-field-block" style={{ marginTop: 18 }}>
                          <label htmlFor="pf-phone-otp" className="profile-field-label">
                            Mã xác nhận 6 chữ số (OTP)
                          </label>
                          <div className="profile-otp-input-wrap">
                            <input
                              id="pf-phone-otp"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={phoneOtp}
                              onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              className="profile-otp-input"
                              autoFocus
                              required
                            />
                          </div>
                          <p className="profile-helper-note" style={{ textAlign: "center", marginTop: 8 }}>
                            Mã OTP có hiệu lực trong vòng 10 phút.
                          </p>
                        </div>
                      </div>

                      <div className="profile-otp-actions-row">
                        <button
                          type="submit"
                          className="profile-btn-primary"
                          disabled={savingField || phoneOtp.length !== 6}
                        >
                          {savingField ? <Loader2 size={16} className="spin" /> : "Xác nhận đổi số điện thoại"}
                        </button>

                        <div className="profile-otp-links">
                          {phoneOtpCountdown > 0 ? (
                            <span className="profile-resend-countdown">
                              Gửi lại mã sau <strong>{phoneOtpCountdown}s</strong>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="profile-btn-link"
                              onClick={handleResendPhoneOtp}
                              disabled={savingField}
                            >
                              <RotateCcw size={14} /> Gửi lại mã OTP
                            </button>
                          )}

                          <button
                            type="button"
                            className="profile-btn-link secondary"
                            onClick={() => {
                              setPhoneStep("input");
                              setPhoneOtp("");
                            }}
                            disabled={savingField}
                          >
                            Đổi số khác
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* SUBVIEW 4: EDIT EMAIL SCREEN (Phương án B: 2 bước bảo mật) */}
              {subView === "email" && (
                <div className="profile-sub-view">
                  <button
                    type="button"
                    className="profile-back-action"
                    onClick={() => {
                      setSubView("overview");
                      setEmailStep("input");
                      setEmailOtp("");
                    }}
                  >
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">
                    {emailStep === "input" ? "Đổi địa chỉ Email" : "Xác thực mã OTP"}
                  </h1>
                  <p className="profile-sub-desc">
                    {emailStep === "input"
                      ? "Để bảo vệ an toàn tài khoản, vui lòng xác nhận mật khẩu hiện tại. Mã OTP xác thực sẽ được gửi đến email mới."
                      : `Mã OTP xác thực 6 chữ số đã được gửi đến email mới: ${emailForm.newEmail}`}
                  </p>

                  <div className="profile-current-email-badge">
                    <span className="profile-current-email-label">Email hiện tại:</span>
                    <strong className="profile-current-email-value">{user?.email || "Chưa thiết lập"}</strong>
                  </div>

                  {emailStep === "input" ? (
                    <form onSubmit={handleRequestEmailChange} className="profile-email-form">
                      <div className="profile-field-block">
                        <label htmlFor="pf-new-email-input" className="profile-field-label">
                          Email mới
                        </label>
                        <div className="profile-email-input-wrap">
                          <input
                            id="pf-new-email-input"
                            type="email"
                            value={emailForm.newEmail}
                            onChange={(e) =>
                              setEmailForm((prev) => ({ ...prev, newEmail: e.target.value }))
                            }
                            placeholder="nhapemailmoi@example.com"
                            className="profile-email-input"
                            autoFocus
                            required
                          />
                          <span className="profile-email-shield-icon" title="Email mới">
                            <Mail size={18} />
                          </span>
                        </div>
                      </div>

                      <div className="profile-field-block">
                        <label htmlFor="pf-email-password" className="profile-field-label">
                          Mật khẩu hiện tại
                        </label>
                        <div className="profile-email-input-wrap">
                          <input
                            id="pf-email-password"
                            type={showEmailPassword ? "text" : "password"}
                            value={emailForm.currentPassword}
                            onChange={(e) =>
                              setEmailForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                            }
                            placeholder="Nhập mật khẩu hiện tại của bạn"
                            className="profile-email-input"
                            required
                          />
                          <button
                            type="button"
                            className="profile-password-toggle-btn"
                            onClick={() => setShowEmailPassword((prev) => !prev)}
                            aria-label={showEmailPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                          >
                            {showEmailPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <p className="profile-helper-note">
                          Xác thực mật khẩu bảo vệ tài khoản trước khi gửi mã xác minh
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="profile-btn-primary"
                        disabled={savingField || !emailForm.newEmail || !emailForm.currentPassword}
                      >
                        {savingField ? <Loader2 size={16} className="spin" /> : "Gửi mã xác minh"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmEmailChange} className="profile-email-form">
                      <div className="profile-otp-card">
                        <div className="profile-otp-card-header">
                          <ShieldCheck size={24} className="profile-otp-card-icon" />
                          <div>
                            <div className="profile-otp-card-title">Kiểm tra hộp thư đến</div>
                            <div className="profile-otp-card-subtitle">
                              Chúng tôi đã gửi mã xác nhận 6 số đến <strong>{emailForm.newEmail}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="profile-field-block" style={{ marginTop: 18 }}>
                          <label htmlFor="pf-email-otp" className="profile-field-label">
                            Mã xác nhận 6 chữ số (OTP)
                          </label>
                          <div className="profile-otp-input-wrap">
                            <input
                              id="pf-email-otp"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={emailOtp}
                              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              className="profile-otp-input"
                              autoFocus
                              required
                            />
                          </div>
                          <p className="profile-helper-note" style={{ textAlign: "center", marginTop: 8 }}>
                            Mã OTP có hiệu lực trong vòng 10 phút.
                          </p>
                        </div>
                      </div>

                      <div className="profile-otp-actions-row">
                        <button
                          type="submit"
                          className="profile-btn-primary"
                          disabled={savingField || emailOtp.length !== 6}
                        >
                          {savingField ? <Loader2 size={16} className="spin" /> : "Xác nhận đổi email"}
                        </button>

                        <div className="profile-otp-links">
                          {otpCountdown > 0 ? (
                            <span className="profile-resend-countdown">
                              Gửi lại mã sau <strong>{otpCountdown}s</strong>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="profile-btn-link"
                              onClick={handleResendEmailOtp}
                              disabled={savingField}
                            >
                              <RotateCcw size={14} /> Gửi lại mã OTP
                            </button>
                          )}

                          <button
                            type="button"
                            className="profile-btn-link secondary"
                            onClick={() => {
                              setEmailStep("input");
                              setEmailOtp("");
                            }}
                            disabled={savingField}
                          >
                            Đổi email khác
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 2: ĐỊA CHỈ GIAO HÀNG */}
          {activeTab === "address" && (
            <AddressBookManager fullName={user?.name} onChange={handleAddressBookChange} />
          )}

          {/* TAB 3: BẢO MẬT (ĐỔI MẬT KHẨU) */}
          {activeTab === "security" && (
            <form className="profile-form" onSubmit={handleChangePassword}>
              <h2 className="profile-tab-section-title">Đổi mật khẩu</h2>
              <div className="profile-field">
                <label htmlFor="pf-cur-pass">Mật khẩu hiện tại</label>
                <input
                  id="pf-cur-pass"
                  type="password"
                  value={password.currentPassword}
                  onChange={(e) =>
                    setPassword({ ...password, currentPassword: e.target.value })
                  }
                  placeholder="Nhập mật khẩu hiện tại"
                  autoComplete="current-password"
                />
              </div>
              <div className="profile-field">
                <label htmlFor="pf-new-pass">Mật khẩu mới</label>
                <input
                  id="pf-new-pass"
                  type="password"
                  value={password.newPassword}
                  onChange={(e) =>
                    setPassword({ ...password, newPassword: e.target.value })
                  }
                  placeholder="Ít nhất 8 ký tự"
                  autoComplete="new-password"
                  aria-invalid={password.newPassword.length > 0 && password.newPassword.length < 8}
                  aria-describedby={
                    password.newPassword.length > 0 && password.newPassword.length < 8
                      ? "pf-new-pass-error"
                      : undefined
                  }
                />
                {password.newPassword && password.newPassword.length < 8 && (
                  <span
                    id="pf-new-pass-error"
                    className="profile-field-error"
                    role="alert"
                    style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}
                  >
                    Mật khẩu mới phải có ít nhất 8 ký tự
                  </span>
                )}
              </div>
              <div className="profile-field">
                <label htmlFor="pf-confirm-pass">Xác nhận mật khẩu mới</label>
                <input
                  id="pf-confirm-pass"
                  type="password"
                  value={password.confirmPassword}
                  onChange={(e) =>
                    setPassword({ ...password, confirmPassword: e.target.value })
                  }
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  aria-invalid={
                    !!(
                      password.newPassword &&
                      password.confirmPassword &&
                      password.newPassword !== password.confirmPassword
                    )
                  }
                  aria-describedby={
                    password.newPassword &&
                    password.confirmPassword &&
                    password.newPassword !== password.confirmPassword
                      ? "pf-confirm-pass-error"
                      : undefined
                  }
                />
                {password.newPassword &&
                  password.confirmPassword &&
                  password.newPassword !== password.confirmPassword && (
                    <span
                      id="pf-confirm-pass-error"
                      className="profile-field-error"
                      role="alert"
                      style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}
                    >
                      Mật khẩu xác nhận không khớp
                    </span>
                  )}
              </div>
              <button
                type="submit"
                className="profile-btn-primary"
                disabled={savingPassword}
              >
                {savingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export default Profile;
