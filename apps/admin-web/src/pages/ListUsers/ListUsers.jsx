import React, { useEffect, useState } from "react";
import "./ListUsers.css";
import axios from "axios";
import { toast } from "react-toastify";

const ListUsers = ({ url }) => {
  const [list, setList] = useState([]);

  const fetchList = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(`${url}/api/user/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setList(response.data.data);
      } else {
        toast.error("Error fetching users");
      }
    } catch (error) {
      console.error("Fetch list error:", error);
      toast.error("Network error");
    }
  };

  const lockUser = async (userId, locked) => {
    const token = localStorage.getItem("token");

    try {
      // ✅ SỬA: Gửi { id, locked } thay vì { userId, locked }
      const response = await axios.post(
        `${url}/api/user/lock`,
        { id: userId, locked }, // ✅ Đổi key từ userId → id
        {
          headers: { Authorization: `Bearer ${token}`         },
      }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchList();
      } else {
        toast.error(response.data.message || "Error");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Network error");
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <div className="list add flex-col users-list">
      <p>All Users List</p>
      <div className="list-table">
        <div className="list-table-format title">
          <b>Name</b>
          <b>Email</b>
          <b>Role</b>
          <b>Phone</b>
          <b>Locked</b>
          <b>Actions</b>
        </div>
        {list.map((item, index) => {
          return (
            <div key={index} className="list-table-format">
              <p>{item.name}</p>
              <p>{item.email}</p>
              <p>{item.role}</p>
              <p>{item.phone || "N/A"}</p>
              <p>
                <span
                  className={`status-pill ${
                    item.locked ? "status-pill--locked" : "status-pill--active"
                  }`}
                >
                  {item.locked ? "Locked" : "Active"}
                </span>
              </p>
              <div className="actions">
                <button
                  onClick={() => lockUser(item._id, !item.locked)}
                  className={`cursor lock-btn ${
                    item.locked ? "lock-btn--unlock" : "lock-btn--lock"
                  }`}
                >
                  {item.locked ? "Unlock" : "Lock"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ListUsers;
