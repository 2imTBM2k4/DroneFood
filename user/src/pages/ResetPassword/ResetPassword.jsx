import { useContext, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
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
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
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
        toast.error(response.data.message);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to reset password. The link may have expired."
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
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              required
              minLength={8}
              autoFocus
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

          <div className="reset-input-group">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={8}
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
            <p className="reset-mismatch">Passwords do not match</p>
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
