import React, { useEffect, useRef, useState } from "react";
import "./Add.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import OptionGroupBuilder, {
  validateOptionGroups,
  normaliseOptionGroups,
} from "@drone-food/web-ui/components/OptionGroupBuilder";

const Add = ({ url, onSuccess }) => {
  // Prop url từ App

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [optionGroups, setOptionGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [priceError, setPriceError] = useState("");
  const fileInputRef = useRef(null);
  const [data, setData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
  });
  // Categories already in use, offered as suggestions. Free text alone let the
  // same cuisine be typed three different ways ("GÀ", "GÀ CAY", "Gà"), which
  // then splits the customer-facing filters.
  const [knownCategories, setKnownCategories] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    axios
      .get(`${url}/api/food/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setKnownCategories([
            ...new Set((res.data.data || []).map((f) => f.category).filter(Boolean)),
          ]);
        }
      })
      .catch(() => {
        /* suggestions are a convenience; the field still accepts free text */
      });
  }, [url]);

  // createObjectURL in the render body would mint a new blob URL on every
  // render and never free any of them. Make one per file and revoke it.
  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
    if (name === "price") {
      const raw = String(value).trim();
      if (!raw) {
        setPriceError("Vui lòng nhập giá");
      } else if (Number(raw) <= 0) {
        setPriceError("Giá phải lớn hơn 0");
      } else {
        setPriceError("");
      }
    }
  };

  const resetForm = () => {
    setData({ name: "", description: "", price: "", category: "" });
    setPriceError("");
    setImage(null);
    setOptionGroups([]);
    // Clearing state alone leaves the input's value set, so re-picking the
    // same file would fire no change event.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (submitting) return;

    // Validated here rather than with `required` on the input: that input is
    // hidden, and Chrome refuses to submit a form whose invalid control can't
    // be focused — the click would silently do nothing.
    if (!image) {
      notificationService.warning(
        "Chưa chọn ảnh món ăn",
        "Vui lòng chọn hình ảnh minh họa cho món ăn.",
        { audience: "restaurant", key: "food-add-image-empty" }
      );
      return;
    }

    const rawPrice = String(data.price).trim();
    if (!rawPrice) {
      setPriceError("Vui lòng nhập giá");
      return;
    }
    const numPrice = Number(rawPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      setPriceError("Giá phải lớn hơn 0");
      return;
    }
    setPriceError("");

    // Thêm validation đơn giản cho category (tùy chọn, để tránh string rỗng)
    if (!data.category.trim()) {
      notificationService.warning(
        "Danh mục món trống",
        "Vui lòng nhập hoặc chọn danh mục cho món ăn.",
        { audience: "restaurant", key: "food-add-category-empty" }
      );
      return;
    }

    const problems = validateOptionGroups(optionGroups);
    if (problems.length > 0) {
      notificationService.warning(
        "Tùy chọn món chưa hợp lệ",
        problems[0],
        { audience: "restaurant", key: "food-add-options-invalid" }
      );
      return;
    }

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("price", Number(data.price));
    formData.append("category", data.category.trim()); // Trim space để sạch sẽ
    formData.append("image", image);
    // multipart can't carry structured data, so the server parses this string.
    formData.append(
      "optionGroups",
      JSON.stringify(normaliseOptionGroups(optionGroups))
    );

    try {
      setSubmitting(true);
      const response = await axios.post(`${url}/api/food/add`, formData, {
        // Sử dụng prop url
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.data.success) {
        resetForm();
        notificationService.success(response.data.message || "Thêm món ăn thành công", undefined, { audience: "restaurant" });
        onSuccess?.();
      } else {
        // Keep what they typed so they can fix it and resubmit.
        notificationService.error(
          "Không thể thêm món ăn",
          response.data.message || "Vui lòng kiểm tra lại thông tin món và thử lại.",
          {
            audience: "restaurant",
            priority: "high",
            key: `food-add-${data.name}`,
            actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
          }
        );
      }
    } catch (error) {
      notificationService.error(
        "Không thể thêm món ăn",
        error.response?.data?.message || "Lỗi kết nối máy chủ. Vui lòng thử lại sau.",
        {
          audience: "restaurant",
          priority: "high",
          persistent: true,
          duration: 0,
          key: `food-add-${data.name}`,
          actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add">
      <div className="add-header">
        <h1 className="add-title">Add Item</h1>
        <p className="add-subtitle">Put a new dish on your menu</p>
      </div>

      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p>Upload Image</p>
          <label htmlFor="image">
            <img
              className="image"
              src={preview || assets.upload_area}
              alt={preview ? "Selected product image" : "Upload a product image"}
            />
          </label>
          <input
            ref={fileInputRef}
            onChange={(e) => setImage(e.target.files[0] || null)}
            type="file"
            accept="image/*"
            id="image"
            hidden
          />
        </div>
        <div className="add-product-name flex-col">
          <p>Product name</p>
          <input
            onChange={onChangeHandler}
            value={data.name}
            type="text"
            name="name"
            placeholder="e.g. Milk tea with pearls"
            required
          />
        </div>
        <div className="add-product-description flex-col">
          <p>Product Description</p>
          <textarea
            onChange={onChangeHandler}
            value={data.description}
            name="description"
            rows="6"
            placeholder="What's in it? Anything the customer should know."
            required
          ></textarea>
        </div>
        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Product Category</p>
            <input
              className="selectt"
              onChange={onChangeHandler}
              value={data.category}
              type="text"
              name="category"
              list="known-categories"
              placeholder="e.g. Milk tea, Rice, Chicken"
              required
            />
            {/* Pick an existing one to keep the menu grouped consistently,
                or type a brand-new category. */}
            <datalist id="known-categories">
              {knownCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div className="add-price flex-col">
            <p>Product Price (VND)</p>
            <input
              id="add-product-price"
              className="inputclasa"
              onChange={onChangeHandler}
              value={data.price}
              type="number"
              name="price"
              min="0"
              step="any"
              placeholder="20000"
              required
              aria-invalid={!!priceError}
              aria-describedby={priceError ? "add-price-error" : undefined}
            />
            {priceError && (
              <p
                id="add-price-error"
                role="alert"
                style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}
              >
                {priceError}
              </p>
            )}
          </div>
        </div>
        <OptionGroupBuilder value={optionGroups} onChange={setOptionGroups} />
        <button type="submit" className="add-btn" disabled={submitting}>
          {submitting ? "Adding…" : "Add item"}
        </button>
      </form>
    </div>
  );
};

export default Add;
