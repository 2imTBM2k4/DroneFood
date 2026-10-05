import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { User, MapPin, Shield, Camera, LogIn, Loader2 } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import Avatar from "../../components/Avatar/Avatar";
import { EmptyState } from "@drone-food/web-ui/components/StateBlock";
import "./Profile.css";
import AddressBookManager from "../../components/AddressBookManager/AddressBookManager";

const TABS = [
  { id: "info", label: "Profile", icon: User },
  { id: "address", label: "Delivery address", icon: MapPin },
  { id: "security", label: "Security", icon: Shield },
];

const Profile = () => {
  const { token, customerApi, user, setUser, setShowLogin, logoutCustomer } = useContext(StoreContext);
  const [activeTab, setActiveTab] = useState("info");
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Each section owns its own form state and saving flag.
  const [info, setInfo] = useState({ name: "", phone: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [emailChange, setEmailChange] = useState({ email: "", currentPassword: "" });
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [emailChangeStatus, setEmailChangeStatus] = useState("");

  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Hydrate the forms whenever the user in context changes (initial load, or
  // after a successful save that returns the fresh record).
  useEffect(() => {
    if (!user) return;
    setInfo({
      name: user.name || "",
      phone: user.phone || "",
    });
  }, [user]);

  const handleAddressBookChange = useCallback((addressBook) => {
    setUser((current) => current ? { ...current, addressBook } : current);
  }, [setUser]);

  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      setUploadingAvatar(true);
      const res = await customerApi.put("/api/user/avatar", formData);
      if (res.data.success) {
        setUser(res.data.data);
        toast.success("Avatar updated");
      } else {
        toast.error(res.data.message || "Upload failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    try {
      setSavingInfo(true);
      const res = await customerApi.put("/api/user/profile", {
        name: info.name,
        phone: info.phone,
      });
      if (res.data.success) {
        setUser(res.data.data);
        toast.success("Profile updated");
      } else {
        toast.error(res.data.message || "Update failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleEmailChange = async (event) => {
    event.preventDefault();
    setEmailChangeStatus("");
    try {
      setRequestingEmailChange(true);
      const res = await customerApi.put("/api/user/request-email-change", {
        email: emailChange.email.trim(),
        currentPassword: emailChange.currentPassword,
      });
      if (!res.data.success) {
        setEmailChangeStatus(res.data.message || "Không thể gửi yêu cầu đổi email.");
        return;
      }
      setEmailChangeStatus(res.data.message || `Hãy xác nhận địa chỉ ${res.data.email || emailChange.email}.`);
      setEmailChange({ email: "", currentPassword: "" });
    } catch (error) {
      setEmailChangeStatus(error.response?.data?.message || "Không thể gửi yêu cầu đổi email. Vui lòng thử lại.");
    } finally {
      setRequestingEmailChange(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (password.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    try {
      setSavingPassword(true);
      const res = await customerApi.put("/api/user/change-password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      if (res.data.success) {
        toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        setPassword({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        logoutCustomer();
        setShowLogin(true);
      } else {
        toast.error(res.data.message || "Change failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Change failed");
    } finally {
      setSavingPassword(false);
    }
  };

  if (!token) {
    return (
      <div className="profile-page">
        <EmptyState
          icon={LogIn}
          title="Sign in to manage your profile"
          description="Your account details, delivery address and security settings live behind your account."
          actionLabel="Sign in"
          onAction={() => setShowLogin(true)}
        />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <div className="profile-avatar-wrap">
          <Avatar src={user?.avatar} name={user?.name} size={96} />
          <button
            type="button"
            className="profile-avatar-edit"
            onClick={handleAvatarPick}
            disabled={uploadingAvatar}
            aria-label="Change avatar"
          >
            {uploadingAvatar ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Camera size={16} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
        </div>
        <div className="profile-hero-text">
          <h2>{user?.name || "Your account"}</h2>
          <p>{user?.email}</p>
        </div>
      </header>

      <div className="profile-tabs" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`profile-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="profile-panel">
        {activeTab === "info" && (
          <div className="profile-form-stack">
          <form className="profile-form" onSubmit={handleSaveInfo}>
            <div className="profile-field">
              <label htmlFor="pf-name">Full name</label>
              <input
                id="pf-name"
                type="text"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-current-email">Email hiện tại</label>
              <input
                id="pf-current-email"
                type="email"
                value={user?.email || ""}
                readOnly
                aria-readonly="true"
              />
              <span className="profile-field-help">Đổi email cần xác nhận qua địa chỉ mới.</span>
            </div>
            <div className="profile-field">
              <label htmlFor="pf-phone">Phone</label>
              <input
                id="pf-phone"
                type="tel"
                value={info.phone}
                onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                placeholder="Phone number"
                autoComplete="tel"
              />
            </div>
            <button type="submit" className="profile-save" disabled={savingInfo}>
              {savingInfo ? "Saving..." : "Save changes"}
            </button>
          </form>
          <form className="profile-form profile-email-change" onSubmit={handleEmailChange}>
            <div className="profile-form-heading">
              <h3>Đổi địa chỉ email</h3>
              <p>Email hiện tại chỉ thay đổi sau khi bạn mở liên kết xác nhận gửi tới email mới.</p>
            </div>
            <div className="profile-field">
              <label htmlFor="pf-new-email">Email mới</label>
              <input
                id="pf-new-email"
                type="email"
                value={emailChange.email}
                onChange={(event) => setEmailChange((current) => ({ ...current, email: event.target.value }))}
                autoComplete="email"
                required
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-email-password">Mật khẩu hiện tại</label>
              <input
                id="pf-email-password"
                type="password"
                value={emailChange.currentPassword}
                onChange={(event) => setEmailChange((current) => ({ ...current, currentPassword: event.target.value }))}
                autoComplete="current-password"
                required
              />
            </div>
            {emailChangeStatus ? <p className="profile-form-status" role="status">{emailChangeStatus}</p> : null}
            <button type="submit" className="profile-save" disabled={requestingEmailChange}>
              {requestingEmailChange ? "Đang gửi…" : "Gửi email xác nhận"}
            </button>
          </form>
          </div>
        )}

        {activeTab === "address" && (
          <AddressBookManager fullName={user?.name} onChange={handleAddressBookChange} />
        )}

        {activeTab === "security" && (
          <form className="profile-form" onSubmit={handleChangePassword}>
            <div className="profile-field">
              <label htmlFor="pf-cur-pass">Current password</label>
              <input
                id="pf-cur-pass"
                type="password"
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword({ ...password, currentPassword: e.target.value })
                }
                placeholder="Current password"
                autoComplete="current-password"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-new-pass">New password</label>
              <input
                id="pf-new-pass"
                type="password"
                value={password.newPassword}
                onChange={(e) =>
                  setPassword({ ...password, newPassword: e.target.value })
                }
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-confirm-pass">Confirm new password</label>
              <input
                id="pf-confirm-pass"
                type="password"
                value={password.confirmPassword}
                onChange={(e) =>
                  setPassword({ ...password, confirmPassword: e.target.value })
                }
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="profile-save"
              disabled={savingPassword}
            >
              {savingPassword ? "Saving..." : "Change password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Profile;
