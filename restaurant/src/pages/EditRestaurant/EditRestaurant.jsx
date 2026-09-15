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
  });
  const [loading, setLoading] = useState(true);
  const [bankAccount, setBankAccount] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
  });
  const [bankAccountMasked, setBankAccountMasked] = useState("");
  const [bankSaving, setBankSaving] = useState(false);

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
      fetchBankAccount();
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

  const fetchBankAccount = async () => {
    try {
      const response = await axios.get(`${url}/api/restaurant/me/bank-account`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.data.success) {
        setBankAccount((current) => ({
          ...current,
          bankName: response.data.data.bankName || "",
          accountHolder: response.data.data.accountHolder || "",
        }));
        setBankAccountMasked(response.data.data.accountNumberMasked || "");
      }
    } catch (error) {
      console.error("Error fetching bank account:", error);
      toast.error("Không thể tải hồ sơ tài khoản ngân hàng.");
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

  const onBankAccountChange = (event) => {
    const { name, value } = event.target;
    setBankAccount((current) => ({ ...current, [name]: value }));
  };

  const onBankAccountSubmit = async (event) => {
    event.preventDefault();
    if (!bankAccount.bankName.trim() || !bankAccount.accountHolder.trim() || !bankAccount.accountNumber.trim()) {
      toast.error("Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng.");
      return;
    }
    try {
      setBankSaving(true);
      const response = await axios.put(`${url}/api/restaurant/me/bank-account`, bankAccount, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.data.success) throw new Error(response.data.message);
      setBankAccount((current) => ({ ...current, accountNumber: "" }));
      setBankAccountMasked(response.data.data.accountNumberMasked || "");
      toast.success("Đã lưu tài khoản ngân hàng.");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Không thể lưu tài khoản ngân hàng.");
    } finally {
      setBankSaving(false);
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
        <h1 className="add-title">Restaurant</h1>
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
            placeholder="+1-234-567-890"
          />
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

      <section className="bank-account-section" aria-labelledby="bank-account-heading">
        <div>
          <h2 id="bank-account-heading">Tài khoản ngân hàng nhận tiền</h2>
          <p className="field-hint">
            Thông tin này dùng cho các yêu cầu rút tiền. Số tài khoản được mã hoá và chỉ hiển thị 4 số cuối sau khi lưu.
          </p>
        </div>
        {bankAccountMasked && <p className="bank-account-current">Tài khoản đang dùng: {bankAccountMasked}</p>}
        <form className="bank-account-form" onSubmit={onBankAccountSubmit}>
          <label>
            Ngân hàng
            <input name="bankName" value={bankAccount.bankName} onChange={onBankAccountChange} placeholder="Ví dụ: Vietcombank" maxLength="100" required />
          </label>
          <label>
            Chủ tài khoản
            <input name="accountHolder" value={bankAccount.accountHolder} onChange={onBankAccountChange} placeholder="NGUYEN VAN A" maxLength="120" required />
          </label>
          <label>
            Số tài khoản {bankAccountMasked ? "mới" : ""}
            <input name="accountNumber" value={bankAccount.accountNumber} onChange={onBankAccountChange} inputMode="numeric" placeholder={bankAccountMasked ? "Nhập lại đầy đủ số tài khoản để thay đổi" : "Chỉ gồm chữ số"} maxLength="30" required />
          </label>
          <button type="submit" className="add-btn" disabled={bankSaving}>
            {bankSaving ? "ĐANG LƯU..." : "LƯU TÀI KHOẢN"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default EditRestaurant;
