import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import "./EditRestaurant.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { AuthContext } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import DroneDelivery from "../DroneDelivery/DroneDelivery.jsx";
import BrandUpgrade from "./BrandUpgrade.jsx";
import {
  User,
  MapPin,
  Shield,
  Plane,
  Building2,
  Loader2,
  Pencil,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Store,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Clock,
} from "lucide-react";

const EditRestaurant = ({ url = import.meta.env.VITE_API_URL || "http://localhost:4000" }) => {
  const { user, fetchUserInfo } = useContext(AuthContext);
  const { branches, currentBranch, refreshBranches } = useBranch();

  const isBranchManager = user?.role === "branch_manager";
  const isMerchantOwner = user?.role === "merchant_owner" || user?.role === "admin";
  const targetBranch = isBranchManager ? currentBranch || branches[0] : null;

  // ── DANH SÁCH TAB ĐƯỢC PHÂN THEO VAI TRÒ ────────────────────────────────
  // Quản lý chi nhánh: Hồ sơ chi nhánh, Địa chỉ chi nhánh, Drone chi nhánh, Bảo mật
  // Quản lý thương hiệu: Hồ sơ thương hiệu, Pháp lý chuỗi, Bảo mật (Không can thiệp địa chỉ/drone từng chi nhánh)
  // Quán đơn lẻ (restaurant_owner): Giữ nguyên danh mục đầy đủ
  const tabs = isBranchManager
    ? [
        { id: "info", label: "Hồ sơ chi nhánh", icon: Store },
        { id: "address", label: "Địa chỉ chi nhánh", icon: MapPin },
        { id: "drone", label: "Giao hàng bằng drone", icon: Plane },
        { id: "security", label: "Bảo mật", icon: Shield },
      ]
    : isMerchantOwner
    ? [
        { id: "info", label: "Hồ sơ thương hiệu", icon: Building2 },
        { id: "brand", label: "Pháp lý chuỗi", icon: ShieldCheck },
        { id: "security", label: "Bảo mật", icon: Shield },
      ]
    : [
        { id: "info", label: "Thông tin cá nhân", icon: User },
        { id: "brand", label: "Chuỗi thương hiệu", icon: Building2 },
        { id: "address", label: "Địa chỉ quán", icon: MapPin },
        { id: "drone", label: "Giao hàng bằng drone", icon: Plane },
        { id: "security", label: "Bảo mật", icon: Shield },
      ];

  const validTabs = tabs.map((t) => t.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    validTabs.includes(tabFromUrl) ? tabFromUrl : "info"
  );
  const [subView, setSubView] = useState("overview"); // "overview" | "name" | "phone" | "email" | "description" | "address" | "hours"

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!validTabs.includes(activeTab)) {
      setActiveTab("info");
    }
  }, [searchParams, isBranchManager, isMerchantOwner]);

  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [image, setImage] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [merchant, setMerchant] = useState(null);

  const [data, setData] = useState({
    name: "",
    code: "",
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
  const [togglingOpen, setTogglingOpen] = useState(false);

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

  // ── LẤY DỮ LIỆU THƯƠNG HIỆU CHO QUẢN LÝ THƯƠNG HIỆU ──────────────────────
  const fetchMerchant = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${url}/api/merchant/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        const m = response.data.data?.merchant || response.data.data;
        setMerchant(m);
        setData({
          name: m?.name || "",
          code: "",
          address: "",
          email: user?.email || "",
          phone: user?.phone || m?.brandApplication?.phone || "",
          description: m?.description || "",
          openTime: "07:00",
          closeTime: "22:00",
          isOpen: true,
        });
        setCurrentImageUrl(m?.logoUrl || null);
        setImage(null);
      }
    } catch (error) {
      console.error("Error fetching merchant profile:", error);
    } finally {
      setLoading(false);
    }
  }, [url, user]);

  // ── LẤY DỮ LIỆU QUÁN ĐƠN LẺ CHO RESTAURANT_OWNER CŨ ───────────────────────
  const fetchRestaurant = useCallback(async (restaurantId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/restaurant/${restaurantId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.data.success) {
        const myRestaurant = response.data.data;
        if (myRestaurant) {
          setData({
            name: myRestaurant.name || "",
            code: "",
            address: myRestaurant.address || "",
            email: user?.email || myRestaurant.email || "",
            phone: myRestaurant.phone || user?.phone || "",
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
  }, [url, user]);

  useEffect(() => {
    if (isBranchManager) {
      if (targetBranch) {
        setData({
          name: targetBranch.name || "",
          code: targetBranch.code || "",
          address: targetBranch.address?.text || (typeof targetBranch.address === "string" ? targetBranch.address : ""),
          email: user?.email || "",
          phone: targetBranch.phone || user?.phone || "",
          description: `Chi nhánh ${targetBranch.code || ""} do bạn trực tiếp quản lý`,
          openTime: targetBranch.operatingHours?.[0]?.open || "07:00",
          closeTime: targetBranch.operatingHours?.[0]?.close || "22:00",
          isOpen: targetBranch.isOpen !== false,
        });
        setCurrentImageUrl(targetBranch.images?.[0] || null);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } else if (isMerchantOwner) {
      fetchMerchant();
    } else {
      const restaurantId = getRestaurantId();
      if (restaurantId) {
        fetchRestaurant(restaurantId);
      } else {
        setLoading(false);
      }
    }
  }, [user, isBranchManager, isMerchantOwner, targetBranch, fetchMerchant, fetchRestaurant]);

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
    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("address", data.address);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    formData.append("description", data.description);
    formData.append("image", file);

    try {
      setUploadingImage(true);
      // Route PUT /api/restaurant/:id hỗ trợ multipart upload và tự động sync sang Merchant.logoUrl
      const targetId = restaurantId || merchant?._id;
      if (!targetId) return;

      const response = await axios.put(`${url}/api/restaurant/${targetId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        notificationService.success("Cập nhật ảnh đại diện thành công!", undefined, {
          audience: "restaurant",
        });
        setImage(null);
        if (isMerchantOwner) {
          await fetchMerchant();
        } else if (restaurantId) {
          await fetchRestaurant(restaurantId);
        }
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

  // ── XỬ LÝ CẬP NHẬT TỪNG TRƯỜNG DỮ LIỆU THEO PHÂN QUYỀN VAI TRÒ ─────────────
  const handleUpdateField = async (field, value) => {
    // 1. Cập nhật EMAIL đăng nhập (cho mọi vai trò)
    if (field === "email") {
      const normalizedEmail = (value || "").trim().toLowerCase();
      if (!normalizedEmail) {
        notificationService.error("Không thể cập nhật", "Vui lòng nhập địa chỉ email hợp lệ.", {
          audience: "restaurant",
          priority: "high",
        });
        return;
      }
      try {
        setSavingField(true);
        const token = localStorage.getItem("token");

        // Cập nhật User.email dùng cho đăng nhập
        const userRes = await axios.put(
          `${url}/api/user/profile`,
          { email: normalizedEmail },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!userRes.data?.success) {
          throw new Error(userRes.data?.message || "Không thể cập nhật email tài khoản.");
        }

        // Đồng bộ Restaurant.email nếu có
        const restaurantId = getRestaurantId();
        if (!isBranchManager && restaurantId) {
          const formData = new FormData();
          formData.append("email", normalizedEmail);
          try {
            await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data",
              },
            });
          } catch (syncErr) {
            console.warn("Không thể đồng bộ email sang nhà hàng legacy:", syncErr);
          }
        }

        setData((prev) => ({ ...prev, email: normalizedEmail }));
        notificationService.success(
          "Cập nhật email thành công!",
          "Từ lần đăng nhập tiếp theo, vui lòng sử dụng email mới này.",
          { audience: "restaurant" }
        );
        setSubView("overview");
        if (token && fetchUserInfo) {
          fetchUserInfo(token);
        }
      } catch (err) {
        notificationService.error(
          "Không thể cập nhật email",
          err.response?.data?.message || err.message || "Lỗi khi lưu email mới.",
          { audience: "restaurant", priority: "high" }
        );
      } finally {
        setSavingField(false);
      }
      return;
    }

    // 2. Cập nhật cho QUẢN LÝ CHI NHÁNH (branch_manager)
    if (isBranchManager) {
      if (!targetBranch?._id) return;
      try {
        setSavingField(true);
        const token = localStorage.getItem("token");
        const payload = {};
        if (field === "name") payload.name = value.trim();
        if (field === "phone") payload.phone = value.trim();
        if (field === "address") payload.address = { text: value.trim() };

        const response = await axios.put(`${url}/api/branch/${targetBranch._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          setData((prev) => ({ ...prev, [field]: value }));
          // Nếu đổi số điện thoại, đồng bộ vào hồ sơ người dùng để tiện liên lạc
          if (field === "phone" && value) {
            try {
              await axios.put(
                `${url}/api/user/profile`,
                { phone: value.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch {
              // Bỏ qua lỗi phụ
            }
          }
          notificationService.success("Cập nhật thông tin chi nhánh thành công!", undefined, {
            audience: "restaurant",
          });
          setSubView("overview");
          refreshBranches();
        } else {
          notificationService.error(
            "Không thể cập nhật",
            response.data.message || "Lỗi khi lưu thông tin chi nhánh.",
            { audience: "restaurant", priority: "high" }
          );
        }
      } catch (err) {
        notificationService.error(
          "Không thể cập nhật",
          err.response?.data?.message || err.message || "Lỗi khi lưu thông tin chi nhánh.",
          { audience: "restaurant", priority: "high" }
        );
      } finally {
        setSavingField(false);
      }
      return;
    }

    // 3. Cập nhật cho QUẢN LÝ THƯƠNG HIỆU (merchant_owner)
    if (isMerchantOwner) {
      const token = localStorage.getItem("token");
      try {
        setSavingField(true);

        if (field === "phone") {
          // Lưu phone vào user profile
          await axios.put(
            `${url}/api/user/profile`,
            { phone: value.trim() },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setData((prev) => ({ ...prev, phone: value.trim() }));
          notificationService.success("Cập nhật số điện thoại thành công!", undefined, {
            audience: "restaurant",
          });
          setSubView("overview");
          if (fetchUserInfo) fetchUserInfo(token);
          return;
        }

        if (field === "name" || field === "description") {
          const merchantId = merchant?._id;
          if (merchantId) {
            const updatePayload = { [field]: value.trim() };
            const res = await axios.put(`${url}/api/merchant/${merchantId}`, updatePayload, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
              setData((prev) => ({ ...prev, [field]: value.trim() }));
              // Đồng bộ tên vào Restaurant nếu có
              const restaurantId = getRestaurantId();
              if (restaurantId && field === "name") {
                const formData = new FormData();
                formData.append("name", value.trim());
                try {
                  await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "multipart/form-data",
                    },
                  });
                } catch {
                  // Bỏ qua lỗi phụ
                }
              }
              notificationService.success("Cập nhật hồ sơ thương hiệu thành công!", undefined, {
                audience: "restaurant",
              });
              setSubView("overview");
              await fetchMerchant();
              if (fetchUserInfo) fetchUserInfo(token);
              return;
            }
          }
        }
      } catch (err) {
        notificationService.error(
          "Không thể cập nhật hồ sơ thương hiệu",
          err.response?.data?.message || err.message || "Lỗi khi lưu thông tin.",
          { audience: "restaurant", priority: "high" }
        );
      } finally {
        setSavingField(false);
      }
      return;
    }

    // 4. Cập nhật cho QUÁN ĐƠN LẺ CŨ (restaurant_owner)
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
      const token = localStorage.getItem("token");
      const response = await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setData(updated);
        if (field === "phone" && value) {
          try {
            await axios.put(
              `${url}/api/user/profile`,
              { phone: value.trim() },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch {
            // Bỏ qua
          }
        }
        notificationService.success("Cập nhật thành công!", undefined, { audience: "restaurant" });
        setSubView("overview");
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

  // ── XỬ LÝ BẬT/TẮT MỞ CỬA NHẬN ĐƠN CHI NHÁNH (branch_manager) ──────────────
  const handleToggleBranchOpen = async () => {
    if (!targetBranch?._id) return;
    try {
      setTogglingOpen(true);
      const nextState = !data.isOpen;
      const res = await axios.patch(
        `${url}/api/branch/${targetBranch._id}/open-state`,
        { isOpen: nextState },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (res.data.success) {
        setData((prev) => ({ ...prev, isOpen: nextState }));
        notificationService.success(
          nextState ? "Chi nhánh đã mở cửa nhận đơn" : "Chi nhánh đã tạm ngưng nhận đơn",
          undefined,
          { audience: "restaurant" }
        );
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Không thể đổi trạng thái mở cửa",
        err.response?.data?.message || err.message,
        { audience: "restaurant", priority: "high" }
      );
    } finally {
      setTogglingOpen(false);
    }
  };

  // ── ĐỔI MẬT KHẨU TÀI KHOẢN ────────────────────────────────────────────────
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
    merchant?.logoUrl ||
    user?.restaurantImage ||
    user?.restaurant?.image ||
    assets.profile_image;

  return (
    <div className="profile-page">
      <div className="profile-layout-container">
        {/* Menu bên trái */}
        <aside className="profile-sidebar" aria-label="Menu tài khoản">
          <nav className="profile-sidebar-nav" role="tablist">
            {tabs.map((tab) => {
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
                    setSearchParams({ tab: tab.id });
                  }}
                >
                  <Icon size={18} className="profile-sidebar-icon" />
                  <span className="profile-sidebar-label">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Nội dung bên phải */}
        <main className="profile-main-content">
          {/* TAB 1: THÔNG TIN HỒ SƠ (Thương hiệu hoặc Chi nhánh) */}
          {activeTab === "info" && (
            <>
              {/* SUBVIEW: OVERVIEW */}
              {subView === "overview" && (
                <div className="profile-overview-view">
                  <h1 className="profile-page-title">
                    {isBranchManager
                      ? "Hồ sơ chi nhánh"
                      : isMerchantOwner
                      ? "Hồ sơ thương hiệu"
                      : "Thông tin cá nhân"}
                  </h1>

                  <div className="profile-avatar-container">
                    <div className="profile-avatar-disc">
                      <img src={avatarSource} alt="Avatar" className="profile-avatar-img" />
                      {!isBranchManager && (
                        <button
                          type="button"
                          className="profile-avatar-badge-btn"
                          onClick={handleAvatarPick}
                          disabled={uploadingImage}
                          aria-label="Thay đổi ảnh đại diện / Logo"
                          title="Thay đổi ảnh đại diện / Logo"
                        >
                          {uploadingImage ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Pencil size={15} color="#111827" />
                          )}
                        </button>
                      )}
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
                        <span className="profile-row-label">
                          {isBranchManager ? "Tên chi nhánh" : "Tên thương hiệu"}
                        </span>
                        <span className="profile-row-value">{data.name || "Chưa thiết lập"}</span>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 1.5: Mã chi nhánh (chỉ dành cho Branch Manager) */}
                    {isBranchManager && (
                      <div className="profile-row-item" style={{ cursor: "default" }}>
                        <div className="profile-row-text">
                          <span className="profile-row-label">Mã chi nhánh</span>
                          <span
                            className="profile-row-value"
                            style={{
                              fontWeight: 600,
                              color: "#2563eb",
                              backgroundColor: "#eff6ff",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              display: "inline-block",
                              width: "fit-content",
                            }}
                          >
                            {data.code || targetBranch?.code || "MAIN"}
                          </span>
                        </div>
                      </div>
                    )}

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
                        <span className="profile-row-label">
                          {isBranchManager ? "Số điện thoại chi nhánh" : "Số điện thoại đại diện"}
                        </span>
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

                    {/* Row 3: Email đăng nhập */}
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
                        <span className="profile-row-label">Email tài khoản đăng nhập</span>
                        <div className="profile-row-value-group">
                          <span className="profile-row-value">{data.email || "Chưa thiết lập"}</span>
                          <span className="profile-status-icon verified" title="Email đăng nhập">
                            <CheckCircle2 size={16} />
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="profile-row-chevron" />
                    </div>

                    {/* Row 4: Mô tả thương hiệu (Quản lý thương hiệu hoặc Quán đơn lẻ) */}
                    {!isBranchManager && (
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
                          <span className="profile-row-label">Mô tả thương hiệu</span>
                          <span className="profile-row-value">{data.description || "Chưa thiết lập mô tả"}</span>
                        </div>
                        <ChevronRight size={20} className="profile-row-chevron" />
                      </div>
                    )}

                    {/* Row 5: Trạng thái mở cửa chi nhánh (Dành cho Branch Manager) */}
                    {isBranchManager && (
                      <div
                        className="profile-row-item"
                        onClick={handleToggleBranchOpen}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleToggleBranchOpen()}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="profile-row-text">
                          <span className="profile-row-label">Trạng thái nhận đơn</span>
                          <div className="profile-row-value-group">
                            <span
                              className="profile-row-value"
                              style={{
                                color: data.isOpen ? "#16a34a" : "#dc2626",
                                fontWeight: 600,
                              }}
                            >
                              {data.isOpen ? "Đang mở cửa nhận đơn" : "Tạm ngưng nhận đơn"}
                            </span>
                          </div>
                        </div>
                        {togglingOpen ? (
                          <Loader2 size={20} className="spin" />
                        ) : data.isOpen ? (
                          <ToggleRight size={28} color="#16a34a" />
                        ) : (
                          <ToggleLeft size={28} color="#9ca3af" />
                        )}
                      </div>
                    )}

                    {/* Row 6: Mô hình kinh doanh (Dành cho Merchant Owner) */}
                    {isMerchantOwner && (
                      <div
                        className="profile-row-item"
                        onClick={() => {
                          setActiveTab("brand");
                          setSearchParams({ tab: "brand" });
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setActiveTab("brand")}
                      >
                        <div className="profile-row-text">
                          <span className="profile-row-label">Mô hình kinh doanh</span>
                          <div className="profile-row-value-group">
                            <span className="profile-row-value">Chuỗi thương hiệu đa chi nhánh</span>
                            <span className="profile-status-icon verified" title="Chuỗi thương hiệu đã kích hoạt">
                              <CheckCircle2 size={16} />
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="profile-row-chevron" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBVIEW: SỬA TÊN */}
              {subView === "name" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">
                    {isBranchManager ? "Tên chi nhánh" : "Tên thương hiệu"}
                  </h1>
                  <p className="profile-sub-desc">
                    {isBranchManager
                      ? "Tên gọi của chi nhánh hiển thị cho khách hàng khi chọn điểm đặt món."
                      : "Tên thương hiệu ẩm thực chính thức của chuỗi hiển thị công khai cho thực khách."}
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
                        {isBranchManager ? "Tên chi nhánh" : "Tên thương hiệu"}
                      </label>
                      <div className={`profile-input-box ${isFieldFocused ? "is-focused" : "is-idle"}`}>
                        <input
                          id="pf-restaurant-name"
                          type="text"
                          value={editFieldState}
                          onFocus={() => setIsFieldFocused(true)}
                          onBlur={() => setIsFieldFocused(false)}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="Nhập tên"
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

              {/* SUBVIEW: SỬA SỐ ĐIỆN THOẠI */}
              {subView === "phone" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Số điện thoại liên hệ</h1>
                  <p className="profile-sub-desc">
                    {isBranchManager
                      ? "Số điện thoại chi nhánh để tài xế drone và khách hàng liên hệ khi nhận món."
                      : "Số điện thoại đại diện chủ thương hiệu để nhận thông báo và hỗ trợ từ quản trị viên."}
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

              {/* SUBVIEW: SỬA EMAIL ĐĂNG NHẬP */}
              {subView === "email" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Địa chỉ Email tài khoản</h1>
                  <p className="profile-sub-desc">
                    Email dùng để đăng nhập vào trang quản lý và nhận các thông báo vận hành hệ thống.
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      marginBottom: "18px",
                      fontSize: "13px",
                      color: "#1e40af",
                      lineHeight: "1.45",
                    }}
                  >
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#2563eb" }} />
                    <span>
                      <strong>Lưu ý quan trọng:</strong> Sau khi cập nhật, email này sẽ trở thành tên đăng nhập mới của bạn. Khi đăng xuất, hãy dùng email này để đăng nhập lại vào hệ thống.
                    </span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleUpdateField("email", editFieldState);
                    }}
                    className="profile-name-form"
                  >
                    <div className="profile-field-block">
                      <label htmlFor="pf-restaurant-email" className="profile-field-label">
                        Email đăng nhập mới
                      </label>
                      <div className={`profile-input-box ${isFieldFocused ? "is-focused" : "is-idle"}`}>
                        <input
                          id="pf-restaurant-email"
                          type="email"
                          value={editFieldState}
                          onFocus={() => setIsFieldFocused(true)}
                          onBlur={() => setIsFieldFocused(false)}
                          onChange={(e) => setEditFieldState(e.target.value)}
                          placeholder="email@example.com"
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
                      {savingField ? <Loader2 size={16} className="spin" /> : "Lưu & Cập nhật email đăng nhập"}
                    </button>
                  </form>
                </div>
              )}

              {/* SUBVIEW: SỬA MÔ TẢ */}
              {subView === "description" && !isBranchManager && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">Mô tả thương hiệu</h1>
                  <p className="profile-sub-desc">
                    Giới thiệu phong cách ẩm thực, câu chuyện thương hiệu hoặc điểm nổi bật để thu hút khách hàng.
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
                          placeholder="Nhập thông tin giới thiệu thương hiệu..."
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

          {/* TAB 2: ĐỊA CHỈ & GIỜ HOẠT ĐỘNG (Dành cho Quản lý chi nhánh & Quán đơn lẻ) */}
          {activeTab === "address" && !isMerchantOwner && (
            <>
              {subView === "overview" && (
                <div className="profile-overview-view">
                  <h1 className="profile-page-title">
                    {isBranchManager ? "Địa chỉ chi nhánh" : "Địa chỉ quán"}
                  </h1>
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
                        <span className="profile-row-label">
                          {isBranchManager ? "Địa chỉ chi nhánh" : "Địa chỉ quán"}
                        </span>
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

              {/* SUBVIEW: SỬA ĐỊA CHỈ */}
              {subView === "address" && (
                <div className="profile-sub-view">
                  <button type="button" className="profile-back-action" onClick={() => setSubView("overview")}>
                    <ArrowLeft size={18} />
                    <span>Quay lại</span>
                  </button>

                  <h1 className="profile-sub-title">
                    {isBranchManager ? "Địa chỉ chi nhánh" : "Địa chỉ quán"}
                  </h1>
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

              {/* SUBVIEW: SỬA GIỜ HOẠT ĐỘNG */}
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
                      try {
                        setSavingField(true);
                        const token = localStorage.getItem("token");

                        if (isBranchManager && targetBranch?._id) {
                          const payload = {
                            operatingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
                              day,
                              open: editHoursState.openTime,
                              close: editHoursState.closeTime,
                            })),
                          };
                          const res = await axios.put(`${url}/api/branch/${targetBranch._id}`, payload, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.data.success) {
                            setData((prev) => ({
                              ...prev,
                              openTime: editHoursState.openTime,
                              closeTime: editHoursState.closeTime,
                            }));
                            notificationService.success("Cập nhật giờ hoạt động chi nhánh thành công!", undefined, {
                              audience: "restaurant",
                            });
                            setSubView("overview");
                            refreshBranches();
                          }
                        } else {
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

                          const res = await axios.put(`${url}/api/restaurant/${restaurantId}`, formData, {
                            headers: {
                              Authorization: `Bearer ${token}`,
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                      <div className="profile-field-block">
                        <label className="profile-field-label">Giờ mở cửa</label>
                        <div className="profile-input-box is-idle">
                          <input
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
                        <label className="profile-field-label">Giờ đóng cửa</label>
                        <div className="profile-input-box is-idle">
                          <input
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
                      {savingField ? <Loader2 size={16} className="spin" /> : "Cập nhật giờ hoạt động"}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* TAB 3: GIAO HÀNG BẰNG DRONE (Chỉ dành cho Branch Manager & Quán đơn lẻ) */}
          {activeTab === "drone" && !isMerchantOwner && (
            <div className="profile-overview-view profile-drone-section">
              <DroneDelivery url={url} embedded={true} />
            </div>
          )}

          {/* TAB 4: BẢO MẬT TÀI KHOẢN (Cho mọi vai trò) */}
          {activeTab === "security" && (
            <div className="profile-overview-view">
              <h1 className="profile-page-title">Bảo mật tài khoản</h1>
              <p className="profile-sub-desc" style={{ marginBottom: 24 }}>
                Quản lý mật khẩu để bảo vệ an toàn cho tài khoản của bạn.
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

          {/* TAB 5: PHÁP LÝ CHUỖI / NÂNG CẤP CHUỖI THƯƠNG HIỆU */}
          {activeTab === "brand" && !isBranchManager && (
            <div className="profile-overview-view">
              <h1 className="profile-page-title">
                {isMerchantOwner ? "Hồ sơ pháp lý chuỗi thương hiệu" : "Nâng cấp chuỗi thương hiệu"}
              </h1>
              <p className="profile-sub-desc" style={{ marginBottom: 20 }}>
                {isMerchantOwner
                  ? "Thông tin pháp lý, mã số thuế và hồ sơ đại diện của chuỗi thương hiệu."
                  : "Đăng ký nâng cấp từ quán cá nhân lên chuỗi thương hiệu đa chi nhánh để mở rộng quy mô kinh doanh."}
              </p>
              <BrandUpgrade
                url={url}
                onUpgradeSuccess={() => {
                  const token = localStorage.getItem("token");
                  if (token && fetchUserInfo) fetchUserInfo(token);
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default EditRestaurant;
