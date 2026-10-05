import { useContext, useState } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";
import "./Security.css";

const Security = ({ url }) => {
  const { logout } = useContext(AuthContext);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.newPassword.length < 8) return setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (form.newPassword !== form.confirmPassword) return setError("Hai mật khẩu mới chưa khớp.");
    try {
      setLoading(true);
      const response = await fetch(`${url}/api/user/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Không thể đổi mật khẩu.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      logout();
    } catch (cause) {
      setError(cause.message || "Không thể đổi mật khẩu.");
    } finally {
      setLoading(false);
    }
  };

  const field = (id, label, key, autoComplete) => <label className="security-field" htmlFor={id}><span>{label}</span><input id={id} type="password" value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} autoComplete={autoComplete} required /></label>;

  return <section className="security-page"><h1>Bảo mật tài khoản quản trị</h1><p>Đổi mật khẩu đăng nhập. Bạn có thể dán từ trình quản lý mật khẩu.</p><form className="security-card" onSubmit={submit}>{field("admin-current-password", "Mật khẩu hiện tại", "currentPassword", "current-password")}{field("admin-new-password", "Mật khẩu mới", "newPassword", "new-password")}{field("admin-confirm-password", "Xác nhận mật khẩu mới", "confirmPassword", "new-password")}{error ? <p className="security-error" role="alert">{error}</p> : null}<button type="submit" disabled={loading}>{loading ? "Đang cập nhật…" : "Đổi mật khẩu"}</button></form></section>;
};

export default Security;
