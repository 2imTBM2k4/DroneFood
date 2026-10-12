import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notificationService } from "@drone-food/web-ui/utils/toast";

export const AuthContext = createContext();

export const RESTAURANT_ROLES = [
  "restaurant_owner",
  "merchant_owner",
  "branch_manager",
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserInfo = async (token) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/api/user/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "User info endpoint not found - Check backend routes"
          );
        } else if (response.status === 401) {
          throw new Error("Unauthorized - Invalid token");
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response not JSON - Likely server error page");
      }
      const data = await response.json();

      if (data.success) {
        // FIX: Handle fallback cho data.data.user, data.user, hoặc data.data trực tiếp là user object
        let fetchedUser = data.data?.user || data.user || data.data;
        if (!fetchedUser || !fetchedUser._id) {
          throw new Error("User data is missing in response");
        }

        if (!RESTAURANT_ROLES.includes(fetchedUser.role)) {
          throw new Error("Tài khoản không có quyền truy cập giao diện Nhà hàng.");
        }

        if (
          fetchedUser.restaurantId &&
          typeof fetchedUser.restaurantId === "object"
        ) {
          fetchedUser.restaurantId =
            fetchedUser.restaurantId._id || fetchedUser.restaurantId.toString();
        }

        // Fetch balance tùy role. Sau migration multi-branch, chủ quán có role
        // "merchant_owner"; vẫn giữ "restaurant_owner" để tương thích ngược.
        const OWNER_ROLES = ["restaurant_owner", "merchant_owner"];
        if (fetchedUser.role === "admin") {
          fetchedUser.walletBalance = fetchedUser.balance || 0;
        } else if (OWNER_ROLES.includes(fetchedUser.role)) {
          let foundBalance = null;
          try {
            const balanceRes = await fetch(
              `${apiUrl}/api/restaurant-withdrawals/balance`,
              {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (balanceRes.ok) {
              const balanceJson = await balanceRes.json();
              foundBalance = balanceJson.data?.balance ?? balanceJson.balance ?? null;
            }
          } catch (e) {
            console.error("Fetch wallet balance error:", e);
          }

          if (fetchedUser.restaurantId) {
            try {
              const restaurantResponse = await fetch(
                `${apiUrl}/api/restaurant/${fetchedUser.restaurantId}`,
                {
                  method: "GET",
                  headers: { Authorization: `Bearer ${token}` },
                }
              );
              if (restaurantResponse.ok) {
                const restaurantData = await restaurantResponse.json();
                const restBalance =
                  restaurantData.data?.balance ?? restaurantData.balance;
                if (foundBalance === null && restBalance !== undefined) {
                  foundBalance = restBalance;
                }
                fetchedUser.restaurantImage =
                  restaurantData.data?.image || restaurantData.image || "";
              }
            } catch (e) {
              console.error("Fetch restaurant profile error:", e);
            }
          }
          fetchedUser.walletBalance = foundBalance ?? 0;
        } else {
          fetchedUser.walletBalance = 0;
        }

        setUser(fetchedUser);
        if (fetchedUser.restaurantId) {
          localStorage.setItem("restaurantId", fetchedUser.restaurantId);
        }
        return fetchedUser; // Return user để có thể check ngay
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("restaurantId");
        return null;
      }
    } catch (error) {
      console.error("Fetch user info error:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("restaurantId");
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal: "restaurant" }),
      });
      const data = await response.json();
      if (data.success) {
        const token = data.data?.token || data.token;
        const role = data.data?.role || data.role;
        if (!token) {
          throw new Error("Token missing in login response");
        }
        if (role && !RESTAURANT_ROLES.includes(role)) {
          notificationService.error(
            "Đăng nhập không thành công",
            "Tài khoản không có quyền truy cập giao diện Nhà hàng.",
            { audience: "restaurant", priority: "high", key: "restaurant-login-failed" }
          );
          localStorage.removeItem("token");
          localStorage.removeItem("restaurantId");
          setUser(null);
          return;
        }
        localStorage.setItem("token", token);
        const fetchedUser = await fetchUserInfo(token);
        // SỬA: Check user từ return value thay vì state (vì state update async)
        if (fetchedUser && fetchedUser._id) {
          // Delay navigation để toast kịp hiển thị
          setTimeout(() => {
            navigate("/dashboard");
          }, 500);
        } else {
          notificationService.warning(
            "Tài khoản chưa được kích hoạt",
            "Tài khoản nhà hàng của bạn đang chờ quản trị viên phê duyệt. Vui lòng quay lại sau.",
            { audience: "restaurant", key: "restaurant-login-pending" }
          );
          localStorage.removeItem("token");
          localStorage.removeItem("restaurantId");
          setUser(null);
        }
      } else {
        const msg = data.message || "Đăng nhập không thành công";
        notificationService.error(
          "Đăng nhập không thành công",
          msg.includes("pending") ? "Tài khoản nhà hàng của bạn đang chờ quản trị viên duyệt." : msg,
          { audience: "restaurant", priority: "high", key: "restaurant-login-failed" }
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      const errorMsg =
        error.message?.includes("quyền truy cập")
          ? error.message
          : error.message?.includes("pending") || error.message?.includes("locked")
          ? "Tài khoản nhà hàng đang chờ duyệt hoặc tạm khóa."
          : error.message || "Lỗi kết nối trong quá trình đăng nhập. Vui lòng thử lại.";
      notificationService.error(
        "Đăng nhập không thành công",
        errorMsg,
        { audience: "restaurant", priority: "high", key: "restaurant-login-error" }
      );
      localStorage.removeItem("token");
      localStorage.removeItem("restaurantId");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  const register = async (formData) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: "restaurant_owner",
        }),
      });
      const data = await response.json();
      if (data.success) {
        return data; // Success, không throw
      } else {
        // SỬA: Throw với message cụ thể
        throw new Error(data.message || "Register failed");
      }
    } catch (error) {
      console.error("Register error:", error);
      // SỬA: Re-throw với detail
      throw new Error(error.message || "Error during register");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("restaurantId");
    setUser(null);
    setIsLoading(false);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, login, register, logout, fetchUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
};
