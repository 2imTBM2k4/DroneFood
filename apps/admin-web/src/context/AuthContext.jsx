import React, { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const fetchUserInfo = async (token) => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token).catch(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

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
        const token = data.token;
        const role = data.role;
        if (!token) {
          throw new Error("Token missing in login response");
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
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setIsLoading(false);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, fetchUserInfo }}
    >
      {children}
    </AuthContext.Provider>
  );
};
