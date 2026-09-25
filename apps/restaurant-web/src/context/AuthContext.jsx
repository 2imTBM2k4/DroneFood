import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const AuthContext = createContext();

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

        if (
          fetchedUser.restaurantId &&
          typeof fetchedUser.restaurantId === "object"
        ) {
          fetchedUser.restaurantId =
            fetchedUser.restaurantId._id || fetchedUser.restaurantId.toString();
        }

        // Fetch balance tùy role
        if (fetchedUser.role === "admin") {
          fetchedUser.walletBalance = fetchedUser.balance || 0;
        } else if (
          fetchedUser.role === "restaurant_owner" &&
          fetchedUser.restaurantId
        ) {
          const restaurantResponse = await fetch(
            `${apiUrl}/api/restaurant/${fetchedUser.restaurantId}`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (restaurantResponse.ok) {
            const restaurantData = await restaurantResponse.json();
            // FIX: Handle consistent { success, data } hoặc direct data
            let restaurantBalance =
              restaurantData.data?.balance || restaurantData.balance || 0;
            fetchedUser.walletBalance = restaurantBalance;
            fetchedUser.restaurantImage = restaurantData.data?.image || restaurantData.image || "";
          } else {
            fetchedUser.walletBalance = 0;
          }
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
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        const token = data.data?.token || data.token;
        if (!token) {
          throw new Error("Token missing in login response");
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
          // User không tồn tại hoặc bị lock (đã được handle trong fetchUserInfo hoặc backend)
          toast.error(
            "Login failed: Account pending admin approval. Please wait."
          );
          localStorage.removeItem("token");
          localStorage.removeItem("restaurantId");
          setUser(null);
        }
      } else {
        // SỬA: Specific toast từ backend message
        const msg = data.message || "Login failed";
        toast.error(
          msg.includes("pending") ? "Your restaurant is pending approval." : msg
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error(
        error.message.includes("pending") || error.message.includes("locked")
          ? "Your restaurant account is pending admin approval."
          : "Error during login. Please try again."
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
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
