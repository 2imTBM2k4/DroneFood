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
  const { token, customerApi, user, setUser, setShowLogin } = useContext(StoreContext);
  const [activeTab, setActiveTab] = useState("info");
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Each section owns its own form state and saving flag.
  const [info, setInfo] = useState({ name: "", email: "", phone: "" });
  const [savingInfo, setSavingInfo] = useState(false);

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
      email: user.email || "",
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
      const res = await customerApi.put("/api/user/profile", info);
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
        toast.success(res.data.message || "Password changed");
        setPassword({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
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
          <form className="profile-form" onSubmit={handleSaveInfo}>
            <div className="profile-field">
              <label htmlFor="pf-name">Full name</label>
              <input
                id="pf-name"
                type="text"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-email">Email</label>
              <input
                id="pf-email"
                type="email"
                value={info.email}
                onChange={(e) => setInfo({ ...info, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
            <div className="profile-field">
              <label htmlFor="pf-phone">Phone</label>
              <input
                id="pf-phone"
                type="tel"
                value={info.phone}
                onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <button type="submit" className="profile-save" disabled={savingInfo}>
              {savingInfo ? "Saving..." : "Save changes"}
            </button>
          </form>
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
