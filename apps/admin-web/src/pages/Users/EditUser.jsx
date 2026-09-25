import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./EditUser.css";

const EditUser = ({ url, user, onClose, onUpdate }) => {
  const [data, setData] = useState({
    name: "",
    email: "",
    role: "",
    phone: "",
    locked: false,
  });

  useEffect(() => {
    if (user) {
      setData({
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        locked: user.locked,
      });
    }
  }, [user]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = name === "locked" ? event.target.checked : event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }
    const updateData = {
      id: user._id,
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone,
      locked: data.locked,
    };

    try {
      const response = await axios.post(`${url}/api/user/update`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        toast.success(response.data.message);
        onUpdate();
        onClose();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Error updating user");
    }
  };

  return (
    <div className="edit-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit User</h2>
          <span className="close" onClick={onClose}>
            &times;
          </span>
        </div>
        <form className="flex-col" onSubmit={onSubmitHandler}>
          <div className="add-product-name flex-col">
            <p>Name</p>
            <input
              onChange={onChangeHandler}
              value={data.name}
              type="text"
              name="name"
              placeholder="Type here"
              required
            />
          </div>
          <div className="add-product-name flex-col">
            <p>Email</p>
            <input
              onChange={onChangeHandler}
              value={data.email}
              type="email"
              name="email"
              placeholder="Type here"
              required
            />
          </div>
          <div className="add-product-name flex-col">
            <p>Role</p>
            <select name="role" onChange={onChangeHandler} value={data.role}>
              <option value="user">User</option>
              <option value="restaurant_owner">Restaurant Owner</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="add-product-name flex-col">
            <p>Phone</p>
            <input
              onChange={onChangeHandler}
              value={data.phone}
              type="text"
              name="phone"
              placeholder="Type here"
            />
          </div>
          <div className="add-product-name flex-col">
            <label>
              <input
                type="checkbox"
                name="locked"
                checked={data.locked}
                onChange={onChangeHandler}
              />
              Lock Account
            </label>
          </div>
          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>
              CANCEL
            </button>
            <button type="submit" className="update-btn">
              UPDATE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUser;
