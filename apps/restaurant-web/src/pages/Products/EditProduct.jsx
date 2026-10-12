import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { assets } from "../../assets/assets";
import "../Add/Add.css";
import "./EditProduct.css";
import OptionGroupBuilder, {
  validateOptionGroups,
  normaliseOptionGroups,
} from "@drone-food/web-ui/components/OptionGroupBuilder";

const EditProduct = ({ url, product, onClose, onUpdate }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [optionGroups, setOptionGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [knownCategories, setKnownCategories] = useState([]);
  const fileInputRef = useRef(null);

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
      .catch(() => {});
  }, [url]);

  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const [data, setData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
  });

  useEffect(() => {
    if (product) {
      setData({
        name: product.name || "",
        description: product.description || "",
        price: product.price ?? "",
        category: product.category || "",
      });
      setOptionGroups(
        (product.optionGroups || []).map((group) => ({
          ...group,
          options: (group.options || []).map((option) => ({ ...option })),
        }))
      );
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [product]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((current) => ({ ...current, [name]: value }));
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

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (submitting) return;

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

    if (!data.category.trim()) {
      notificationService.warning(
        "Danh mục món trống",
        "Vui lòng nhập hoặc chọn danh mục cho món ăn.",
        { audience: "restaurant", key: "food-edit-category-empty" }
      );
      return;
    }

    const problems = validateOptionGroups(optionGroups);
    if (problems.length > 0) {
      notificationService.warning(
        "Tùy chọn món chưa hợp lệ",
        problems[0],
        { audience: "restaurant", key: "food-edit-options-invalid" }
      );
      return;
    }

    const formData = new FormData();
    formData.append("id", product._id);
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("price", Number(data.price));
    formData.append("category", data.category.trim());
    formData.append(
      "optionGroups",
      JSON.stringify(normaliseOptionGroups(optionGroups))
    );
    if (image) {
      formData.append("image", image);
    }

    try {
      setSubmitting(true);
      const response = await axios.post(`${url}/api/food/update`, formData);
      if (response.data.success) {
        notificationService.success(
          response.data.message || "Cập nhật món ăn thành công",
          undefined,
          { audience: "restaurant" }
        );
        onUpdate();
        onClose();
      } else {
        notificationService.error(
          "Không thể cập nhật món ăn",
          response.data.message || "Vui lòng kiểm tra lại thông tin món và thử lại.",
          {
            audience: "restaurant",
            priority: "high",
            key: `food-update-${product._id}`,
            actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
          }
        );
      }
    } catch (error) {
      notificationService.error(
        "Không thể cập nhật món ăn",
        error.response?.data?.message || "Lỗi kết nối khi cập nhật món. Vui lòng thử lại sau.",
        {
          audience: "restaurant",
          priority: "high",
          persistent: true,
          duration: 0,
          key: `food-update-${product._id}`,
          actions: [{ label: "Thử lại", onClick: onSubmitHandler }],
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentImageSrc = product?.image
    ? product.image.startsWith("http")
      ? product.image
      : `${url}/images/${product.image}`
    : "";

  return (
    <div className="add edit-product">
      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p>Upload Image</p>
          <label htmlFor="edit-image" className="edit-img-label">
            <img
              className="image"
              src={preview || currentImageSrc || assets.upload_area}
              alt={preview ? "Selected product image" : "Product image"}
            />
          </label>
          <input
            ref={fileInputRef}
            onChange={(e) => setImage(e.target.files[0] || null)}
            type="file"
            accept="image/*"
            id="edit-image"
            hidden
          />
          <p className="upload-text">Click image to upload new photo</p>
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
              list="edit-known-categories"
              placeholder="e.g. Milk tea, Rice, Chicken"
              required
            />
            <datalist id="edit-known-categories">
              {knownCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
          <div className="add-price flex-col">
            <p>Product Price (VND)</p>
            <input
              id="edit-product-price"
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
              aria-describedby={priceError ? "edit-price-error" : undefined}
            />
            {priceError && (
              <p
                id="edit-price-error"
                role="alert"
                style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}
              >
                {priceError}
              </p>
            )}
          </div>
        </div>

        <OptionGroupBuilder value={optionGroups} onChange={setOptionGroups} />

        <div className="edit-actions">
          <button type="submit" className="add-btn" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="cancel-btn edit-cancel-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProduct;
