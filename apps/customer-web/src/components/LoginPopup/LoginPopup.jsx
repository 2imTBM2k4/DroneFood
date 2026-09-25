import { useContext, useState, useEffect, useRef } from "react";
import "./LoginPopup.css";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Mail, ArrowLeft, Loader2, X } from "lucide-react";

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
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
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
    const firstInput = dialogRef.current?.querySelector("input");
    firstInput?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setShowLogin]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onLogin = async (event) => {
    event.preventDefault();
    let newUrl = url;
    if (currState === "Login") {
      newUrl += "/api/user/login";
    } else {
      newUrl += "/api/user/register";
    }

    const postData = { ...data, role: "user" };

    try {
      const response = await axios.post(newUrl, postData);

      if (response.data.success) {
        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        if (response.data.refreshToken) localStorage.setItem("refreshToken", response.data.refreshToken);
        else localStorage.removeItem("refreshToken");
        resetCustomerSessionExpiry();
        setShowLogin(false);
        navigate("/");
      } else {
        toast.error(response.data.message);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Something went wrong. Please try again."
      );
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
        toast.error(response.data.message);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to send reset email"
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const switchToForgot = () => {
    setCurrState("Forgot");
    setForgotEmail(data.email || "");
    setForgotSent(false);
  };

  const switchToLogin = () => {
    setCurrState("Login");
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

  return (
    <div
      className="apple-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
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
            {currState === "Sign Up" ? "Create Apple Account" : "Sign In to Drone Food"}
          </h2>
          <button
            type="button"
            className="apple-modal-close-btn button-icon-circular"
            onClick={() => setShowLogin(false)}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="apple-modal-desc">
          {currState === "Sign Up"
            ? "Enter your details to register for flight deliveries."
            : "Use your account to track live drone drops and past orders."}
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
            />
          )}
          <input
            name="email"
            onChange={onChangeHandler}
            value={data.email}
            type="email"
            placeholder="Email Address"
            className="apple-modal-input"
            required
          />
          <input
            name="password"
            onChange={onChangeHandler}
            value={data.password}
            type="password"
            placeholder="Password"
            className="apple-modal-input"
            required
          />
        </div>

        <button
          type="submit"
          className="btn-apple-primary button-primary apple-modal-action"
        >
          {currState === "Sign Up" ? "Continue" : "Sign In"}
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
                onClick={() => setCurrState("Sign Up")}
              >
                Create one now
              </span>
            </p>
          ) : (
            <p className="apple-modal-footer-text">
              Already have an account?{" "}
              <span
                className="apple-text-link"
                onClick={() => setCurrState("Login")}
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
