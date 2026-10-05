import React, { useState, useContext } from "react";
import "./Login.css";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";

const Login = () => {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [message, setMessage] = useState("");
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Login successful!");
      setLoading(false);
    } catch (error) {
      toast.error(error.message || "Login failed");
      setLoading(false);
    }
  };

  const onForgot = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/user/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Không thể gửi yêu cầu.");
      setMessage(data.message);
    } catch (error) {
      toast.error(error.message || "Không thể gửi yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={forgotMode ? onForgot : onSubmit} className="login-form">
        <h2>{forgotMode ? "Quên mật khẩu" : "Đăng nhập quản trị"}</h2>
        {forgotMode ? <p>Nhập email tài khoản. Nếu tồn tại, hệ thống sẽ gửi liên kết dùng một lần trong 15 phút.</p> : null}
        <label htmlFor="admin-login-email">Email</label>
        <input
          id="admin-login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          disabled={loading}
          autoComplete="email"
        />
        {!forgotMode ? <><label htmlFor="admin-login-password">Mật khẩu</label><input
          id="admin-login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          disabled={loading}
          autoComplete="current-password"
        /></> : null}
        {message ? <p className="login-status" role="status">{message}</p> : null}
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? "Đang xử lý…" : forgotMode ? "Gửi hướng dẫn đặt lại" : "Đăng nhập"}
        </button>
        <button type="button" className="login-link-button" disabled={loading} onClick={() => { setForgotMode((value) => !value); setMessage(""); }}>
          {forgotMode ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
        </button>
      </form>
    </div>
  );
};

export default Login;
