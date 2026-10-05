import { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { Lock, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const { url } = useContext(StoreContext);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [tokenState, setTokenState] = useState("idle");
  const [tokenMessage, setTokenMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      setTokenMessage("Liên kết đặt lại mật khẩu không hợp lệ.");
      return;
    }
    const checkToken = async () => {
      try {
        await axios.get(`${url}/api/user/verify-reset-token/${token}`);
        setTokenState("valid");
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === "RESET_TOKEN_ALREADY_USED") {
          setTokenState("used");
          setTokenMessage(err?.response?.data?.message || "Liên kết đặt lại mật khẩu này đã được sử dụng.");
        } else {
          setTokenState("invalid");
          setTokenMessage(err?.response?.data?.message || "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }
      }
    };
    checkToken();
  }, [token, url]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Hai mật khẩu chưa khớp.");
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
        setError(response.data.message || "Không thể đặt lại mật khẩu.");
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "RESET_TOKEN_ALREADY_USED") {
        setTokenState("used");
        setTokenMessage(err?.response?.data?.message || "Liên kết đặt lại mật khẩu này đã được sử dụng.");
      } else {
        setError(err?.response?.data?.message || "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenState === "used" || tokenState === "invalid") {
    return (
      <div className="reset-password-page">
        <div className="reset-password-card" role="status" aria-live="polite">
          <div className="reset-icon" style={{ color: "#e11d48", background: "rgba(225, 29, 72, 0.1)" }}>
            <Lock size={28} />
          </div>
          <h1>{tokenState === "used" ? "Liên kết đã được sử dụng" : "Liên kết không còn hiệu lực"}</h1>
          <p className="reset-desc">{tokenMessage}</p>
          <p className="reset-desc">
            Hãy quay lại ứng dụng Drone Food bạn đang sử dụng và gửi lại yêu cầu đặt lại mật khẩu nếu cần.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-card" role="status" aria-live="polite">
          <div className="reset-success-icon">
            <CheckCircle size={36} />
          </div>
          <h1>Đã đặt lại mật khẩu</h1>
          <p className="reset-desc">
            Mật khẩu đã được cập nhật và các phiên đăng nhập cũ đã được đóng.
          </p>
          <p className="reset-desc">
            Hãy quay lại ứng dụng Drone Food bạn đang sử dụng và đăng nhập bằng mật khẩu mới.
          </p>
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
        <h1>Tạo mật khẩu mới</h1>
        <p className="reset-desc">
          Nhập mật khẩu mới có ít nhất 8 ký tự. Bạn có thể dán từ trình quản lý mật khẩu.
        </p>

        <form onSubmit={onSubmit} className="reset-form">
          <label className="reset-label" htmlFor="new-password">Mật khẩu mới</label>
          <div className="reset-input-group">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 8 ký tự"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              aria-describedby={error ? "reset-error" : undefined}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label className="reset-label" htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
          <div className="reset-input-group">
            <input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby={error ? "reset-error" : undefined}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}
              aria-pressed={showConfirm}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="reset-mismatch">Hai mật khẩu chưa khớp.</p>
          )}

          {error ? <p id="reset-error" className="reset-error" role="alert">{error}</p> : null}

          <button
            type="submit"
            className={`reset-btn ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin-icon" /> Đang cập nhật…
              </>
            ) : (
              "Đặt lại mật khẩu"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
