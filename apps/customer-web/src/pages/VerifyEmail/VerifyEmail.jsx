import { useContext, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleAlert, Clock3, Loader2, Mail } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import "./VerifyEmail.css";

const STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  INVALID: "invalid",
  USED: "used",
  ERROR: "error",
};

const VerifyEmail = () => {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = paramToken || searchParams.get("token") || "";
  const { url } = useContext(StoreContext);
  const requestedRef = useRef(false);
  const [result, setResult] = useState({ status: STATUS.LOADING, type: "registration", message: "" });
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    const verify = async () => {
      if (!token) {
        setResult({ status: STATUS.INVALID, type: "registration", message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn." });
        return;
      }
      try {
        const response = await fetch(`${url}/api/user/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json();
        if (response.ok && payload.success) {
          setResult({ status: STATUS.SUCCESS, type: payload.type || "registration", message: payload.message || "Email đã được xác minh." });
        } else if (payload.code === "EMAIL_VERIFICATION_ALREADY_USED") {
          setResult({ status: STATUS.USED, type: "registration", message: payload.message || "Liên kết xác minh này đã được sử dụng." });
        } else {
          setResult({ status: STATUS.INVALID, type: "registration", message: payload.message || "Liên kết xác minh không hợp lệ hoặc đã hết hạn." });
        }
      } catch {
        setResult({ status: STATUS.ERROR, type: "registration", message: "Không thể kiểm tra liên kết lúc này. Vui lòng thử lại." });
      }
    };

    void verify();
  }, [token, url]);

  const resend = async (event) => {
    event.preventDefault();
    if (resending) return;
    setResending(true);
    setResendMessage("");
    try {
      const response = await fetch(`${url}/api/user/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json();
      setResendMessage(payload.message || "Nếu tài khoản đang chờ xác minh, email mới đã được gửi.");
    } catch {
      setResendMessage("Chưa thể gửi lại email. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  };

  const isLoading = result.status === STATUS.LOADING;
  const isSuccess = result.status === STATUS.SUCCESS;
  const Icon = isLoading ? Loader2 : isSuccess ? CheckCircle2 : result.status === STATUS.USED ? Clock3 : CircleAlert;
  const title = isLoading
    ? "Đang xác minh email"
    : isSuccess
      ? result.type === "email_change" ? "Email mới đã được xác nhận" : "Tài khoản đã được xác minh"
      : result.status === STATUS.USED
        ? "Liên kết đã được sử dụng"
        : result.status === STATUS.ERROR
          ? "Chưa thể xác minh"
          : "Liên kết không còn hiệu lực";

  return (
    <main className="verify-email-page">
      <section className={`verify-email-card verify-email-card--${result.status}`} aria-busy={isLoading} aria-live="polite">
        <div className="verify-email-icon"><Icon size={34} className={isLoading ? "verify-email-spin" : ""} aria-hidden="true" /></div>
        <h1>{title}</h1>
        <p>{isLoading ? "Vui lòng chờ trong giây lát." : result.message}</p>

        {!isLoading && !isSuccess ? (
          <form className="verify-email-resend" onSubmit={resend}>
            <div className="verify-email-divider" aria-hidden="true" />
            <h2>Gửi một liên kết mới</h2>
            <p>Nhập email của tài khoản đang chờ xác minh.</p>
            <label htmlFor="verify-resend-email">Email</label>
            <div className="verify-email-input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input id="verify-resend-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
            </div>
            {resendMessage ? <p className="verify-email-status" role="status">{resendMessage}</p> : null}
            <button type="submit" disabled={resending}>
              {resending ? <><Loader2 size={17} className="verify-email-spin" aria-hidden="true" /> Đang gửi…</> : "Gửi lại email xác minh"}
            </button>
          </form>
        ) : null}

        {!isLoading ? <Link className="verify-email-home" to="/">Về trang chủ Drone Food</Link> : null}
      </section>
    </main>
  );
};

export default VerifyEmail;
