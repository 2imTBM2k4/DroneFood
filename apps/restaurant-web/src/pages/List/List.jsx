import React, { useEffect, useState, useContext } from "react";
import { createPortal } from "react-dom";
import { AuthContext } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./List.css";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import EditProduct from "../Products/EditProduct";
import { Pencil, Trash2, Search, X, Plus, Power, Info } from "lucide-react";
import Add from "../Add/Add";
import { formatVND } from "@drone-food/web-ui/utils/money";

const List = ({ url }) => {
  const [list, setList] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  // Deleting a dish also drops its image, so it asks first.
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [changingAvailability, setChangingAvailability] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const { user } = useContext(AuthContext);
  const { currentBranch, selectedBranchId, branches, merchant } = useBranch();
  const navigate = useNavigate();

  const merchantType = merchant?.type || user?.merchantType || "individual";
  const isBrandOwner = (user?.role === "merchant_owner" || user?.role === "admin") && merchantType === "brand";
  const isBranchManager = user?.role === "branch_manager";
  const targetBranchId = isBranchManager
    ? currentBranch?._id || branches[0]?._id
    : selectedBranchId && selectedBranchId !== "all"
    ? selectedBranchId
    : null;

  useEffect(() => {
    if (!user) {
      notificationService.warning(
        "Vui lòng đăng nhập",
        "Bạn cần đăng nhập để quản lý thực đơn món ăn.",
        { audience: "restaurant", key: "food-list-login-required" }
      );
      navigate("/login");
      return;
    }
    fetchList();
  }, [user, targetBranchId]);

  const fetchList = async () => {
    const token = localStorage.getItem("token");
    if (!token || !user) {
      notificationService.warning(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại để xem danh sách món ăn.",
        { audience: "restaurant", key: "food-list-auth-expired" }
      );
      navigate("/login");
      return;
    }

    try {
      const requestUrl = targetBranchId
        ? `${url}/api/food/list?branchId=${targetBranchId}`
        : `${url}/api/food/list`;
      const response = await axios.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.data.success) {
        setList(response.data.data);
      } else {
        notificationService.error(
          "Không thể tải danh sách món",
          response.data.message || "Vui lòng kiểm tra lại kết nối.",
          {
            audience: "restaurant",
            priority: "high",
            key: "food-list-load",
            actions: [{ label: "Thử lại", onClick: fetchList }],
          }
        );
      }
    } catch (error) {
      console.error("Fetch list error:", error);
      if (error.response?.status === 403) {
        notificationService.warning(
          "Tài khoản chưa được kích hoạt",
          "Tài khoản của bạn có thể đang chờ admin phê duyệt.",
          { audience: "restaurant", key: "food-list-pending-approval" }
        );
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        notificationService.error(
          "Không thể tải danh sách món",
          "Lỗi kết nối máy chủ khi lấy danh sách món ăn.",
          {
            audience: "restaurant",
            priority: "high",
            persistent: true,
            duration: 0,
            key: "food-list-load",
            actions: [{ label: "Thử lại", onClick: fetchList }],
          }
        );
      }
    }
  };

  const confirmRemove = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.warning(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại để thực hiện thao tác xóa món.",
        { audience: "restaurant", key: "food-remove-auth-expired" }
      );
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
        notificationService.success(response.data.message || "Đã xóa món ăn thành công", undefined, { audience: "restaurant" });
        await fetchList();
      } else {
        notificationService.error(
          "Không thể xóa món ăn",
          response.data.message || "Lỗi khi xóa món khỏi thực đơn. Vui lòng thử lại.",
          {
            audience: "restaurant",
            priority: "high",
            key: `food-remove-${foodId}`,
          }
        );
      }
    } catch (error) {
      console.error("Remove food error:", error);
      notificationService.error(
        "Không thể xóa món ăn",
        error.response?.data?.message || "Lỗi khi xóa món khỏi thực đơn. Vui lòng thử lại.",
        {
          audience: "restaurant",
          priority: "high",
          key: `food-remove-${foodId}`,
        }
      );
    } finally {
      // Always clear the target, or the next delete could hit the wrong dish.
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const editFood = (product) => {
    setEditingProduct(product);
  };

  const toggleAvailability = async (item) => {
    const token = localStorage.getItem("token");
    if (!token || changingAvailability) return;
    setChangingAvailability(item._id);

    if (isBranchManager) {
      if (!targetBranchId) {
        notificationService.warning(
          "Chưa xác định chi nhánh",
          "Không tìm thấy thông tin chi nhánh quản lý.",
          { audience: "restaurant" }
        );
        setChangingAvailability("");
        return;
      }
      const isCurrentlyAvail = item.isBranchAvailable !== false && !item.isSoldOutAtBranch;
      const nextState = !isCurrentlyAvail;
      try {
        const response = await axios.patch(
          `${url}/api/food/${item._id}/branch-availability`,
          { branchId: targetBranchId, isAvailable: nextState },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.data.success) throw new Error(response.data.message);
        setList((current) =>
          current.map((food) =>
            food._id === item._id
              ? { ...food, isBranchAvailable: nextState, isSoldOutAtBranch: !nextState }
              : food
          )
        );
        notificationService.success(
          nextState ? "Đã bật món tại chi nhánh" : "Đã chuyển sang tạm hết tại chi nhánh",
          undefined,
          { audience: "restaurant", key: `food-avail-success-${item._id}` }
        );
      } catch (error) {
        notificationService.error(
          "Không thể cập nhật trạng thái món",
          error.response?.data?.message || error.message || "Lỗi khi cập nhật.",
          { audience: "restaurant", priority: "high", key: `food-avail-${item._id}` }
        );
      } finally {
        setChangingAvailability("");
      }
    } else {
      try {
        const response = await axios.patch(
          `${url}/api/food/${item._id}/availability`,
          { isAvailable: item.isAvailable === false },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.data.success) throw new Error(response.data.message);
        setList((current) =>
          current.map((food) =>
            food._id === item._id ? { ...food, isAvailable: response.data.food.isAvailable } : food
          )
        );
        const successMsg = isBrandOwner
          ? (item.isAvailable === false ? "Món ăn đã bật bán toàn chuỗi" : "Món ăn đã chuyển sang hết hàng toàn chuỗi")
          : (item.isAvailable === false ? "Món ăn đã bật bán" : "Món ăn đã chuyển sang hết hàng");
        notificationService.success(
          successMsg,
          undefined,
          { audience: "restaurant", key: `food-avail-success-${item._id}` }
        );
      } catch (error) {
        notificationService.error(
          "Không thể cập nhật trạng thái món",
          error.response?.data?.message || error.message || "Không thể cập nhật trạng thái bán.",
          {
            audience: "restaurant",
            priority: "high",
            key: `food-avail-${item._id}`,
          }
        );
      } finally {
        setChangingAvailability("");
      }
    }
  };

  const closeEditModal = () => {
    setEditingProduct(null);
  };

  const closeAddModal = () => {
    setAddOpen(false);
    setSearchParams({});
  };

  const handleProductAdded = async () => {
    closeAddModal();
    await fetchList();
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editingProduct) closeEditModal();
        if (addOpen) closeAddModal();
        if (pendingDelete && !deleting) setPendingDelete(null);
      }
    };
    if (editingProduct || addOpen || pendingDelete) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [editingProduct, addOpen, pendingDelete, deleting]);

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
        {!isBranchManager && (
          <button className="add-item-btn" onClick={() => { setAddOpen(true); setSearchParams({ add: "1" }); }}>
            <Plus size={17} aria-hidden="true" /> Add Item
          </button>
        )}
      </div>

      {isBranchManager && (
        <div className="list-role-banner">
          <Info size={18} />
          <span>
            <strong>Thực đơn chi nhánh {currentBranch?.name ? `(${currentBranch.name})` : ""}:</strong> Danh mục và giá do chủ thương hiệu quản lý tập trung. Quản lý chi nhánh có quyền <strong>bật / tắt trạng thái món</strong> tại chi nhánh khi tạm hết nguyên liệu.
          </span>
        </div>
      )}

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
            <b>Availability</b>
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
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/placeholder.jpg";
                  }}
                />
                <p className="item-name">{item.name}</p>
                <span className="category-badge">{item.category}</span>
                <p className="item-price">{formatVND(item.price)}</p>
                {isBranchManager ? (
                  item.isAvailable === false ? (
                    <button
                      type="button"
                      className="availability-toggle sold-out"
                      disabled={true}
                      title="Chủ thương hiệu đã tắt món này trên toàn chuỗi"
                    >
                      <Power size={15} aria-hidden="true" />
                      <span>Hết hàng toàn chuỗi</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`availability-toggle ${
                        item.isBranchAvailable === false || item.isSoldOutAtBranch ? "sold-out" : ""
                      }`}
                      onClick={() => toggleAvailability(item)}
                      disabled={changingAvailability === item._id}
                      aria-pressed={item.isBranchAvailable !== false && !item.isSoldOutAtBranch}
                      title="Bấm để bật/tắt món tại chi nhánh của bạn"
                    >
                      <Power size={15} aria-hidden="true" />
                      <span>
                        {changingAvailability === item._id
                          ? "Saving…"
                          : item.isBranchAvailable === false || item.isSoldOutAtBranch
                          ? "Tạm hết tại CN"
                          : "Đang bán tại CN"}
                      </span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={`availability-toggle ${item.isAvailable === false ? "sold-out" : ""}`}
                    onClick={() => toggleAvailability(item)}
                    disabled={changingAvailability === item._id}
                    aria-pressed={item.isAvailable !== false}
                  >
                    <Power size={15} aria-hidden="true" />
                    <span>
                      {changingAvailability === item._id
                        ? "Saving…"
                        : item.isAvailable === false
                        ? "Sold out"
                        : "Available"}
                    </span>
                  </button>
                )}
                <div className="actions">
                  {isBranchManager ? (
                    <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>Chỉ xem</span>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingDelete && createPortal(
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
        </div>,
        document.body
      )}

      {editingProduct && createPortal(
        <div
          className="edit-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Edit menu item"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal();
          }}
        >
          <div className="modal-content list-add-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header list-add-modal-header">
              <h3>Edit menu item</h3>
              <button
                type="button"
                className="close"
                aria-label="Close edit item form"
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>
            <EditProduct
              url={url}
              product={editingProduct}
              onClose={closeEditModal}
              onUpdate={fetchList}
            />
          </div>
        </div>,
        document.body
      )}
      {addOpen && createPortal(
        <div
          className="edit-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Add menu item"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAddModal();
          }}
        >
          <div className="modal-content list-add-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header list-add-modal-header">
              <h3>Add menu item</h3>
              <button type="button" className="close" aria-label="Close add item form" onClick={closeAddModal}>×</button>
            </div>
            <Add url={url} onSuccess={handleProductAdded} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default List;
