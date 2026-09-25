import React, { useEffect, useState } from "react";
import "./ListRestaurant.css";
import axios from "axios";
import { toast } from "react-toastify";

const ListRestaurant = ({ url }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchList = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/restaurant/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setList(response.data.data);
      } else {
        toast.error("Error fetching restaurants");
      }
    } catch (error) {
      console.error("Fetch restaurants error:", error);
      toast.error(
        error.response?.data?.message || "Network error or unauthorized"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (restaurantId, isLocked) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }

    try {
      const response = await axios.put(
        `${url}/api/restaurant/${restaurantId}/lock`,
        { isLocked },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchList();
      } else {
        toast.error(
          response.data.message || "Error locking/unlocking restaurant"
        );
      }
    } catch (error) {
      console.error("Toggle lock error:", error);
      toast.error(error.response?.data?.message || "Network error");
    }
  };

  const removeRestaurant = async (restaurantId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }

    if (!window.confirm("Bạn có chắc muốn xóa nhà hàng này?\n\nLưu ý: Chỉ có thể xóa nhà hàng chưa có đơn hàng nào.")) {
      return;
    }

    try {
      const response = await axios.delete(`${url}/api/restaurant`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id: restaurantId },
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchList();
      } else {
        toast.error(response.data.message || "Error deleting restaurant");
      }
    } catch (error) {
      console.error("Delete restaurant error:", error);
      toast.error(error.response?.data?.message || "Không thể xóa nhà hàng");
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  if (loading) {
    return (
      <div className="list add flex-col restaurants-list">
        <p>Loading restaurants...</p>
      </div>
    );
  }

  return (
    <div className="list add flex-col restaurants-list">
      <p>All Restaurants List</p>
      <div className="list-table">
        <div className="list-table-format title">
          <b>Name</b>
          <b>Address</b>
          <b>Phone</b>
          <b>Description</b>
          <b>Owner Email</b>
          <b>Status</b>
          <b>Actions</b>
        </div>
        {list.length === 0 ? (
          <div className="no-data">
            <p>No restaurants found</p>
          </div>
        ) : (
          list.map((item, index) => {
            return (
              <div key={index} className="list-table-format">
                <p>{item.name}</p>
                <p>{item.address}</p>
                <p>{item.phone || "N/A"}</p>
                <p>{item.description || "N/A"}</p>
                <p>{item.owner?.email || "N/A"}</p>
                <p>
                  <span
                    className={`status-pill ${
                      item.isLocked
                        ? "status-pill--locked"
                        : "status-pill--active"
                    }`}
                  >
                    {item.isLocked ? "Locked" : "Active"}
                  </span>
                </p>
                <div className="actions">
                  <button
                    onClick={() => toggleLock(item._id, !item.isLocked)}
                    className={`cursor lock-btn ${
                      item.isLocked ? "lock-btn--unlock" : "lock-btn--lock"
                    }`}
                  >
                    {item.isLocked ? "Unlock" : "Lock"}
                  </button>
                  <button
                    onClick={() => removeRestaurant(item._id)}
                    className="cursor delete-btn"
                    onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.target.style.opacity = "1")}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ListRestaurant;
