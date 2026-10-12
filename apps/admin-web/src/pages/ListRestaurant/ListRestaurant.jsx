import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import ConfirmModal from "@drone-food/web-ui/components/ConfirmModal";
import "./ListRestaurant.css";

const TABLE_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "description", label: "Description" },
  { key: "ownerEmail", label: "Owner Email" },
  { key: "status", label: "Status" },
];

const collator = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
});

const getSortValue = (restaurant, key) => {
  const values = {
    name: restaurant.name,
    address: restaurant.address,
    phone: restaurant.phone,
    description: restaurant.description,
    ownerEmail: restaurant.owner?.email,
    status: restaurant.isLocked ? "Locked" : "Active",
  };

  return values[key] ?? "";
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const DetailItem = ({ label, children, wide = false }) => (
  <div className={`restaurant-detail-item${wide ? " restaurant-detail-item--wide" : ""}`}>
    <dt>{label}</dt>
    <dd>{children ?? "N/A"}</dd>
  </div>
);

const SortIcon = ({ active, direction }) => {
  if (!active) return <ChevronsUpDown size={14} aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp size={14} aria-hidden="true" />
  ) : (
    <ArrowDown size={14} aria-hidden="true" />
  );
};

const ListRestaurant = ({ url }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [lockingId, setLockingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastFocusedElementRef = useRef(null);

  const fetchList = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.warning(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại để xem danh sách nhà hàng.",
        { audience: "admin", key: "restaurant-list-auth-expired" }
      );
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
        notificationService.error(
          "Không thể tải danh sách nhà hàng",
          response.data.message || "Lỗi khi lấy dữ liệu nhà hàng.",
          {
            audience: "admin",
            priority: "high",
            key: "restaurant-list-load",
            actions: [{ label: "Thử lại", onClick: fetchList }],
          }
        );
      }
    } catch (error) {
      console.error("Fetch restaurants error:", error);
      notificationService.error(
        "Không thể tải danh sách nhà hàng",
        error.response?.data?.message || "Lỗi kết nối khi tải danh sách nhà hàng.",
        {
          audience: "admin",
          priority: "high",
          persistent: true,
          duration: 0,
          key: "restaurant-list-load",
          actions: [{ label: "Thử lại", onClick: fetchList }],
        }
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  const closeDetails = useCallback(() => {
    setSelectedRestaurant(null);
    requestAnimationFrame(() => lastFocusedElementRef.current?.focus());
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!selectedRestaurant) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeDetails();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDetails, selectedRestaurant]);

  const visibleRestaurants = useMemo(() => {
    const query = deferredSearchTerm.trim().toLocaleLowerCase("vi-VN");
    const filtered = query
      ? list.filter((restaurant) => {
          const searchableValues = [
            restaurant.name,
            restaurant.address,
            restaurant.phone,
            restaurant.description,
            restaurant.email,
            restaurant.owner?.name,
            restaurant.owner?.email,
            restaurant.isLocked ? "locked" : "active",
          ];
          return searchableValues.some((value) =>
            String(value ?? "")
              .toLocaleLowerCase("vi-VN")
              .includes(query)
          );
        })
      : list;

    return [...filtered].sort((first, second) => {
      const comparison = collator.compare(
        String(getSortValue(first, sortConfig.key)),
        String(getSortValue(second, sortConfig.key))
      );
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [deferredSearchTerm, list, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const openDetails = (restaurant, event) => {
    lastFocusedElementRef.current = event.currentTarget;
    setSelectedRestaurant(restaurant);
  };

  const toggleLock = async (restaurantId, isLocked) => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.warning(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại để thay đổi trạng thái nhà hàng.",
        { audience: "admin", key: "restaurant-lock-auth-expired" }
      );
      return;
    }

    try {
      setLockingId(restaurantId);
      const response = await axios.put(
        `${url}/api/restaurant/${restaurantId}/lock`,
        { isLocked },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        notificationService.success(response.data.message || (isLocked ? "Đã khóa nhà hàng thành công" : "Đã mở khóa nhà hàng thành công"), undefined, { audience: "admin", key: `restaurant-lock-success-${restaurantId}` });
        await fetchList();
      } else {
        notificationService.error(
          "Không thể cập nhật trạng thái nhà hàng",
          response.data.message || "Lỗi khi cập nhật trạng thái khóa/mở khóa.",
          {
            audience: "admin",
            priority: "high",
            key: `restaurant-lock-${restaurantId}`,
          }
        );
      }
    } catch (error) {
      console.error("Toggle lock error:", error);
      notificationService.error(
        "Không thể cập nhật trạng thái nhà hàng",
        error.response?.data?.message || "Lỗi kết nối khi cập nhật trạng thái nhà hàng.",
        {
          audience: "admin",
          priority: "high",
          key: `restaurant-lock-${restaurantId}`,
        }
      );
    } finally {
      setLockingId("");
    }
  };

  const [deletingRestaurantId, setDeletingRestaurantId] = useState(null);

  const removeRestaurant = (restaurantId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.warning(
        "Phiên đăng nhập hết hạn",
        "Vui lòng đăng nhập lại để xóa nhà hàng.",
        { audience: "admin", key: "restaurant-delete-auth-expired" }
      );
      return;
    }
    setDeletingRestaurantId(restaurantId);
  };

  const handleConfirmDeleteRestaurant = async () => {
    if (!deletingRestaurantId) return;
    const token = localStorage.getItem("token");
    try {
      setDeletingId(deletingRestaurantId);
      const response = await axios.delete(`${url}/api/restaurant`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { id: deletingRestaurantId },
      });

      if (response.data.success) {
        notificationService.success(response.data.message || "Đã xóa nhà hàng thành công", undefined, { audience: "admin" });
        setDeletingRestaurantId(null);
        await fetchList();
      } else {
        notificationService.error(
          "Không thể xóa nhà hàng",
          response.data.message || "Không thể xóa nhà hàng.",
          {
            audience: "admin",
            priority: "high",
            key: `restaurant-delete-${deletingRestaurantId}`,
          }
        );
      }
    } catch (error) {
      console.error("Delete restaurant error:", error);
      notificationService.error(
        "Không thể xóa nhà hàng",
        error.response?.data?.message || "Không thể xóa nhà hàng.",
        {
          audience: "admin",
          priority: "high",
          key: `restaurant-delete-${deletingRestaurantId}`,
        }
      );
    } finally {
      setDeletingId("");
    }
  };

  const imageUrl = selectedRestaurant?.image
    ? selectedRestaurant.image.startsWith("http")
      ? selectedRestaurant.image
      : `${url}/${selectedRestaurant.image.replace(/^\//, "")}`
    : "";

  return (
    <section className="restaurants-list" aria-labelledby="restaurants-title">
      <header className="restaurants-list__header">
        <div>
          <p className="restaurants-list__eyebrow">Restaurant management</p>
          <h1 id="restaurants-title">All Restaurants</h1>
          <p className="restaurants-list__subtitle">
            Search, sort and review restaurant information before taking action.
          </p>
        </div>
        <div className="restaurants-list__count" aria-live="polite">
          <Building2 size={17} aria-hidden="true" />
          <span>
            {visibleRestaurants.length} of {list.length} restaurants
          </span>
        </div>
      </header>

      <div className="restaurants-toolbar">
        <label className="restaurants-search">
          <span className="sr-only">Search restaurants</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, address, phone, email or status…"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear restaurant search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div className="restaurants-table-card">
        {loading ? (
          <div className="restaurants-state" role="status">
            Loading restaurants…
          </div>
        ) : visibleRestaurants.length === 0 ? (
          <div className="restaurants-state">
            <Building2 size={26} aria-hidden="true" />
            <strong>{list.length === 0 ? "No restaurants found" : "No matching restaurants"}</strong>
            <span>
              {list.length === 0
                ? "Restaurant records will appear here."
                : "Try a different name, address, phone number or email."}
            </span>
          </div>
        ) : (
          <div className="restaurants-table-scroll">
            <table className="restaurants-table">
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((column) => {
                    const active = sortConfig.key === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          active
                            ? sortConfig.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={`restaurant-sort${active ? " restaurant-sort--active" : ""}`}
                          onClick={() => handleSort(column.key)}
                        >
                          <span>{column.label}</span>
                          <SortIcon active={active} direction={sortConfig.direction} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="restaurants-table__actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRestaurants.map((item) => (
                  <tr
                    key={item._id}
                    className="restaurant-row"
                    tabIndex={0}
                    onClick={(event) => openDetails(item, event)}
                    onKeyDown={(event) => {
                      if (
                        event.currentTarget === event.target &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        openDetails(item, event);
                      }
                    }}
                  >
                    <td data-label="Name">
                      <button
                        type="button"
                        className="restaurant-name-button"
                        aria-label={`View details for ${item.name}`}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td data-label="Address" className="restaurant-cell--wrap">
                      {item.address}
                    </td>
                    <td data-label="Phone" className="restaurant-cell--numeric">
                      {item.phone || "N/A"}
                    </td>
                    <td data-label="Description" className="restaurant-cell--wrap">
                      {item.description || "N/A"}
                    </td>
                    <td data-label="Owner Email" className="restaurant-cell--wrap">
                      {item.owner?.email || "N/A"}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`status-pill ${
                          item.isLocked
                            ? "status-pill--locked"
                            : "status-pill--active"
                        }`}
                      >
                        {item.isLocked ? "Locked" : "Active"}
                      </span>
                    </td>
                    <td
                      data-label="Actions"
                      className="restaurant-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => toggleLock(item._id, !item.isLocked)}
                        className={`restaurant-action restaurant-action--lock ${
                          item.isLocked
                            ? "restaurant-action--unlock"
                            : "restaurant-action--restrict"
                        }`}
                        disabled={lockingId === item._id || deletingId === item._id}
                      >
                        {lockingId === item._id
                          ? "Saving…"
                          : item.isLocked
                            ? "Unlock"
                            : "Lock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRestaurant(item._id)}
                        className="restaurant-action restaurant-action--delete"
                        disabled={deletingId === item._id || lockingId === item._id}
                      >
                        {deletingId === item._id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRestaurant && createPortal(
        <div className="restaurant-modal-backdrop" onMouseDown={closeDetails}>
          <div
            ref={dialogRef}
            className="restaurant-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restaurant-modal-title"
            aria-describedby="restaurant-modal-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="restaurant-modal__header">
              <div>
                <p className="restaurants-list__eyebrow">Restaurant details</p>
                <h2 id="restaurant-modal-title">{selectedRestaurant.name}</h2>
                <p id="restaurant-modal-description">
                  Complete information available to the admin account.
                </p>
              </div>
            </header>

            <div className="restaurant-modal__body">
              <div className="restaurant-detail-hero">
                {imageUrl ? (
                  <img src={imageUrl} alt={`${selectedRestaurant.name} storefront`} />
                ) : (
                  <div className="restaurant-detail-hero__placeholder" aria-hidden="true">
                    <Building2 size={32} />
                  </div>
                )}
                <div>
                  <span
                    className={`status-pill ${
                      selectedRestaurant.isLocked
                        ? "status-pill--locked"
                        : "status-pill--active"
                    }`}
                  >
                    {selectedRestaurant.isLocked ? "Locked" : "Active"}
                  </span>
                  <p>{selectedRestaurant.address}</p>
                </div>
              </div>

              <section className="restaurant-detail-section">
                <h3>General information</h3>
                <dl className="restaurant-detail-grid">
                  <DetailItem label="Restaurant ID">{selectedRestaurant._id}</DetailItem>
                  <DetailItem label="Restaurant email">{selectedRestaurant.email || "N/A"}</DetailItem>
                  <DetailItem label="Phone">{selectedRestaurant.phone || "N/A"}</DetailItem>
                  <DetailItem label="Created at">{formatDateTime(selectedRestaurant.createdAt)}</DetailItem>
                  <DetailItem label="Address" wide>{selectedRestaurant.address}</DetailItem>
                  <DetailItem label="Description" wide>{selectedRestaurant.description || "N/A"}</DetailItem>
                </dl>
              </section>

              <section className="restaurant-detail-section">
                <h3>Owner</h3>
                <dl className="restaurant-detail-grid">
                  <DetailItem label="Owner name">{selectedRestaurant.owner?.name || "N/A"}</DetailItem>
                  <DetailItem label="Owner email">{selectedRestaurant.owner?.email || "N/A"}</DetailItem>
                  <DetailItem label="Owner ID" wide>{selectedRestaurant.owner?._id || "N/A"}</DetailItem>
                </dl>
              </section>

              <section className="restaurant-detail-section">
                <h3>Operations</h3>
                <dl className="restaurant-detail-grid">
                  <DetailItem label="Admin access status">
                    {selectedRestaurant.isLocked ? "Locked" : "Active"}
                  </DetailItem>
                  <DetailItem label="Owner open switch">
                    {selectedRestaurant.isOpen === false ? "Closed" : "Open"}
                  </DetailItem>
                  <DetailItem label="Open now">
                    {selectedRestaurant.isOpenNow ? "Yes" : "No"}
                  </DetailItem>
                  <DetailItem label="Opening hours">
                    {selectedRestaurant.openingHours?.openTime || "N/A"} – {selectedRestaurant.openingHours?.closeTime || "N/A"}
                  </DetailItem>
                  <DetailItem label="Average rating">
                    {selectedRestaurant.averageRating == null
                      ? "No ratings"
                      : `${Number(selectedRestaurant.averageRating).toFixed(1)} / 5`}
                  </DetailItem>
                  <DetailItem label="Rating count">
                    {selectedRestaurant.ratingCount ?? 0}
                  </DetailItem>
                </dl>
              </section>

            </div>

            <footer className="restaurant-modal__footer">
              <button ref={closeButtonRef} type="button" onClick={closeDetails}>Close</button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        open={Boolean(deletingRestaurantId)}
        title="Xóa nhà hàng"
        message="Bạn có chắc muốn xóa nhà hàng này? Thao tác chỉ thực hiện được nếu nhà hàng chưa có đơn hàng nào."
        confirmText="Xóa nhà hàng"
        cancelText="Giữ lại"
        danger
        isLoading={Boolean(deletingId)}
        onClose={() => setDeletingRestaurantId(null)}
        onConfirm={handleConfirmDeleteRestaurant}
      />
    </section>
  );
};

export default ListRestaurant;
