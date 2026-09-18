import React, { useState, useEffect, useContext } from "react";
import "./EditRestaurant.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";

const EditRestaurant = ({ url }) => {
  const { user } = useContext(AuthContext);
  const [image, setImage] = useState(null); // File mới
  const [currentImageUrl, setCurrentImageUrl] = useState(null); // URL từ Cloudinary
  const [data, setData] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    description: "",
    openTime: "07:00",
    closeTime: "22:00",
    isOpen: true,
  });
  const [loading, setLoading] = useState(true);

  const getRestaurantId = () => {
    let id = user?.restaurantId;
    if (!id) return null;
    if (typeof id === "string") return id;
    if (id._id) return id._id.toString();
    if (typeof id.toString === "function") return id.toString();
    return null;
  };

  useEffect(() => {
    const restaurantId = getRestaurantId();
    if (restaurantId) {
      fetchRestaurant(restaurantId);
    } else {
      toast.error("No restaurant ID found. Please contact admin.");
      setLoading(false);
    }
  }, [user]);

  const fetchRestaurant = async (restaurantId) => {
    try {
      const response = await axios.get(`${url}/api/restaurant/list`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.data.success) {
        const myRestaurant = response.data.data.find(
          (r) => r._id.toString() === restaurantId
        );
        if (myRestaurant) {
          setData({
            name: myRestaurant.name || "",
            address: myRestaurant.address || "",
            email: myRestaurant.email || "",
            phone: myRestaurant.phone || "",
            description: myRestaurant.description || "",
            openTime: myRestaurant.openingHours?.openTime || "07:00",
            closeTime: myRestaurant.openingHours?.closeTime || "22:00",
            isOpen: myRestaurant.isOpen !== false,
          });

          // Cloudinary trả về URL đầy đủ, không cần ghép nối
          setCurrentImageUrl(myRestaurant.image || null);
          setImage(null);
        } else {
          toast.error("Restaurant not found. Create one first?");
        }
      }
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      toast.error(
        "Failed to load restaurant info: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  const onImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const restaurantId = getRestaurantId();
    if (!restaurantId) {
      toast.error("No restaurant ID available.");
      return;
    }

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("address", data.address);
    formData.append("email", data.email);
    formData.append("phone", data.phone);
    formData.append("description", data.description);
    formData.append(
      "openingHours",
      JSON.stringify({
        openTime: data.openTime || "07:00",
        closeTime: data.closeTime || "22:00",
      })
    );
    formData.append("isOpen", Boolean(data.isOpen));

    if (image && image instanceof File) {
      formData.append("image", image);
    }

    try {
      const response = await axios.put(
        `${url}/api/restaurant/${restaurantId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        toast.success("Restaurant updated successfully!");
        setImage(null);
        await fetchRestaurant(restaurantId);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Update error:", error.response?.data || error.message);
      const errMsg =
        error.response?.data?.message || error.message || "Update failed";
      toast.error(errMsg);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!getRestaurantId())
    return <div className="error">No restaurant assigned.</div>;

  // Hiển thị: File mới > Cloudinary URL > Placeholder
  const displayImage = image
    ? URL.createObjectURL(image)
    : currentImageUrl || assets.upload_area;

  return (
    <div className="edit-restaurant">
      <div className="add-header">
        <h1 className="add-title">Profile</h1>
        <p className="add-subtitle">
          How your restaurant appears to customers
        </p>
      </div>

      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p>Restaurant Image</p>
          <label htmlFor="image">
            <img className="image" src={displayImage} alt="Restaurant" />
          </label>
          <input
            onChange={onImageChange}
            type="file"
            id="image"
            hidden
            accept="image/*"
          />
          {image && (
            <p className="file-selected">New image selected: {image.name}</p>
          )}
          {currentImageUrl && !image && (
            <p className="current-image">Current: Cloudinary hosted</p>
          )}
        </div>

        <div className="add-product-name flex-col">
          <p>Restaurant Name</p>
          <input
            onChange={onChangeHandler}
            value={data.name}
            type="text"
            name="name"
            placeholder="Your restaurant's name"
            required
          />
        </div>

        <div className="add-product-name flex-col">
          <p>Address</p>
          <input
            onChange={onChangeHandler}
            value={data.address}
            type="text"
            name="address"
            placeholder="e.g. 24 Thach Lam, Phu Thanh, Tan Phu, HCMC"
            required
          />
          <small className="field-hint">
            Customers see restaurants near them, so a full, accurate address
            decides who finds you and what delivery time they're quoted.
          </small>
        </div>

        <div className="add-product-name flex-col">
          <p>Email</p>
          <input
            onChange={onChangeHandler}
            value={data.email}
            type="email"
            name="email"
            placeholder="example@restaurant.com"
            required
          />
        </div>

        <div className="add-product-name flex-col">
          <p>Phone</p>
          <input
            onChange={onChangeHandler}
            value={data.phone}
            type="tel"
            name="phone"
            placeholder="+84..."
          />
        </div>

        {/* Cấu hình Giờ mở cửa - Đóng cửa */}
        <div className="add-product-name flex-col">
          <p>Giờ hoạt động (Opening Hours)</p>
          <div className="edit-hours-grid">
            <div className="edit-hour-item">
              <label htmlFor="openTime">Giờ mở cửa</label>
              <input
                id="openTime"
                type="time"
                name="openTime"
                value={data.openTime}
                onChange={onChangeHandler}
                required
              />
            </div>
            <div className="edit-hour-item">
              <label htmlFor="closeTime">Giờ đóng cửa</label>
              <input
                id="closeTime"
                type="time"
                name="closeTime"
                value={data.closeTime}
                onChange={onChangeHandler}
                required
              />
            </div>
          </div>
          <small className="field-hint">
            Hệ thống tự động hiển thị trạng thái và chặn khách đặt đơn ngoài khung giờ này.
          </small>
        </div>

        {/* Trạng thái nhận đơn bật / tắt thủ công */}
        <div className="edit-open-toggle flex-col">
          <p>Trạng thái nhận đơn</p>
          <label className="toggle-switch-label">
            <input
              type="checkbox"
              name="isOpen"
              checked={data.isOpen}
              onChange={(e) =>
                setData((prev) => ({ ...prev, isOpen: e.target.checked }))
              }
            />
            <span className={data.isOpen ? "status-open" : "status-closed"}>
              {data.isOpen
                ? "🟢 Đang mở cửa nhận đơn"
                : "🔴 Tạm ngưng nhận đơn (Đóng cửa)"}
            </span>
          </label>
          <small className="field-hint">
            Bật/tắt nếu nhà hàng muốn tạm nghỉ đột xuất dù đang trong khung giờ mở cửa.
          </small>
        </div>

        <div className="add-product-description flex-col">
          <p>Description</p>
          <textarea
            onChange={onChangeHandler}
            value={data.description}
            name="description"
            rows="6"
            placeholder="Write content here"
          ></textarea>
        </div>

        <button type="submit" className="add-btn">
          UPDATE
        </button>
      </form>
    </div>
  );
};

export default EditRestaurant;
