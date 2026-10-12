import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const fetchUserInfo = async (token) => {
    try {
      const response = await fetch(`${apiUrl}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - Invalid token");
        } else if (response.status === 404) {
          throw new Error("User info endpoint not found");
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response not JSON - Server error");
      }

      const data = await response.json();

      if (data.success) {
        const fetchedUser = data.data || data.user;
        if (!fetchedUser) {
          throw new Error("User data missing in response");
        }
        if (fetchedUser.role !== "admin") {
          throw new Error("Tài khoản không có quyền truy cập trang Quản trị.");
        }

        fetchedUser.walletBalance = fetchedUser.balance || 0;
        setUser(fetchedUser);
        localStorage.setItem("userRole", fetchedUser.role);
      } else {
        throw new Error(data.message || "Invalid user data");
      }
    } catch (error) {
      console.error("Fetch user error:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
      setUser(null);
      throw error;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token).catch(() => {}).finally(() => {
        setIsInitializing(false);
      });
    } else {
      setIsInitializing(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${apiUrl}/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal: "admin" }),
      });
      const data = await response.json();

      if (data.success) {
        const token = data.token;
        const role = data.role;
        if (!token) {
          throw new Error("Token missing in login response");
        }
        if (role !== "admin") {
          throw new Error("Tài khoản không có quyền truy cập trang Quản trị.");
        }
        localStorage.setItem("token", token);
        localStorage.setItem("userRole", role);
        await fetchUserInfo(token);
        setTimeout(() => {
          navigate("/");
        }, 500);
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (error) {
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
      setUser(null);
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setIsInitializing(false);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isInitializing, login, logout, fetchUserInfo }}
    >
      {children}
    </AuthContext.Provider>
  );
};
