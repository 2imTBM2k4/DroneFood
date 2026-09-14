import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./List.css";
import axios from "axios";
import { toast } from "react-toastify";
import EditProduct from "../Products/EditProduct";
import { Pencil, Trash2, Search, X } from "lucide-react";
import { formatVND } from "../../../../shared/utils/money";

const List = ({ url }) => {
  const [list, setList] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  // Deleting a dish also drops its image, so it asks first.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      toast.error("Please login to view your foods.");
      navigate("/login");
      return;
    }
    fetchList();
  }, [user]);

  const fetchList = async () => {
    const token = localStorage.getItem("token");
    if (!token || !user) {
      toast.error("No authentication. Please login again.");
      navigate("/login");
      return;
    }

    try {
      const response = await axios.get(`${url}/api/food/list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.success) {
        setList(response.data.data);
      } else {
        toast.error(
          "Error fetching list: " + (response.data.message || "Unknown error")
        );
      }
    } catch (error) {
      console.error("Fetch list error:", error);
      if (error.response?.status === 403) {
        toast.error("Access denied. Your account may be pending approval.");
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        toast.error("Error fetching food list");
      }
    }
  };

  const confirmRemove = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("No authentication token found. Please login again.");
      return;
    }
    if (!pendingDelete || deleting) return;

    const foodId = pendingDelete._id;
    setDeleting(true);
    try {
      const response = await axios.post(
        `${url}/api/food/remove`,
        { id: foodId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        await fetchList();
      } else {
        toast.error("Error removing food");
      }
    } catch (error) {
      console.error("Remove food error:", error);
      toast.error("Error removing food");
    } finally {
      // Always clear the target, or the next delete could hit the wrong dish.
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const editFood = (product) => {
    setEditingProduct(product);
  };

  const closeEditModal = () => {
    setEditingProduct(null);
  };

  const getImgSrc = (img) => {
    if (!img) return "/placeholder.jpg";
    return img.startsWith("http") ? img : `${url}/images/${img}`;
  };

  const categories = [...new Set(list.map((item) => item.category))].filter(Boolean);

  const query = search.trim().toLowerCase();
  const visible = list.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesQuery =
      !query ||
      item.name?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });


  return (
    <div className="list-page">
      <div className="list-header">
        <div>
          <h1 className="list-title">Menu Items</h1>
          <p className="list-subtitle">Manage your restaurant menu</p>
        </div>
        <button className="add-item-btn" onClick={() => navigate("/add")}>
          + Add Item
        </button>
      </div>

      <div className="list-filters">
        <div className="list-search">
          <Search size={18} className="list-search-icon" />
          <input
            type="text"
            className="list-search-input"
            placeholder="Search dishes by name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search dishes"
          />
          {search && (
            <button
              type="button"
              className="list-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="list-chips">
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`list-chip ${category === cat ? "active" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="list-card">
        <div className="list-table">
          <div className="list-table-format title">
            <b>Image</b>
            <b>Name</b>
            <b>Category</b>
            <b>Price</b>
            <b>Actions</b>
          </div>
          {visible.length === 0 ? (
            <div className="list-empty">
              <p>
                {list.length === 0
                  ? "No menu items yet. Add your first item to get started."
                  : "No dishes match this search or category."}
              </p>
            </div>
          ) : (
            visible.map((item, index) => (
              <div key={index} className="list-table-format">
                <img
                  src={getImgSrc(item.image)}
                  alt={item.name}
                  onError={(e) => {
                    e.target.src = "/placeholder.jpg";
                  }}
                />
                <p className="item-name">{item.name}</p>
                <span className="category-badge">{item.category}</span>
                <p className="item-price">{formatVND(item.price)}</p>
                <div className="actions">
                  <button
                    onClick={() => editFood(item)}
                    className="action-btn action-btn--edit"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setPendingDelete(item)}
                    className="action-btn action-btn--delete"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingDelete && (
        <div
          className="edit-modal"
          onClick={() => !deleting && setPendingDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Remove dish"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove dish</h3>
              <span className="close" onClick={() => setPendingDelete(null)}>
                &times;
              </span>
            </div>
            <p className="remove-dialog-lead">
              Remove <strong>{pendingDelete.name}</strong> from your menu? Its
              photo is deleted too and this can't be undone.
            </p>
            <div className="modal-buttons">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                Keep it
              </button>
              <button
                type="button"
                className="action-btn--delete remove-confirm-btn"
                onClick={confirmRemove}
                disabled={deleting}
              >
                {deleting ? "Removing…" : "Remove dish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <EditProduct
          url={url}
          product={editingProduct}
          onClose={closeEditModal}
          onUpdate={fetchList}
        />
      )}
    </div>
  );
};

export default List;
