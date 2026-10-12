import {
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
  Check,
  ChevronsUpDown,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import axios from "axios";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import "./Shippers.css";

const approvalLabel = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const operationalLabel = {
  offline: "Ngoại tuyến",
  available: "Sẵn sàng",
  assigned: "Đã nhận đơn",
  delivering: "Đang giao",
};

const vehicleLabel = {
  motorbike: "Xe máy",
  bicycle: "Xe đạp",
  car: "Ô tô",
};

const SHIPPER_COLUMNS = [
  { key: "name", label: "Shipper" },
  { key: "vehicleType", label: "Phương tiện" },
  { key: "approvalStatus", label: "Duyệt" },
  { key: "status", label: "Vận hành" },
  { key: "locationUpdatedAt", label: "GPS gần nhất" },
  { key: "currentOrder", label: "Đơn hiện tại" },
];

const collator = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
});

const getShipperSortValue = (profile, key) => {
  const approvalRank = { pending: 0, approved: 1, rejected: 2 };
  const values = {
    name: profile.user?.name,
    vehicleType: vehicleLabel[profile.vehicleType] || profile.vehicleType,
    approvalStatus: approvalRank[profile.approvalStatus] ?? 9,
    status: operationalLabel[profile.status] || profile.status,
    locationUpdatedAt: profile.locationUpdatedAt
      ? new Date(profile.locationUpdatedAt).getTime()
      : 0,
    currentOrder: profile.currentOrder?.orderStatus || "",
  };

  return values[key] ?? "";
};

const compareValues = (first, second) => {
  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }
  return collator.compare(String(first), String(second));
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

const formatOrderAddress = (address) => {
  if (!address) return "N/A";
  return [address.address, address.city, address.state, address.country, address.zipCode]
    .filter(Boolean)
    .join(", ") || "N/A";
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const DetailItem = ({ label, children, wide = false }) => (
  <div className={`shipper-detail-item${wide ? " shipper-detail-item--wide" : ""}`}>
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

const Shippers = ({ url }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "approvalStatus",
    direction: "asc",
  });
  const [selectedProfile, setSelectedProfile] = useState(null);
  const deferredQuery = useDeferredValue(query);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastFocusedElementRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/shippers`, {
        headers: authHeaders(),
      });
      setProfiles(response.data.data || []);
    } catch (error) {
      notificationService.error(
        "Không thể tải danh sách Shipper",
        error.response?.data?.message || "Vui lòng kiểm tra kết nối mạng và thử lại.",
        {
          audience: "admin",
          priority: "high",
          key: "shippers-admin-load",
          actions: [{ label: "Thử lại", onClick: load }],
        }
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDetails = useCallback(() => {
    setSelectedProfile(null);
    requestAnimationFrame(() => lastFocusedElementRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selectedProfile) return undefined;

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
  }, [closeDetails, selectedProfile]);

  const approve = async (profile, approvalStatus) => {
    try {
      setSavingId(profile._id);
      await axios.put(
        `${url}/api/shippers/${profile.user._id}/approval`,
        { approvalStatus },
        { headers: authHeaders() }
      );
      notificationService.success(
        approvalStatus === "approved" ? "Đã duyệt Shipper thành công" : "Đã từ chối hồ sơ Shipper",
        `Shipper ${profile.user?.name || ""} đã được cập nhật.`,
        { audience: "admin", key: `shipper-approve-success-${profile.user._id}` }
      );
      await load();
    } catch (error) {
      notificationService.error(
        "Không thể cập nhật trạng thái Shipper",
        error.response?.data?.message || "Lỗi khi xử lý phê duyệt Shipper. Vui lòng thử lại.",
        {
          audience: "admin",
          priority: "high",
          key: `shipper-approval-${profile.user._id}`,
          actions: [{ label: "Thử lại", onClick: () => approve(profile, approvalStatus) }],
        }
      );
    } finally {
      setSavingId("");
    }
  };

  const visibleProfiles = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("vi-VN");
    const filtered = profiles.filter((profile) => {
      const searchableValues = [
        profile.user?.name,
        profile.user?.email,
        profile.user?.phone,
        vehicleLabel[profile.vehicleType],
        approvalLabel[profile.approvalStatus],
        operationalLabel[profile.status],
        profile.currentOrder?._id,
        profile.currentOrder?.orderStatus,
      ];
      const matchesQuery = searchableValues.some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("vi-VN")
          .includes(normalizedQuery)
      );
      return (
        (filter === "all" || profile.approvalStatus === filter) &&
        (!normalizedQuery || matchesQuery)
      );
    });

    return [...filtered].sort((left, right) => {
      const comparison = compareValues(
        getShipperSortValue(left, sortConfig.key),
        getShipperSortValue(right, sortConfig.key)
      );
      if (comparison !== 0) {
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }
      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });
  }, [deferredQuery, filter, profiles, sortConfig]);

  const counts = useMemo(
    () =>
      profiles.reduce(
        (result, profile) => ({
          ...result,
          [profile.approvalStatus]: (result[profile.approvalStatus] || 0) + 1,
        }),
        {}
      ),
    [profiles]
  );

  const handleSort = (key) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const openDetails = (profile, event) => {
    lastFocusedElementRef.current = event.currentTarget;
    setSelectedProfile(profile);
  };

  const bankAccount = selectedProfile?.bankAccount;
  const hasBankMetadata = bankAccount && Object.values(bankAccount).some(Boolean);
  const currentOrder = selectedProfile?.currentOrder;

  return (
    <section className="shipper-page" aria-labelledby="shippers-title">
      <header className="shipper-page-head">
        <div>
          <p className="shipper-eyebrow">Delivery operations</p>
          <h1 id="shippers-title">Shippers</h1>
          <p>Duyệt tài khoản trước khi họ có thể chia sẻ GPS và nhận đơn trong bán kính 3 km.</p>
        </div>
        <div className="shipper-head-actions">
          <div className="shipper-count" aria-live="polite">
            <Truck size={17} aria-hidden="true" />
            <span>{visibleProfiles.length} / {profiles.length} Shippers</span>
          </div>
          <button
            type="button"
            className="shipper-refresh"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Làm mới
          </button>
        </div>
      </header>

      <div className="shipper-toolbar">
        <label className="shipper-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Tìm Shipper</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên, email, số điện thoại, trạng thái…"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Xóa tìm kiếm Shipper"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </label>
        <div className="shipper-filters" role="tablist" aria-label="Lọc trạng thái duyệt">
          {["pending", "approved", "rejected", "all"].map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={filter === status}
              className={filter === status ? "active" : ""}
              onClick={() => setFilter(status)}
            >
              {status === "all" ? "Tất cả" : approvalLabel[status]}
              <span>{status === "all" ? profiles.length : counts[status] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shipper-table-card">
        {loading ? (
          <div className="shipper-state" role="status">Đang tải Shipper…</div>
        ) : visibleProfiles.length === 0 ? (
          <div className="shipper-state">
            <Truck size={26} aria-hidden="true" />
            <strong>{profiles.length === 0 ? "Chưa có Shipper" : "Không có Shipper phù hợp"}</strong>
            <span>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</span>
          </div>
        ) : (
          <div className="shipper-table-wrap">
            <table className="shipper-table">
              <thead>
                <tr>
                  {SHIPPER_COLUMNS.map((column) => {
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
                          className={`shipper-sort${active ? " shipper-sort--active" : ""}`}
                          onClick={() => handleSort(column.key)}
                        >
                          <span>{column.label}</span>
                          <SortIcon active={active} direction={sortConfig.direction} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="shipper-table__actions-heading">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleProfiles.map((profile) => (
                  <tr
                    key={profile._id}
                    className="shipper-row"
                    tabIndex={0}
                    onClick={(event) => openDetails(profile, event)}
                    onKeyDown={(event) => {
                      if (
                        event.currentTarget === event.target &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        openDetails(profile, event);
                      }
                    }}
                  >
                    <td data-label="Shipper">
                      <button
                        type="button"
                        className="shipper-name-button"
                        aria-label={`Xem chi tiết ${profile.user?.name || "Shipper"}`}
                      >
                        {profile.user?.name || "Không rõ"}
                      </button>
                      <span>{profile.user?.email || "N/A"}</span>
                      <span>{profile.user?.phone || "Chưa có số điện thoại"}</span>
                    </td>
                    <td data-label="Phương tiện">
                      {vehicleLabel[profile.vehicleType] || profile.vehicleType || "N/A"}
                    </td>
                    <td data-label="Duyệt">
                      <span className={`approval approval--${profile.approvalStatus}`}>
                        {approvalLabel[profile.approvalStatus] || profile.approvalStatus}
                      </span>
                    </td>
                    <td data-label="Vận hành">
                      <span className="shipper-operational-status">
                        {operationalLabel[profile.status] || profile.status || "N/A"}
                      </span>
                    </td>
                    <td data-label="GPS gần nhất">
                      {profile.locationUpdatedAt
                        ? formatDateTime(profile.locationUpdatedAt)
                        : "Chưa gửi vị trí"}
                    </td>
                    <td data-label="Đơn hiện tại">
                      {profile.currentOrder
                        ? `#${profile.currentOrder._id?.slice(-6).toUpperCase() || ""} · ${profile.currentOrder.orderStatus}`
                        : "Không có"}
                    </td>
                    <td
                      data-label="Thao tác"
                      className="shipper-actions-cell"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {profile.approvalStatus === "pending" ? (
                        <div className="shipper-actions">
                          <button
                            type="button"
                            className="approve"
                            disabled={savingId === profile._id}
                            onClick={() => approve(profile, "approved")}
                          >
                            <Check size={15} aria-hidden="true" />
                            Duyệt
                          </button>
                          <button
                            type="button"
                            className="reject"
                            disabled={savingId === profile._id}
                            onClick={() => approve(profile, "rejected")}
                          >
                            <X size={15} aria-hidden="true" />
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="review"
                          disabled={savingId === profile._id}
                          onClick={() =>
                            approve(
                              profile,
                              profile.approvalStatus === "approved" ? "rejected" : "approved"
                            )
                          }
                        >
                          {profile.approvalStatus === "approved" ? "Thu hồi duyệt" : "Duyệt lại"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProfile && createPortal(
        <div className="shipper-modal-backdrop" onMouseDown={closeDetails}>
          <div
            ref={dialogRef}
            className="shipper-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipper-modal-title"
            aria-describedby="shipper-modal-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="shipper-modal__header">
              <div>
                <p className="shipper-eyebrow">Shipper details</p>
                <h2 id="shipper-modal-title">
                  {selectedProfile.user?.name || "Shipper"}
                </h2>
                <p id="shipper-modal-description">
                  Thông tin quản trị không nhạy cảm của tài khoản giao hàng.
                </p>
              </div>
            </header>

            <div className="shipper-modal__body">
              <div className="shipper-detail-hero">
                <div className="shipper-detail-hero__placeholder" aria-hidden="true">
                  <UserRound size={32} />
                </div>
                <div>
                  <div className="shipper-detail-hero__status">
                    <span className={`approval approval--${selectedProfile.approvalStatus}`}>
                      {approvalLabel[selectedProfile.approvalStatus] || selectedProfile.approvalStatus}
                    </span>
                    <span className="shipper-operational-status">
                      {operationalLabel[selectedProfile.status] || selectedProfile.status || "N/A"}
                    </span>
                  </div>
                  <p>{selectedProfile.user?.email || "N/A"}</p>
                </div>
              </div>

              <section className="shipper-detail-section">
                <h3>Thông tin chung</h3>
                <dl className="shipper-detail-grid">
                  <DetailItem label="Shipper profile ID">{selectedProfile._id}</DetailItem>
                  <DetailItem label="User ID">{selectedProfile.user?._id || "N/A"}</DetailItem>
                  <DetailItem label="Email">{selectedProfile.user?.email || "N/A"}</DetailItem>
                  <DetailItem label="Phone">{selectedProfile.user?.phone || "N/A"}</DetailItem>
                  <DetailItem label="Created at">{formatDateTime(selectedProfile.createdAt)}</DetailItem>
                  <DetailItem label="Updated at">{formatDateTime(selectedProfile.updatedAt)}</DetailItem>
                </dl>
              </section>

              <section className="shipper-detail-section">
                <h3>Vận hành</h3>
                <dl className="shipper-detail-grid">
                  <DetailItem label="Approval status">
                    {approvalLabel[selectedProfile.approvalStatus] || selectedProfile.approvalStatus}
                  </DetailItem>
                  <DetailItem label="Operational status">
                    {operationalLabel[selectedProfile.status] || selectedProfile.status || "N/A"}
                  </DetailItem>
                  <DetailItem label="Vehicle">
                    {vehicleLabel[selectedProfile.vehicleType] || selectedProfile.vehicleType || "N/A"}
                  </DetailItem>
                  <DetailItem label="User account status">
                    {selectedProfile.user?.locked ? "Locked" : "Active"}
                  </DetailItem>
                  <DetailItem label="Last GPS update">
                    {formatDateTime(selectedProfile.locationUpdatedAt)}
                  </DetailItem>
                  <DetailItem label="Current order">
                    {currentOrder?._id || "None"}
                  </DetailItem>
                </dl>
              </section>

              <section className="shipper-detail-section">
                <h3>Thông tin ngân hàng</h3>
                {hasBankMetadata ? (
                  <dl className="shipper-detail-grid">
                    <DetailItem label="Bank name">{bankAccount.bankName || "N/A"}</DetailItem>
                    <DetailItem label="Account holder">{bankAccount.accountHolder || "N/A"}</DetailItem>
                    <DetailItem label="Account number">
                      {bankAccount.accountNumberLast4
                        ? `•••• ${bankAccount.accountNumberLast4}`
                        : "N/A"}
                    </DetailItem>
                    <DetailItem label="Updated at">{formatDateTime(bankAccount.updatedAt)}</DetailItem>
                  </dl>
                ) : (
                  <p className="shipper-detail-empty">Chưa có thông tin ngân hàng.</p>
                )}
              </section>

              <section className="shipper-detail-section">
                <h3>Đơn hiện tại</h3>
                {currentOrder ? (
                  <dl className="shipper-detail-grid">
                    <DetailItem label="Order ID">{currentOrder._id}</DetailItem>
                    <DetailItem label="Status">{currentOrder.orderStatus || "N/A"}</DetailItem>
                    <DetailItem label="Total">{formatCurrency(currentOrder.totalPrice)}</DetailItem>
                    <DetailItem label="Recipient">
                      {currentOrder.shippingAddress?.fullName || "N/A"}
                    </DetailItem>
                    <DetailItem label="Phone">
                      {currentOrder.shippingAddress?.phone || "N/A"}
                    </DetailItem>
                    <DetailItem label="Delivery address" wide>
                      {formatOrderAddress(currentOrder.shippingAddress)}
                    </DetailItem>
                  </dl>
                ) : (
                  <p className="shipper-detail-empty">Shipper chưa có đơn hiện tại.</p>
                )}
              </section>
            </div>

            <footer className="shipper-modal__footer">
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

export default Shippers;
