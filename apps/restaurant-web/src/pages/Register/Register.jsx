import React, { useCallback, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import TurnstileWidget from "../../components/auth/TurnstileWidget";
import { useNavigate } from "react-router-dom";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./Register.css";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "", // Thêm field: Tên chủ sở hữu (owner name)
    restaurantName: "",
    address: "",
    phone: "",
    email: "",
    password: "",
  });
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const handleTurnstileExpired = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      notificationService.error(
        "Không thể đăng ký",
        "Vui lòng hoàn tất bước xác minh bảo mật.",
        { audience: "restaurant", priority: "high", key: "restaurant-register-captcha-required" }
      );
      return;
    }

    try {
      const registerData = { ...formData, role: "restaurant_owner" };
      const response = await register(registerData, turnstileToken);

      if (response && response.success) {
        notificationService.success(
          "Đăng ký thành công!",
          "Vui lòng đăng nhập để bắt đầu thiết lập nhà hàng.",
          { audience: "restaurant" }
        );
        navigate("/login");
      } else {
        const errorMsg =
          response?.message || "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.";
        notificationService.error(
          "Đăng ký không thành công",
          errorMsg,
          {
            audience: "restaurant",
            priority: "high",
            key: "restaurant-register-api-error",
            actions: [{ label: "Thử lại", onClick: handleSubmit }],
          }
        );
      }
    } catch (error) {
      let message = "Lỗi trong quá trình đăng ký. Vui lòng thử lại sau.";
      if (error.message.includes("User already exists")) {
        message = "Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.";
      } else if (error.message.includes("pending")) {
        message = "Tài khoản đang chờ duyệt từ quản trị viên. Vui lòng đợi thông báo.";
      }
      notificationService.error(
        "Đăng ký không thành công",
        message,
        {
          audience: "restaurant",
          priority: "high",
          key: "restaurant-register-catch-error",
          actions: [{ label: "Thử lại", onClick: handleSubmit }],
        }
      );
    } finally {
      setTurnstileToken("");
      setTurnstileResetKey((current) => current + 1);
    }
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Register Restaurant Account</h2>
        {/* Thêm input cho owner name */}
        <input
          type="text"
          name="name"
          placeholder="Owner Full Name"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="restaurantName"
          placeholder="Restaurant Name"
          value={formData.restaurantName}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
          required
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password (min 8 chars)"
          value={formData.password}
          onChange={handleChange}
          required
          minLength={8}
        />
        <TurnstileWidget
          action="register"
          onToken={setTurnstileToken}
          onExpired={handleTurnstileExpired}
          onError={handleTurnstileError}
          resetKey={turnstileResetKey}
        />
        <button type="submit" disabled={!turnstileToken}>Register</button>
        <p>
          Already have an account?{" "}
          <a href="/login" onClick={() => navigate("/login")}>
            Login here
          </a>
        </p>
      </form>
    </div>
  );
};

export default Register;
