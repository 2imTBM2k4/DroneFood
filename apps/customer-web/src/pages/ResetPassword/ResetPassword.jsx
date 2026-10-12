import { useContext, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import axios from "axios";
import { Lock, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const { url } = useContext(StoreContext);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${url}/api/user/reset-password`, {
        token,
        password,
      });
      if (response.data.success) {
        setSuccess(true);
      } else {
        notificationService.error(
          "Đặt lại mật khẩu không thành công",
          response.data.message || "Không thể đặt lại mật khẩu. Vui lòng thử lại.",
          {
            audience: "user",
            priority: "high",
            key: "reset-password-api-failure",
            actions: [{ label: "Thử lại", onClick: onSubmit }],
          }
        );
      }
    } catch (err) {
      notificationService.error(
        "Đặt lại mật khẩu không thành công",
        err?.response?.data?.message || "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.",
        {
          audience: "user",
          priority: "high",
          persistent: true,
          duration: 0,
          key: "reset-password-catch-failure",
          actions: [{ label: "Thử lại", onClick: onSubmit }],
        }
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-card">
          <div className="reset-success-icon">
            <CheckCircle size={36} />
          </div>
          <h1>Password Reset</h1>
          <p className="reset-desc">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <button className="reset-btn" onClick={() => navigate("/")}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-card">
        <div className="reset-icon">
          <Lock size={28} />
        </div>
        <h1>Set New Password</h1>
        <p className="reset-desc">
          Enter your new password below. It must be at least 8 characters long.
        </p>

        <form onSubmit={onSubmit} className="reset-form">
          <div className="reset-input-group">
            <input
              id="reset-new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={8}
              autoFocus
              aria-invalid={password.length > 0 && password.length < 8}
              aria-describedby={password.length > 0 && password.length < 8 ? "reset-pwd-error" : undefined}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {password && password.length < 8 && (
            <p id="reset-pwd-error" className="reset-mismatch" role="alert">
              Mật khẩu phải có ít nhất 8 ký tự
            </p>
          )}

          <div className="reset-input-group">
            <input
              id="reset-confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
              aria-invalid={!!(password && confirmPassword && password !== confirmPassword)}
              aria-describedby={
                password && confirmPassword && password !== confirmPassword
                  ? "reset-confirm-error"
                  : undefined
              }
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p id="reset-confirm-error" className="reset-mismatch" role="alert">
              Mật khẩu xác nhận không khớp
            </p>
          )}

          <button
            type="submit"
            className={`reset-btn ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin-icon" /> Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
