import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { Loader2, Mail } from "lucide-react";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setMessage("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Đăng nhập thành công.");
    } catch (error) {
      if (error.code === "EMAIL_VERIFICATION_REQUIRED") {
        setMaskedEmail(error.email || email);
        setMessage(error.message || "Hãy xác minh email trước khi đăng nhập.");
        setMode("verify");
      } else {
        setMessage(error.message || "Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  const postEmailAction = async (event, endpoint) => {
    event.preventDefault();
    if (loading) return;
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Không thể gửi yêu cầu.");
      setMessage(data.message);
    } catch (cause) {
      setMessage(cause.message || "Không thể gửi yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setMessage("");
  };

  return (
    <main className="login-container">
      <form
        className="login-form"
        onSubmit={mode === "login" ? handleSubmit : (event) => postEmailAction(event, mode === "forgot" ? "/api/user/forgot-password" : "/api/user/resend-verification")}
        aria-busy={loading}
      >
        {mode === "verify" ? <div className="login-state-icon"><Mail size={28} aria-hidden="true" /></div> : null}
        <h1>{mode === "forgot" ? "Quên mật khẩu" : mode === "verify" ? "Xác minh email" : "Đăng nhập nhà hàng"}</h1>
        {mode === "forgot" ? <p>Nhập email tài khoản. Nếu tồn tại, hệ thống sẽ gửi liên kết dùng một lần trong 15 phút.</p> : null}
        {mode === "verify" ? <p>Hãy mở liên kết đã gửi tới <strong>{maskedEmail}</strong>. Sau khi xác minh, tài khoản vẫn cần được quản trị viên phê duyệt.</p> : null}

        <label htmlFor="restaurant-login-email">Email</label>
        <input id="restaurant-login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={loading} />
        {mode === "login" ? <><label htmlFor="restaurant-login-password">Mật khẩu</label><input id="restaurant-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={loading} /></> : null}

        {message ? <p className="login-status" role={mode === "login" ? "alert" : "status"}>{message}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? <><Loader2 size={17} className="login-spin" aria-hidden="true" /> Đang xử lý…</> : mode === "forgot" ? "Gửi hướng dẫn đặt lại" : mode === "verify" ? "Gửi lại email xác minh" : "Đăng nhập"}
        </button>
        <button type="button" className="login-link-button" disabled={loading} onClick={() => changeMode(mode === "login" ? "forgot" : "login")}>
          {mode === "login" ? "Quên mật khẩu?" : "Quay lại đăng nhập"}
        </button>
        {mode === "login" ? <p>Chưa có tài khoản? <a href="/register">Đăng ký ngay</a></p> : null}
      </form>
    </main>
  );
};

export default Login;
