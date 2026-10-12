import { useContext, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import axios from "axios";
import { CheckCircle, AlertTriangle, Loader2, ArrowRight, Mail, Home } from "lucide-react";
import "./VerifyEmail.css";

const VerifyEmail = () => {
  const { token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = routeToken || searchParams.get("token");

  const { url, setShowLogin } = useContext(StoreContext);
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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
    let isMounted = true;

    const performVerification = async () => {
      if (!token) {
        if (isMounted) {
          setStatus("error");
          setMessage("Không tìm thấy mã xác thực. Vui lòng kiểm tra lại liên kết trong email.");
        }
        return;
      }

      try {
        const response = await axios.post(`${url}/api/user/verify-email`, {
          token,
        });

        if (!isMounted) return;

        if (response.data.success) {
          setStatus("success");
          setMessage(
            response.data.message ||
              "Tài khoản của bạn đã được kích hoạt thành công! Bạn có thể đăng nhập ngay bây giờ."
          );
        } else {
          setStatus("error");
          setMessage(
            response.data.message || "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn."
          );
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(
          err?.response?.data?.message ||
            "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại liên kết mới."
        );
      }
    };

    performVerification();

    return () => {
      isMounted = false;
    };
  }, [token, url]);

  const handleGoToLogin = () => {
    navigate("/");
    if (setShowLogin) {
      setShowLogin(true);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResendLoading(true);
    try {
      const response = await axios.post(`${url}/api/user/resend-verification`, {
        email: resendEmail,
      });

      if (response.data.success) {
        setResendCooldown(60);
        notificationService.success(
          "Đã gửi lại email kích hoạt",
          response.data.message || "Vui lòng kiểm tra hộp thư đến của bạn.",
          { audience: "user" }
        );
      } else {
        notificationService.error(
          "Không thể gửi lại",
          response.data.message || "Vui lòng kiểm tra lại địa chỉ email.",
          { audience: "user" }
        );
      }
    } catch (err) {
      notificationService.error(
        "Không thể gửi email kích hoạt",
        err?.response?.data?.message || "Đã xảy ra lỗi khi gửi lại email. Vui lòng thử lại sau.",
        { audience: "user" }
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        {status === "loading" && (
          <div className="verify-state-box">
            <div className="verify-loading-icon">
              <Loader2 size={44} className="spin-icon" />
            </div>
            <h1>Đang kích hoạt tài khoản</h1>
            <p className="verify-desc">
              Hệ thống Drone Food đang xác thực liên kết của bạn. Vui lòng chờ trong giây lát...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="verify-state-box">
            <div className="verify-success-icon">
              <CheckCircle size={44} />
            </div>
            <h1>Kích hoạt thành công!</h1>
            <p className="verify-desc">{message}</p>
            <button className="verify-btn-primary" onClick={handleGoToLogin}>
              Đăng nhập ngay <ArrowRight size={18} />
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="verify-state-box">
            <div className="verify-error-icon">
              <AlertTriangle size={44} />
            </div>
            <h1>Kích hoạt không thành công</h1>
            <p className="verify-desc">{message}</p>

            <form onSubmit={handleResend} className="verify-resend-form">
              <p className="verify-resend-prompt">
                Nhập địa chỉ email của bạn để nhận liên kết kích hoạt mới:
              </p>
              <div className="verify-input-wrapper">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="verify-input"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={resendLoading || resendCooldown > 0}
                className="verify-btn-secondary"
              >
                {resendLoading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" /> Đang gửi...
                  </>
                ) : resendCooldown > 0 ? (
                  `Gửi lại sau (${resendCooldown}s)`
                ) : (
                  <>
                    <Mail size={16} /> Gửi lại liên kết kích hoạt
                  </>
                )}
              </button>
            </form>

            <button className="verify-btn-link" onClick={() => navigate("/")}>
              <Home size={15} /> Quay về Trang chủ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
