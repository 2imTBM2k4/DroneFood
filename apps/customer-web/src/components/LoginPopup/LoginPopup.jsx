import { useContext, useState, useEffect, useRef } from "react";
import "./LoginPopup.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import {
  Mail,
  ArrowLeft,
  Loader2,
  X,
  ExternalLink,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

const getEmailProvider = (email) => {
  if (!email) {
    return { name: "Mở hộp thư Email", url: "https://mail.google.com" };
  }
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (domain.includes("gmail.com") || domain.includes("googlemail.com")) {
    return { name: "Mở Gmail ngay", url: "https://mail.google.com" };
  }
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live.com")) {
    return { name: "Mở Outlook ngay", url: "https://outlook.live.com" };
  }
  if (domain.includes("yahoo")) {
    return { name: "Mở Yahoo Mail ngay", url: "https://mail.yahoo.com" };
  }
  if (domain.includes("icloud")) {
    return { name: "Mở iCloud Mail ngay", url: "https://www.icloud.com/mail" };
  }
  return { name: "Mở ứng dụng Email", url: `mailto:${email}` };
};

const LoginPopup = ({ setShowLogin }) => {
  const { url, setToken, resetCustomerSessionExpiry } = useContext(StoreContext);
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  const [currState, setCurrState] = useState("Login");
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [isUnverifiedError, setIsUnverifiedError] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) {
        setShowLogin(false);
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const firstInput = dialogRef.current?.querySelector("input:not([disabled])");
    firstInput?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setShowLogin, isSubmitting]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setLoginError(null);
    setIsUnverifiedError(false);
    setData((data) => ({ ...data, [name]: value }));
  };

  const onResendVerification = async (targetEmail) => {
    const emailToSend = targetEmail || registeredEmail || data.email;
    if (!emailToSend) return;
    setResendLoading(true);
    try {
      const response = await axios.post(`${url}/api/user/resend-verification`, {
        email: emailToSend,
      });
      if (response.data.success) {
        setResendCooldown(60);
        notificationService.success(
          "Đã gửi email kích hoạt",
          response.data.message || "Vui lòng kiểm tra hộp thư đến của bạn.",
          { audience: "user" }
        );
      } else {
        notificationService.error(
          "Không thể gửi email kích hoạt",
          response.data.message || "Vui lòng thử lại sau.",
          { audience: "user" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi email kích hoạt",
        err?.response?.data?.message ||
          "Không thể gửi email kích hoạt vào lúc này. Vui lòng thử lại sau.",
        { audience: "user" }
      );
    } finally {
      setResendLoading(false);
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setLoginError(null);
    setIsUnverifiedError(false);
    setIsSubmitting(true);

    let newUrl = url;
    let postData;
    if (currState === "Login") {
      newUrl += "/api/user/login";
      postData = { email: data.email, password: data.password, portal: "customer" };
    } else {
      newUrl += "/api/user/register";
      postData = { ...data, role: "user" };
    }

    try {
      const response = await axios.post(newUrl, postData);

      if (response.data.success) {
        if (currState !== "Login" || response.data.requiresVerification || !response.data.token) {
          const userEmail = data.email || response.data.email;
          setRegisteredEmail(userEmail);
          setCurrState("VerifyNotice");
          setResendCooldown(60);
          notificationService.success(
            "Đăng ký thành công!",
            "Vui lòng kiểm tra email để kích hoạt tài khoản của bạn.",
            { audience: "user" }
          );
          return;
        }

        const returnedRole = response.data.role || response.data.user?.role;
        if (returnedRole && returnedRole !== "user") {
          setLoginError("Tài khoản Quản trị hoặc Nhà hàng không thể đăng nhập vào giao diện Khách hàng.");
          return;
        }

        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        if (response.data.refreshToken) localStorage.setItem("refreshToken", response.data.refreshToken);
        else localStorage.removeItem("refreshToken");
        resetCustomerSessionExpiry();
        setShowLogin(false);
        navigate("/");
      } else {
        setLoginError(
          response.data.message ||
            (currState === "Login"
              ? "Email hoặc mật khẩu không đúng."
              : "Đăng ký không thành công.")
        );
      }
    } catch (err) {
      if (err?.response?.data?.isUnverified) {
        setIsUnverifiedError(true);
        const unverified = err.response.data.email || data.email;
        setUnverifiedEmail(unverified);
        setLoginError(
          err.response.data.message ||
            "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email của bạn."
        );
        return;
      }

      if (
        err?.response &&
        (err.response.status === 400 ||
          err.response.status === 401 ||
          err.response.status === 403 ||
          err.response.status === 404 ||
          err.response.status === 409 ||
          err.response.status === 422)
      ) {
        setLoginError(
          err.response.data?.message ||
            (currState === "Login"
              ? "Email hoặc mật khẩu không đúng."
              : "Thông tin đăng ký không hợp lệ.")
        );
      } else {
        notificationService.error(
          "Không thể xử lý yêu cầu",
          err?.response?.data?.message ||
            "Lỗi kết nối máy chủ. Vui lòng kiểm tra lại đường truyền và thử lại.",
          {
            audience: "user",
            priority: "high",
            persistent: true,
            duration: 0,
            key: "login-network-error",
            actions: [{ label: "Thử lại", onClick: () => onLogin(event) }],
          }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPassword = async (event) => {
    event.preventDefault();
    setForgotLoading(true);
    try {
      const response = await axios.post(`${url}/api/user/forgot-password`, {
        email: forgotEmail,
      });
      if (response.data.success) {
        setForgotSent(true);
      } else {
        notificationService.error(
          "Không thể gửi email đặt lại mật khẩu",
          response.data.message || "Vui lòng kiểm tra lại địa chỉ email.",
          {
            audience: "user",
            priority: "high",
            key: "forgot-password-api-failure",
            actions: [{ label: "Thử lại", onClick: () => onForgotPassword(event) }],
          }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi email đặt lại mật khẩu",
        err?.response?.data?.message || "Không thể gửi email đặt lại mật khẩu vào lúc này. Vui lòng thử lại sau.",
        {
          audience: "user",
          priority: "high",
          persistent: true,
          duration: 0,
          key: "forgot-password-catch-failure",
          actions: [{ label: "Thử lại", onClick: () => onForgotPassword(event) }],
        }
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const switchToForgot = () => {
    setCurrState("Forgot");
    setLoginError(null);
    setIsUnverifiedError(false);
    setForgotEmail(data.email || "");
    setForgotSent(false);
  };

  const switchToLogin = () => {
    setCurrState("Login");
    setLoginError(null);
    setIsUnverifiedError(false);
    setForgotSent(false);
  };

  if (currState === "Forgot") {
    return (
      <div
        className="apple-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
      >
        <form
          onSubmit={onForgotPassword}
          className="apple-modal-card"
          ref={dialogRef}
          role="dialog"
          aria-label="Forgot Password"
        >
          <div className="apple-modal-header">
            <button
              type="button"
              className="apple-modal-back-btn"
              onClick={switchToLogin}
              aria-label="Back to login"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="apple-modal-title">Forgot Password</h2>
            <button
              type="button"
              className="apple-modal-close-btn button-icon-circular"
              onClick={() => setShowLogin(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {forgotSent ? (
            <div className="apple-forgot-success">
              <div className="apple-forgot-icon">
                <Mail size={32} />
              </div>
              <h3 className="apple-forgot-success-title">Check your email</h3>
              <p className="apple-forgot-desc">
                We sent a password reset link to <strong>{forgotEmail}</strong>.
              </p>
              <button
                type="button"
                className="btn-apple-primary button-primary"
                onClick={switchToLogin}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <p className="apple-modal-desc">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <div className="apple-modal-inputs">
                <input
                  name="forgotEmail"
                  onChange={(e) => setForgotEmail(e.target.value)}
                  value={forgotEmail}
                  type="email"
                  placeholder="name@example.com"
                  className="apple-modal-input"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className={`btn-apple-primary button-primary apple-modal-action ${
                  forgotLoading ? "loading" : ""
                }`}
              >
                {forgotLoading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" /> Sending…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
              <p className="apple-modal-footer-text">
                Remember your password?{" "}
                <span className="apple-text-link" onClick={switchToLogin}>
                  Sign in
                </span>
              </p>
            </>
          )}
        </form>
      </div>
    );
  }

  if (currState === "VerifyNotice") {
    const targetEmail = registeredEmail || data.email;
    const provider = getEmailProvider(targetEmail);

    return (
      <div
        className="apple-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
      >
        <div
          className="apple-modal-card apple-verify-card"
          ref={dialogRef}
          role="dialog"
          aria-label="Kích hoạt tài khoản"
        >
          <div className="apple-modal-header">
            <div className="apple-verify-step-badge">
              <span className="apple-verify-step-dot" />
              <span>Bước 2/2: Kích hoạt tài khoản</span>
            </div>
            <button
              type="button"
              className="apple-modal-close-btn button-icon-circular"
              onClick={() => setShowLogin(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="apple-verify-content">
            <div className="apple-verify-hero-icon-wrap">
              <div className="apple-verify-icon">
                <Mail size={32} />
              </div>
            </div>

            <h3 className="apple-verify-main-title">Kiểm tra email để kích hoạt</h3>

            <p className="apple-verify-lead-desc">
              Hệ thống đã gửi liên kết kích hoạt tài khoản đến địa chỉ:
            </p>

            <div className="apple-verify-email-pill" title={targetEmail}>
              <Mail size={15} className="apple-verify-email-icon" />
              <strong className="apple-verify-email-text">{targetEmail}</strong>
            </div>

            <div className="apple-verify-guide-box">
              <div className="apple-verify-guide-header">
                <HelpCircle size={15} className="apple-verify-guide-icon" />
                <span>Hướng dẫn hoàn tất đăng ký:</span>
              </div>
              <ol className="apple-verify-steps-list">
                <li>
                  <span className="apple-step-marker">1</span>
                  <div className="apple-step-desc">
                    <strong>Mở hộp thư đến</strong> của bạn <em>(kiểm tra cả thư mục Thư rác / Spam nếu cần)</em>.
                  </div>
                </li>
                <li>
                  <span className="apple-step-marker">2</span>
                  <div className="apple-step-desc">
                    Tìm thư từ <strong>Drone Food</strong> và bấm nút <strong>&quot;Kích hoạt tài khoản ngay&quot;</strong>.
                  </div>
                </li>
                <li>
                  <span className="apple-step-marker">3</span>
                  <div className="apple-step-desc">
                    Sau khi trang xác nhận thành công xuất hiện, quay lại đây để đăng nhập.
                  </div>
                </li>
              </ol>
            </div>

            <div className="apple-verify-actions">
              <a
                href={provider.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-apple-primary button-primary apple-verify-openmail-btn"
              >
                <span>{provider.name}</span>
                <ExternalLink size={16} />
              </a>

              <button
                type="button"
                className="apple-verify-back-login-btn"
                onClick={() => {
                  setCurrState("Login");
                  setLoginError(null);
                  setIsUnverifiedError(false);
                }}
              >
                Tôi đã kích hoạt — Đăng nhập ngay
              </button>
            </div>

            <div className="apple-verify-resend-box">
              <span>Chưa nhận được email?</span>
              <button
                type="button"
                disabled={resendLoading || resendCooldown > 0}
                className="apple-text-link apple-resend-btn"
                onClick={() => onResendVerification(targetEmail)}
              >
                {resendLoading ? (
                  <>
                    <Loader2 size={13} className="spin-icon" /> Đang gửi...
                  </>
                ) : resendCooldown > 0 ? (
                  `Gửi lại sau (${resendCooldown}s)`
                ) : (
                  "Gửi lại email kích hoạt"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="apple-modal-overlay"
      onClick={(e) => {
        if (!isSubmitting && e.target === e.currentTarget) {
          setShowLogin(false);
        }
      }}
    >
      <form
        onSubmit={onLogin}
        className="apple-modal-card"
        ref={dialogRef}
        role="dialog"
        aria-label={currState}
      >
        <div className="apple-modal-header">
          <h2 className="apple-modal-title">
            {currState === "Sign Up" ? "Create DroneFood Account" : "Sign In to Drone Food"}
          </h2>
          <button
            type="button"
            className="apple-modal-close-btn button-icon-circular"
            onClick={() => !isSubmitting && setShowLogin(false)}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <X size={16} />
          </button>
        </div>

        <p className="apple-modal-desc">
          {currState === "Sign Up"
            ? "Nhập thông tin bên dưới để đăng ký tài khoản trải nghiệm giao đồ ăn bằng Drone."
            : "Đăng nhập tài khoản để đặt món và theo dõi lộ trình bay của Drone."}
        </p>

        <div className="apple-modal-inputs">
          {currState === "Sign Up" && (
            <input
              name="name"
              onChange={onChangeHandler}
              value={data.name}
              type="text"
              placeholder="Full Name"
              className="apple-modal-input"
              required
              disabled={isSubmitting}
            />
          )}
          <input
            id="login-email"
            name="email"
            onChange={onChangeHandler}
            value={data.email}
            type="email"
            placeholder="Email Address"
            className="apple-modal-input"
            required
            disabled={isSubmitting}
            aria-invalid={!!loginError}
            aria-describedby={loginError ? "login-error" : undefined}
          />
          <input
            id="login-password"
            name="password"
            onChange={onChangeHandler}
            value={data.password}
            type="password"
            placeholder="Password"
            className="apple-modal-input"
            required
            disabled={isSubmitting}
            aria-invalid={!!loginError}
            aria-describedby={loginError ? "login-error" : undefined}
          />
          {loginError && (
            <div className="apple-error-box">
              <div className="apple-error-header">
                <AlertCircle size={15} className="apple-error-icon" />
                <p id="login-error" role="alert" className="login-error-text">
                  {loginError}
                </p>
              </div>
              {isUnverifiedError && (
                <div className="apple-unverified-cta-row">
                  <button
                    type="button"
                    className="apple-unverified-guide-link"
                    onClick={() => {
                      setRegisteredEmail(unverifiedEmail || data.email);
                      setCurrState("VerifyNotice");
                    }}
                  >
                    Xem hướng dẫn kích hoạt
                  </button>
                  <span className="apple-dot-divider">•</span>
                  <button
                    type="button"
                    disabled={resendLoading || resendCooldown > 0}
                    className="apple-text-link apple-resend-btn"
                    onClick={() => onResendVerification(unverifiedEmail || data.email)}
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 size={13} className="spin-icon" /> Đang gửi...
                      </>
                    ) : resendCooldown > 0 ? (
                      `Gửi lại link (${resendCooldown}s)`
                    ) : (
                      "Gửi lại email kích hoạt"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`btn-apple-primary button-primary apple-modal-action ${
            isSubmitting ? "loading" : ""
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="spin-icon" />{" "}
              {currState === "Sign Up" ? "Đang tạo tài khoản & gửi email..." : "Đang đăng nhập..."}
            </>
          ) : currState === "Sign Up" ? (
            "Continue"
          ) : (
            "Sign In"
          )}
        </button>

        {currState === "Login" && (
          <p className="apple-forgot-link">
            <span className="apple-text-link" onClick={switchToForgot}>
              Forgot password?
            </span>
          </p>
        )}

        <div className="apple-modal-switch">
          {currState === "Login" ? (
            <p className="apple-modal-footer-text">
              Don&apos;t have an account?{" "}
              <span
                className="apple-text-link"
                onClick={() => !isSubmitting && setCurrState("Sign Up")}
              >
                Create one now
              </span>
            </p>
          ) : (
            <p className="apple-modal-footer-text">
              Already have an account?{" "}
              <span
                className="apple-text-link"
                onClick={() => !isSubmitting && setCurrState("Login")}
              >
                Sign in
              </span>
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default LoginPopup;
