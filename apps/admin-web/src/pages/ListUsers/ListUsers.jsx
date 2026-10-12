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
  ChevronsUpDown,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./ListUsers.css";

const USER_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
];

const collator = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
});

const getUserSortValue = (user, key) => {
  const values = {
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    status: user.locked ? "Locked" : "Active",
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

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatRole = (value) =>
  String(value || "N/A")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const DetailItem = ({ label, children, wide = false }) => (
  <div className={`user-detail-item${wide ? " user-detail-item--wide" : ""}`}>
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

const ListUsers = ({ url }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [lockingId, setLockingId] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastFocusedElementRef = useRef(null);

  const fetchList = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.error(
        "Phiên đăng nhập đã hết hạn",
        "Vui lòng đăng nhập lại để tải danh sách người dùng.",
        { audience: "admin", key: "users-load-auth" }
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/user/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setList(response.data.data);
      } else {
        notificationService.error(
          "Không thể tải danh sách người dùng",
          response.data.message || "Vui lòng thử tải lại danh sách người dùng.",
          {
            audience: "admin",
            priority: "high",
            persistent: true,
            duration: 0,
            key: "users-load",
            actions: [{ label: "Thử lại", onClick: fetchList }],
          }
        );
      }
    } catch (error) {
      console.error("Fetch list error:", error);
      notificationService.error(
        "Không thể tải danh sách người dùng",
        error.response?.data?.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
        {
          audience: "admin",
          priority: "high",
          persistent: true,
          duration: 0,
          key: "users-load",
          actions: [{ label: "Thử lại", onClick: fetchList }],
        }
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  const closeDetails = useCallback(() => {
    setSelectedUser(null);
    requestAnimationFrame(() => lastFocusedElementRef.current?.focus());
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!selectedUser) return undefined;

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
  }, [closeDetails, selectedUser]);

  const visibleUsers = useMemo(() => {
    const query = deferredSearchTerm.trim().toLocaleLowerCase("vi-VN");
    const filtered = query
      ? list.filter((user) => {
          const searchableValues = [
            user.name,
            user.email,
            user.role,
            user.phone,
            user.locked ? "locked" : "active",
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
        String(getUserSortValue(first, sortConfig.key)),
        String(getUserSortValue(second, sortConfig.key))
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

  const openDetails = (user, event) => {
    lastFocusedElementRef.current = event.currentTarget;
    setSelectedUser(user);
  };

  const lockUser = async (userId, locked) => {
    const token = localStorage.getItem("token");
    if (!token) {
      notificationService.error(
        "Phiên đăng nhập đã hết hạn",
        "Vui lòng đăng nhập lại để cập nhật trạng thái người dùng.",
        { audience: "admin", key: `user-lock-auth-${userId}` }
      );
      return;
    }

    try {
      setLockingId(userId);
      const response = await axios.post(
        `${url}/api/user/lock`,
        { id: userId, locked },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        notificationService.success(response.data.message || (locked ? "Đã khóa người dùng thành công" : "Đã mở khóa người dùng thành công"), undefined, { audience: "admin", key: `user-lock-success-${userId}` });
        await fetchList();
      } else {
        notificationService.error(
          "Không thể cập nhật trạng thái người dùng",
          response.data.message || "Vui lòng thử cập nhật trạng thái người dùng lại.",
          {
            audience: "admin",
            priority: "high",
            persistent: true,
            duration: 0,
            key: `user-lock-${userId}`,
            actions: [{ label: "Thử lại", onClick: () => lockUser(userId, locked) }],
          }
        );
      }
    } catch (error) {
      notificationService.error(
        "Không thể cập nhật trạng thái người dùng",
        error.response?.data?.message || "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
        {
          audience: "admin",
          priority: "high",
          persistent: true,
          duration: 0,
          key: `user-lock-${userId}`,
          actions: [{ label: "Thử lại", onClick: () => lockUser(userId, locked) }],
        }
      );
    } finally {
      setLockingId("");
    }
  };

  const avatarUrl = selectedUser?.avatar
    ? selectedUser.avatar.startsWith("http")
      ? selectedUser.avatar
      : `${url}/${selectedUser.avatar.replace(/^\//, "")}`
    : "";
  const primaryAddress = selectedUser?.address;
  const hasPrimaryAddress = primaryAddress && Object.values(primaryAddress).some(Boolean);
  const addressBook = Array.isArray(selectedUser?.addressBook)
    ? selectedUser.addressBook
    : [];

  return (
    <section className="users-list" aria-labelledby="users-title">
      <header className="users-list__header">
        <div>
          <p className="users-list__eyebrow">User management</p>
          <h1 id="users-title">All Users</h1>
          <p className="users-list__subtitle">
            Search, sort and review user information before taking action.
          </p>
        </div>
        <div className="users-list__count" aria-live="polite">
          <UsersRound size={17} aria-hidden="true" />
          <span>
            {visibleUsers.length} of {list.length} users
          </span>
        </div>
      </header>

      <div className="users-toolbar">
        <label className="users-search">
          <span className="sr-only">Search users</span>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, email, role, phone or status…"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Clear user search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
      </div>

      <div className="users-table-card">
        {loading ? (
          <div className="users-state" role="status">
            Loading users…
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="users-state">
            <UsersRound size={26} aria-hidden="true" />
            <strong>{list.length === 0 ? "No users found" : "No matching users"}</strong>
            <span>
              {list.length === 0
                ? "User records will appear here."
                : "Try a different name, email, role, phone number or status."}
            </span>
          </div>
        ) : (
          <div className="users-table-scroll">
            <table className="users-table">
              <thead>
                <tr>
                  {USER_COLUMNS.map((column) => {
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
                          className={`user-sort${active ? " user-sort--active" : ""}`}
                          onClick={() => handleSort(column.key)}
                        >
                          <span>{column.label}</span>
                          <SortIcon active={active} direction={sortConfig.direction} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="users-table__actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((item) => (
                  <tr
                    key={item._id}
                    className="user-row"
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
                        className="user-name-button"
                        aria-label={`View details for ${item.name}`}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td data-label="Email" className="user-cell--wrap">
                      {item.email}
                    </td>
                    <td data-label="Role">{formatRole(item.role)}</td>
                    <td data-label="Phone" className="user-cell--numeric">
                      {item.phone || "N/A"}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`user-status-pill ${
                          item.locked
                            ? "user-status-pill--locked"
                            : "user-status-pill--active"
                        }`}
                      >
                        {item.locked ? "Locked" : "Active"}
                      </span>
                    </td>
                    <td
                      data-label="Actions"
                      className="user-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => lockUser(item._id, !item.locked)}
                        className={`user-action ${
                          item.locked
                            ? "user-action--unlock"
                            : "user-action--lock"
                        }`}
                        disabled={lockingId === item._id}
                      >
                        {lockingId === item._id
                          ? "Saving…"
                          : item.locked
                            ? "Unlock"
                            : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && createPortal(
        <div className="user-modal-backdrop" onMouseDown={closeDetails}>
          <div
            ref={dialogRef}
            className="user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            aria-describedby="user-modal-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="user-modal__header">
              <div>
                <p className="users-list__eyebrow">User details</p>
                <h2 id="user-modal-title">{selectedUser.name}</h2>
                <p id="user-modal-description">
                  Complete non-sensitive information available to the admin account.
                </p>
              </div>
            </header>

            <div className="user-modal__body">
              <div className="user-detail-hero">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={`${selectedUser.name} avatar`} />
                ) : (
                  <div className="user-detail-hero__placeholder" aria-hidden="true">
                    <UserRound size={32} />
                  </div>
                )}
                <div>
                  <span
                    className={`user-status-pill ${
                      selectedUser.locked
                        ? "user-status-pill--locked"
                        : "user-status-pill--active"
                    }`}
                  >
                    {selectedUser.locked ? "Locked" : "Active"}
                  </span>
                  <p>{selectedUser.email}</p>
                </div>
              </div>

              <section className="user-detail-section">
                <h3>General information</h3>
                <dl className="user-detail-grid">
                  <DetailItem label="User ID">{selectedUser._id}</DetailItem>
                  <DetailItem label="Email">{selectedUser.email}</DetailItem>
                  <DetailItem label="Phone">{selectedUser.phone || "N/A"}</DetailItem>
                  <DetailItem label="Role">{formatRole(selectedUser.role)}</DetailItem>
                  <DetailItem label="Created at">
                    {formatDateTime(selectedUser.createdAt)}
                  </DetailItem>
                  <DetailItem label="Updated at">
                    {formatDateTime(selectedUser.updatedAt)}
                  </DetailItem>
                </dl>
              </section>

              <section className="user-detail-section">
                <h3>Account</h3>
                <dl className="user-detail-grid">
                  <DetailItem label="Account status">
                    {selectedUser.locked ? "Locked" : "Active"}
                  </DetailItem>
                  <DetailItem label="Balance">
                    {formatCurrency(selectedUser.balance)}
                  </DetailItem>
                  <DetailItem label="Restaurant ID">
                    {selectedUser.restaurantId || "N/A"}
                  </DetailItem>
                  <DetailItem label="Saved addresses">
                    {addressBook.length}
                  </DetailItem>
                </dl>
              </section>

              <section className="user-detail-section">
                <h3>Primary address</h3>
                {hasPrimaryAddress ? (
                  <dl className="user-detail-grid">
                    <DetailItem label="Full name">
                      {primaryAddress.fullName || "N/A"}
                    </DetailItem>
                    <DetailItem label="Contact phone">
                      {primaryAddress.phone || "N/A"}
                    </DetailItem>
                    <DetailItem label="Address" wide>
                      {primaryAddress.address || "N/A"}
                    </DetailItem>
                    <DetailItem label="City">{primaryAddress.city || "N/A"}</DetailItem>
                    <DetailItem label="State">{primaryAddress.state || "N/A"}</DetailItem>
                    <DetailItem label="Country">
                      {primaryAddress.country || "N/A"}
                    </DetailItem>
                    <DetailItem label="Zip code">
                      {primaryAddress.zipCode || "N/A"}
                    </DetailItem>
                  </dl>
                ) : (
                  <p className="user-detail-empty">No primary address available.</p>
                )}
              </section>

              <section className="user-detail-section">
                <h3>Address book</h3>
                {addressBook.length > 0 ? (
                  <div className="user-address-list">
                    {addressBook.map((entry, index) => (
                      <article className="user-address-card" key={entry._id || `${entry.label}-${index}`}>
                        <div className="user-address-card__head">
                          <strong>{entry.label || `Address ${index + 1}`}</strong>
                          {entry.isDefault && <span>Default</span>}
                        </div>
                        <p>{entry.recipient || "N/A"} · {entry.phone || "N/A"}</p>
                        <p>{entry.address || "N/A"}</p>
                        <p>
                          {[entry.city, entry.state, entry.country, entry.zipCode]
                            .filter(Boolean)
                            .join(", ") || "N/A"}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="user-detail-empty">No saved addresses.</p>
                )}
              </section>
            </div>

            <footer className="user-modal__footer">
              <button ref={closeButtonRef} type="button" onClick={closeDetails}>
                Close
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default ListUsers;
