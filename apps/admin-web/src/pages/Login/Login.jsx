import React, { useState, useContext } from "react";
import "./Login.css";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { AuthContext } from "../../context/AuthContext";

const Login = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await login(email, password);
      setLoading(false);
    } catch (error) {
      notificationService.error(
        "Đăng nhập không thành công",
        error.message || "Tài khoản hoặc mật khẩu không chính xác. Vui lòng thử lại.",
        {
          audience: "admin",
          priority: "high",
          key: "admin-login-failed",
          actions: [{ label: "Thử lại", onClick: onSubmit }],
        }
      );
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={onSubmit} className="login-form">
        <h2>Admin Login</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          disabled={loading}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          disabled={loading}
        />
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
