import React, { useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const registerData = { ...formData, role: "restaurant_owner" };
      const response = await register(registerData);

      if (response && response.success) {
        // SỬA: Check response tồn tại và success
        toast.success("Registration successful! Please login to continue.");
        navigate("/login");
      } else {
        // SỬA: Handle specific message nếu !success
        const errorMsg =
          response?.message || "Registration failed. Please check your inputs.";
        toast.error(errorMsg);
      }
    } catch (error) {
      // SỬA: Customize toast dựa trên error.message (từ backend hoặc generic)
      let message = "Error during registration. Please try again.";
      if (error.message.includes("User already exists")) {
        message =
          "Email already registered. Please use another email or login.";
      } else if (error.message.includes("pending")) {
        message = "Account pending approval. Please wait for admin.";
      }
      toast.error(message);
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
        <button type="submit">Register</button>
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
