import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./EditProduct.css";
import OptionGroupBuilder, {
  validateOptionGroups,
  normaliseOptionGroups,
} from "../../../../shared/components/OptionGroupBuilder";

const EditProduct = ({ url, product, onClose, onUpdate }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [optionGroups, setOptionGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // One blob URL per chosen file, revoked when it changes — calling
  // createObjectURL in the render body leaks one per render.
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
    category: "", // Đổi default từ "Salad" sang "" (useEffect sẽ load từ product)
  });

  useEffect(() => {
    if (product) {
      setData({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category, // Load category từ product (string tự do)
      });
      // Clone so editing doesn't mutate the list's copy of the product.
      setOptionGroups(
        (product.optionGroups || []).map((group) => ({
          ...group,
          options: (group.options || []).map((option) => ({ ...option })),
        }))
      );
    }
  }, [product]);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (submitting) return;

    // Thêm validation đơn giản cho category (tùy chọn)
    if (!data.category.trim()) {
      toast.error("Category không được để trống!");
      return;
    }

    const problems = validateOptionGroups(optionGroups);
    if (problems.length > 0) {
      toast.error(problems[0]);
      return;
    }

    const formData = new FormData();
    formData.append("id", product._id);
    formData.append("name", data.name);
    formData.append("description", data.description);
    formData.append("price", Number(data.price));
    formData.append("category", data.category.trim()); // Trim space để sạch sẽ
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
        toast.success(response.data.message);
        onUpdate();
        onClose();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error updating product"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Images are Cloudinary URLs now; only legacy local paths need the prefix.
  const currentImageSrc = product?.image?.startsWith("http")
    ? product.image
    : `${url}/images/${product?.image}`;

  return (
    <div className="edit-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Product</h2>
          <span className="close" onClick={onClose}>
            &times;
          </span>
        </div>
        <form className="flex-col" onSubmit={onSubmitHandler}>
          <div className="add-img-upload flex-col">
            <p>Current Image</p>
            <label htmlFor="edit-image">
              <img
                className="image"
                src={preview || currentImageSrc}
                alt={preview ? "New product image" : "Current product image"}
              />
            </label>
            <input
              onChange={(e) => setImage(e.target.files[0] || null)}
              type="file"
              accept="image/*"
              id="edit-image"
              hidden
            />
            <p className="upload-text">Click to upload new image</p>
          </div>
          <div className="add-product-name flex-col">
            <p>Product name</p>
            <input
              onChange={onChangeHandler}
              value={data.name}
              type="text"
              name="name"
              placeholder="Type here"
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
              placeholder="Write content here"
              required
            ></textarea>
          </div>
          <div className="add-category-price">
            <div className="add-category flex-col">
              <p>Product Category</p>
              <input // Thay select bằng input text
                className="selectt" // Giữ class CSS cũ
                onChange={onChangeHandler}
                value={data.category}
                type="text"
                name="category"
                placeholder="Nhập category (ví dụ: Salad, Rolls...)"
                required // Bắt buộc nhập
              />
            </div>
            <div className="add-price flex-col">
              <p>Product Price (VND)</p>
              <input
                className="inputclasa"
                onChange={onChangeHandler}
                value={data.price}
                type="Number"
                name="price"
                placeholder="50000"
                required
              />
            </div>
          </div>
          <OptionGroupBuilder value={optionGroups} onChange={setOptionGroups} />
          <div className="modal-buttons">
            <button type="button" className="cancel-btn" onClick={onClose}>
              CANCEL
            </button>
            <button type="submit" className="update-btn" disabled={submitting}>
              {submitting ? "UPDATING…" : "UPDATE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
