import { useContext, useEffect, useRef, useState } from "react";
import "./LoginPopup.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, X } from "lucide-react";

const VERIFICATION_REQUIRED = "EMAIL_VERIFICATION_REQUIRED";

const LoginPopup = ({ setShowLogin }) => {
  const { url, setToken, resetCustomerSessionExpiry } = useContext(StoreContext);
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const [currState, setCurrState] = useState("Login");
  const [data, setData] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verification, setVerification] = useState({ email: "", maskedEmail: "", message: "" });
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowLogin(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button, input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.querySelector("input, button")?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currState, setShowLogin]);

  const switchState = (nextState) => {
    setCurrState(nextState);
    setAuthError("");
    setForgotSent(false);
    setForgotError("");
    setResendMessage("");
  };

  const switchToForgot = () => {
    setForgotEmail(data.email);
    switchState("Forgot");
  };

  const onChangeHandler = (event) => {
    const { name, value } = event.target;
    setData((current) => ({ ...current, [name]: value }));
    setAuthError("");
  };

  const showVerificationPending = (payload, email) => {
    setVerification({
      email,
      maskedEmail: payload.email || email,
      message: payload.message || "Hãy kiểm tra hộp thư để xác minh tài khoản.",
    });
    setResendMessage("");
    setCurrState("VerifyPending");
  };

  const onLogin = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setAuthError("");
    setSubmitting(true);
    const isLogin = currState === "Login";
    const postData = isLogin
      ? { email: data.email.trim(), password: data.password }
      : { ...data, email: data.email.trim(), role: "user" };

    try {
      const endpoint = isLogin ? "/api/user/login" : "/api/user/register";
      const response = await axios.post(`${url}${endpoint}`, postData);
      if (!response.data.success) {
        setAuthError(response.data.message || "Không thể xử lý yêu cầu.");
        return;
      }
      if (!isLogin && response.data.verificationRequired) {
        showVerificationPending(response.data, data.email.trim());
        return;
      }
      if (!response.data.token) {
        setAuthError("Phản hồi đăng nhập không có mã phiên. Vui lòng thử lại.");
        return;
      }
      setToken(response.data.token);
      localStorage.setItem("token", response.data.token);
      if (response.data.refreshToken) localStorage.setItem("refreshToken", response.data.refreshToken);
      else localStorage.removeItem("refreshToken");
      resetCustomerSessionExpiry();
      setShowLogin(false);
      navigate("/");
    } catch (error) {
      const payload = error?.response?.data;
      if (payload?.code === VERIFICATION_REQUIRED) {
        showVerificationPending(payload, data.email.trim());
      } else {
        setAuthError(payload?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (resending || !verification.email) return;
    setResending(true);
    setResendMessage("");
    try {
      const response = await axios.post(`${url}/api/user/resend-verification`, {
        email: verification.email,
      });
      setResendMessage(response.data.message || "Nếu tài khoản đang chờ xác minh, email mới đã được gửi.");
    } catch (error) {
      setResendMessage(error?.response?.data?.message || "Chưa thể gửi lại email. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  };

  const onForgotPassword = async (event) => {
    event.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const response = await axios.post(`${url}/api/user/forgot-password`, { email: forgotEmail.trim() });
      if (response.data.success) setForgotSent(true);
      else setForgotError(response.data.message || "Không thể gửi yêu cầu. Vui lòng thử lại.");
    } catch (error) {
      setForgotError(error?.response?.data?.message || "Không thể gửi yêu cầu. Vui lòng thử lại.");
    } finally {
      setForgotLoading(false);
    }
  };

  if (currState === "VerifyPending") {
    return (
      <div className="apple-modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowLogin(false)}>
        <section className="apple-modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="verification-pending-title">
          <div className="apple-modal-header">
            <button type="button" className="apple-modal-back-btn" onClick={() => switchState("Login")} aria-label="Quay lại đăng nhập">
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" className="apple-modal-close-btn button-icon-circular" onClick={() => setShowLogin(false)} aria-label="Đóng">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="apple-forgot-success" aria-live="polite">
            <div className="apple-forgot-icon"><Mail size={32} aria-hidden="true" /></div>
            <h2 id="verification-pending-title" className="apple-forgot-success-title">Xác minh email để tiếp tục</h2>
            <p className="apple-forgot-desc">{verification.message}</p>
            <p className="apple-verification-email">{verification.maskedEmail}</p>
            {resendMessage ? <p className="apple-modal-status" role="status">{resendMessage}</p> : null}
            <button type="button" className="btn-apple-primary button-primary apple-modal-action" onClick={resendVerification} disabled={resending}>
              {resending ? <><Loader2 size={16} className="spin-icon" aria-hidden="true" /> Đang gửi…</> : "Gửi lại email xác minh"}
            </button>
            <button type="button" className="apple-text-link apple-text-link-button" onClick={() => switchState("Sign Up")}>Sửa thông tin đăng ký</button>
          </div>
        </section>
      </div>
    );
  }

  if (currState === "Forgot") {
    return (
      <div className="apple-modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowLogin(false)}>
        <form onSubmit={onForgotPassword} className="apple-modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="forgot-title">
          <div className="apple-modal-header">
            <button type="button" className="apple-modal-back-btn" onClick={() => switchState("Login")} aria-label="Quay lại đăng nhập"><ArrowLeft size={18} aria-hidden="true" /></button>
            <h2 id="forgot-title" className="apple-modal-title">Quên mật khẩu</h2>
            <button type="button" className="apple-modal-close-btn button-icon-circular" onClick={() => setShowLogin(false)} aria-label="Đóng"><X size={16} aria-hidden="true" /></button>
          </div>
          {forgotSent ? (
            <div className="apple-forgot-success">
              <div className="apple-forgot-icon"><Mail size={32} aria-hidden="true" /></div>
              <h3 className="apple-forgot-success-title">Kiểm tra email của bạn</h3>
              <p className="apple-forgot-desc">Nếu <strong>{forgotEmail}</strong> tồn tại trong hệ thống, Drone Food đã gửi hướng dẫn đặt lại mật khẩu. Liên kết có hiệu lực trong 15 phút.</p>
              <button type="button" className="btn-apple-primary button-primary" onClick={() => switchState("Login")}>Quay lại đăng nhập</button>
            </div>
          ) : (
            <>
              <p className="apple-modal-desc">Nhập email tài khoản. Vì lý do bảo mật, kết quả luôn giống nhau dù email có tồn tại hay không.</p>
              <div className="apple-modal-inputs">
                <label className="apple-modal-label" htmlFor="forgot-email">Email</label>
                <input id="forgot-email" onChange={(event) => setForgotEmail(event.target.value)} value={forgotEmail} type="email" className="apple-modal-input" required autoComplete="email" aria-describedby={forgotError ? "forgot-error" : undefined} />
              </div>
              {forgotError ? <p id="forgot-error" className="apple-modal-error" role="alert">{forgotError}</p> : null}
              <button type="submit" disabled={forgotLoading} className="btn-apple-primary button-primary apple-modal-action">
                {forgotLoading ? <><Loader2 size={16} className="spin-icon" aria-hidden="true" /> Đang gửi…</> : "Gửi hướng dẫn đặt lại"}
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

  const signingUp = currState === "Sign Up";
  return (
    <div className="apple-modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowLogin(false)}>
      <form onSubmit={onLogin} className="apple-modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="apple-modal-header">
          <h2 id="auth-title" className="apple-modal-title">{signingUp ? "Tạo tài khoản" : "Đăng nhập Drone Food"}</h2>
          <button type="button" className="apple-modal-close-btn button-icon-circular" onClick={() => setShowLogin(false)} aria-label="Đóng"><X size={16} aria-hidden="true" /></button>
        </div>
        <p className="apple-modal-desc">{signingUp ? "Đăng ký rồi xác minh email để bắt đầu đặt món." : "Đăng nhập để theo dõi đơn hàng và lịch sử giao hàng."}</p>
        <div className="apple-modal-inputs">
          {signingUp ? <><label className="apple-modal-label" htmlFor="auth-name">Họ và tên</label><input id="auth-name" name="name" onChange={onChangeHandler} value={data.name} type="text" className="apple-modal-input" required autoComplete="name" /></> : null}
          <label className="apple-modal-label" htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" onChange={onChangeHandler} value={data.email} type="email" className="apple-modal-input" required autoComplete="email" />
          <label className="apple-modal-label" htmlFor="auth-password">Mật khẩu</label>
          <input id="auth-password" name="password" onChange={onChangeHandler} value={data.password} type="password" className="apple-modal-input" required minLength={signingUp ? 8 : undefined} autoComplete={signingUp ? "new-password" : "current-password"} />
        </div>
        {authError ? <p className="apple-modal-error" role="alert">{authError}</p> : null}
        <button type="submit" disabled={submitting} className="btn-apple-primary button-primary apple-modal-action">
          {submitting ? <><Loader2 size={16} className="spin-icon" aria-hidden="true" /> Đang xử lý…</> : signingUp ? "Đăng ký" : "Đăng nhập"}
        </button>
        {!signingUp ? <p className="apple-forgot-link"><button type="button" className="apple-text-link apple-text-link-button" onClick={switchToForgot}>Quên mật khẩu?</button></p> : null}
        <p className="apple-modal-footer-text">
          {signingUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
          <button type="button" className="apple-text-link apple-text-link-button" onClick={() => switchState(signingUp ? "Login" : "Sign Up")}>{signingUp ? "Đăng nhập" : "Đăng ký ngay"}</button>
        </p>
      </form>
    </div>
  );
};

export default LoginPopup;
