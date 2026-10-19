import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  User,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  X,
  Plane,
} from "lucide-react";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import { useBranch } from "../../context/BranchContext";
import { AuthContext } from "../../context/AuthContext";
import "./Branches.css";

const Branches = ({ url = import.meta.env.VITE_API_URL || "http://localhost:4000" }) => {
  const { user } = useContext(AuthContext);
  const { branches, merchant, refreshBranches, loadingBranches } = useBranch();

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [activeBranchForAssign, setActiveBranchForAssign] = useState(null);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    address: "",
    lat: "",
    lng: "",
    phone: "",
  });
  const [creating, setCreating] = useState(false);

  // Assign Manager State
  const [assignMode, setAssignMode] = useState("create"); // "create" | "existing"
  const [newManagerForm, setNewManagerForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [creatingManager, setCreatingManager] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchingUser, setSearchingUser] = useState(false);
  const [candidateUser, setCandidateUser] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Toggle open state loader tracker
  const [togglingBranchId, setTogglingBranchId] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const handleToggleOpenState = async (branch) => {
    try {
      setTogglingBranchId(branch._id);
      const nextState = !branch.isOpen;
      const res = await axios.patch(
        `${url}/api/branch/${branch._id}/open-state`,
        { isOpen: nextState },
        { headers }
      );
      if (res.data?.success) {
        notificationService.success(
          nextState ? "Đã mở cửa chi nhánh" : "Đã đóng cửa chi nhánh",
          branch.name
        );
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Lỗi cập nhật trạng thái",
        err.response?.data?.message || err.message
      );
    } finally {
      setTogglingBranchId(null);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!merchant?._id) {
      notificationService.error("Lỗi", "Không tìm thấy thông tin thương hiệu");
      return;
    }

    try {
      setCreating(true);
      const payload = {
        merchantId: merchant._id,
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        address: {
          text: createForm.address.trim(),
          ...(createForm.lat ? { lat: Number(createForm.lat) } : {}),
          ...(createForm.lng ? { lng: Number(createForm.lng) } : {}),
        },
        phone: createForm.phone.trim() || undefined,
      };

      const res = await axios.post(`${url}/api/branch`, payload, { headers });
      if (res.data?.success) {
        notificationService.success("Tạo chi nhánh thành công!", payload.name);
        setCreateModalOpen(false);
        setCreateForm({ name: "", code: "", address: "", lat: "", lng: "", phone: "" });
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Tạo chi nhánh thất bại",
        err.response?.data?.message || err.message
      );
    } finally {
      setCreating(false);
    }
  };

  const openAssignModal = (branch) => {
    setActiveBranchForAssign(branch);
    setAssignMode("create");
    setNewManagerForm({ name: "", email: "", password: "", phone: "" });
    setSearchEmail("");
    setCandidateUser(null);
    setLookupError("");
    setAssignModalOpen(true);
  };

  const handleCreateAndAssignManager = async (e) => {
    e.preventDefault();
    if (!activeBranchForAssign) return;

    if (newManagerForm.password.length < 6) {
      notificationService.warning("Mật khẩu quá ngắn", "Mật khẩu tối thiểu 6 ký tự");
      return;
    }

    try {
      setCreatingManager(true);
      // Nếu chi nhánh đã có quản lý, gỡ bỏ quản lý cũ trước để đảm bảo mỗi chi nhánh chỉ có 1 quản lý
      const hasExisting =
        Array.isArray(activeBranchForAssign.managerUserIds) &&
        activeBranchForAssign.managerUserIds.length > 0;

      if (hasExisting) {
        await axios.post(
          `${url}/api/branch/${activeBranchForAssign._id}/managers`,
          { userIds: [] },
          { headers }
        );
      }

      const res = await axios.post(
        `${url}/api/branch/${activeBranchForAssign._id}/managers/create`,
        {
          name: newManagerForm.name.trim(),
          email: newManagerForm.email.trim().toLowerCase(),
          password: newManagerForm.password,
          phone: newManagerForm.phone.trim() || undefined,
        },
        { headers }
      );

      if (res.data?.success) {
        notificationService.success(
          "Tạo tài khoản và bổ nhiệm thành công!",
          `Tài khoản ${newManagerForm.email} đã được bổ nhiệm quản lý ${activeBranchForAssign.name}`
        );
        setAssignModalOpen(false);
        setNewManagerForm({ name: "", email: "", password: "", phone: "" });
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Không thể tạo tài khoản quản lý",
        err.response?.data?.message || err.message
      );
    } finally {
      setCreatingManager(false);
    }
  };

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    try {
      setSearchingUser(true);
      setLookupError("");
      setCandidateUser(null);

      const res = await axios.get(`${url}/api/user/lookup`, {
        headers,
        params: { email: searchEmail.trim() },
      });

      if (res.data?.success && res.data.data) {
        setCandidateUser(res.data.data);
      }
    } catch (err) {
      setLookupError(err.response?.data?.message || "Không tìm thấy người dùng với email này");
    } finally {
      setSearchingUser(false);
    }
  };

  const handleAssignManager = async (userIdToAssign) => {
    if (!activeBranchForAssign) return;

    try {
      setAssigning(true);
      const userIds = userIdToAssign ? [userIdToAssign] : [];
      const res = await axios.post(
        `${url}/api/branch/${activeBranchForAssign._id}/managers`,
        { userIds },
        { headers }
      );

      if (res.data?.success) {
        notificationService.success(
          userIdToAssign ? "Bổ nhiệm quản lý thành công!" : "Đã gỡ bỏ quản lý chi nhánh",
          activeBranchForAssign.name
        );
        setAssignModalOpen(false);
        refreshBranches();
      }
    } catch (err) {
      notificationService.error(
        "Thao tác thất bại",
        err.response?.data?.message || err.message
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="branches-page">
      <header className="branches-header">
        <div>
          <h1 className="branches-title">
            <Building2 size={26} /> Quản lý chi nhánh
          </h1>
          <p className="branches-subtitle">
            Hệ thống quản trị các điểm kinh doanh thuộc chuỗi thương hiệu{" "}
            <strong>{merchant?.name || "của bạn"}</strong>. Mỗi chi nhánh có một quản lý chuyên trách.
          </p>
        </div>
        <button
          type="button"
          className="branches-add-btn"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus size={18} /> Thêm chi nhánh mới
        </button>
      </header>

      {loadingBranches && branches.length === 0 ? (
        <div className="branches-loading-state">
          <Loader2 size={32} className="spin" />
          <p>Đang tải danh sách chi nhánh…</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="branches-empty-state">
          <Building2 size={48} />
          <h3>Chưa có chi nhánh nào</h3>
          <p>Hãy bấm "+ Thêm chi nhánh mới" để mở rộng cơ sở kinh doanh của bạn.</p>
          <button
            type="button"
            className="branches-add-btn"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={18} /> Thêm chi nhánh đầu tiên
          </button>
        </div>
      ) : (
        <div className="branches-grid">
          {branches.map((branch) => {
            const manager =
              Array.isArray(branch.managerUserIds) && branch.managerUserIds.length > 0
                ? branch.managerUserIds[0]
                : null;
            const isManagerPopulated = manager && typeof manager === "object" && manager.name;

            return (
              <article key={branch._id} className="branch-card">
                <header className="branch-card-header">
                  <div>
                    <div className="branch-title-row">
                      <h2 className="branch-name">{branch.name}</h2>
                      <span className="branch-code-badge">{branch.code}</span>
                    </div>
                    <span className={`branch-status-tag ${branch.status}`}>
                      {branch.status === "active"
                        ? "Hoạt động"
                        : branch.status === "pending"
                        ? "Chờ duyệt"
                        : "Bị khóa"}
                    </span>
                  </div>

                  <div className="branch-open-toggle-wrapper">
                    <button
                      type="button"
                      className={`branch-toggle-switch ${branch.isOpen ? "is-open" : "is-closed"}`}
                      disabled={togglingBranchId === branch._id}
                      onClick={() => handleToggleOpenState(branch)}
                      title={branch.isOpen ? "Nhấn để đóng cửa" : "Nhấn để mở cửa"}
                    >
                      <span className="toggle-slider" />
                      <span className="toggle-text">{branch.isOpen ? "Mở cửa" : "Đóng cửa"}</span>
                    </button>
                  </div>
                </header>

                <div className="branch-card-body">
                  <div className="branch-info-row">
                    <MapPin size={16} className="branch-info-icon" />
                    <span>{branch.address?.text || "Chưa cập nhật địa chỉ"}</span>
                  </div>

                  {branch.phone && (
                    <div className="branch-info-row">
                      <Phone size={16} className="branch-info-icon" />
                      <span>{branch.phone}</span>
                    </div>
                  )}

                  <div className="branch-info-row">
                    <Plane size={16} className="branch-info-icon" />
                    <span>
                      Giao hàng bằng drone:{" "}
                      <strong className={branch.droneDeliveryEnabled ? "text-success" : "text-muted"}>
                        {branch.droneDeliveryEnabled ? "Đang bật" : "Chưa bật"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Manager section - 1 branch 1 manager */}
                <footer className="branch-card-footer">
                  <div className="branch-manager-box">
                    <div className="branch-manager-header">
                      <span className="branch-manager-label">
                        <User size={14} /> Quản lý chi nhánh:
                      </span>
                    </div>

                    {manager ? (
                      <div className="branch-manager-assigned">
                        <div className="manager-details">
                          <strong className="manager-name">
                            {isManagerPopulated ? manager.name : "Đã gán quản lý"}
                          </strong>
                          {isManagerPopulated && manager.email && (
                            <small className="manager-email">{manager.email}</small>
                          )}
                        </div>
                        <div className="manager-actions">
                          <button
                            type="button"
                            className="btn-manager-action change"
                            onClick={() => openAssignModal(branch)}
                            title="Thay đổi quản lý"
                          >
                            Đổi quản lý
                          </button>
                          <button
                            type="button"
                            className="btn-manager-action remove"
                            onClick={() => {
                              setActiveBranchForAssign(branch);
                              handleAssignManager(null);
                            }}
                            title="Gỡ bỏ quyền quản lý"
                          >
                            <UserX size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="branch-manager-empty">
                        <span className="text-muted">Chưa có quản lý phụ trách</span>
                        <button
                          type="button"
                          className="btn-manager-assign"
                          onClick={() => openAssignModal(branch)}
                        >
                          <UserPlus size={14} /> Bổ nhiệm
                        </button>
                      </div>
                    )}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal: Tạo chi nhánh mới */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3>
                <Building2 size={20} /> Thêm chi nhánh mới
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCreateModalOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleCreateBranch} className="modal-form">
              <div className="form-group">
                <label>
                  Tên chi nhánh <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chi nhánh Quận 1, Cơ sở Hai Bà Trưng"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>
                  Mã chi nhánh <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="Ví dụ: Q1, HBT, CN2"
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })
                  }
                />
                <small className="form-hint">Mã viết hoa, ngắn gọn để nhận diện đơn hàng</small>
              </div>

              <div className="form-group">
                <label>
                  Địa chỉ chi nhánh <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 123 Lê Lợi, Phường Bến Nghé, Quận 1"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="10.7769"
                    value={createForm.lat}
                    onChange={(e) => setCreateForm({ ...createForm, lat: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="106.7009"
                    value={createForm.lng}
                    onChange={(e) => setCreateForm({ ...createForm, lng: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  placeholder="0901234567"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>

              <footer className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-submit" disabled={creating}>
                  {creating ? <Loader2 size={16} className="spin" /> : "Tạo chi nhánh"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bổ nhiệm / Gỡ quản lý chi nhánh */}
      {assignModalOpen && activeBranchForAssign && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <header className="modal-header">
              <h3>
                <UserCheck size={20} /> Bổ nhiệm Quản lý chi nhánh
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setAssignModalOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="modal-body">
              <div className="assign-branch-summary">
                <span className="summary-label">Chi nhánh:</span>
                <strong>{activeBranchForAssign.name}</strong>{" "}
                <span className="branch-code-badge">{activeBranchForAssign.code}</span>
              </div>

              {Array.isArray(activeBranchForAssign.managerUserIds) &&
                activeBranchForAssign.managerUserIds.length > 0 && (
                  <div className="assign-replace-warning">
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Chi nhánh này hiện đã có quản lý phụ trách. Thao tác bổ nhiệm mới sẽ{" "}
                      <strong>thay thế quản lý hiện tại</strong> (mỗi chi nhánh chỉ có duy nhất 1
                      quản lý).
                    </span>
                  </div>
                )}

              {/* Mode Selection Tabs */}
              <div className="assign-mode-tabs" role="tablist">
                <button
                  type="button"
                  className={`assign-mode-tab ${assignMode === "create" ? "active" : ""}`}
                  onClick={() => setAssignMode("create")}
                >
                  <UserPlus size={15} /> Tạo tài khoản mới
                </button>
                <button
                  type="button"
                  className={`assign-mode-tab ${assignMode === "existing" ? "active" : ""}`}
                  onClick={() => setAssignMode("existing")}
                >
                  <Search size={15} /> Chọn tài khoản có sẵn
                </button>
              </div>

              {assignMode === "create" ? (
                <form onSubmit={handleCreateAndAssignManager} className="modal-form" style={{ marginTop: 4 }}>
                  <div className="form-group">
                    <label>
                      Họ và tên quản lý <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn Quản Lý"
                      value={newManagerForm.name}
                      onChange={(e) =>
                        setNewManagerForm({ ...newManagerForm, name: e.target.value })
                      }
                      disabled={creatingManager}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Email đăng nhập <span className="req">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="quanly.chinhanh@gmail.com"
                      value={newManagerForm.email}
                      onChange={(e) =>
                        setNewManagerForm({ ...newManagerForm, email: e.target.value })
                      }
                      disabled={creatingManager}
                    />
                    <small className="form-hint">Email dùng để nhân sự đăng nhập vào trang quản lý chi nhánh</small>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>
                        Mật khẩu khởi tạo <span className="req">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Tối thiểu 6 ký tự"
                        value={newManagerForm.password}
                        onChange={(e) =>
                          setNewManagerForm({ ...newManagerForm, password: e.target.value })
                        }
                        disabled={creatingManager}
                      />
                    </div>
                    <div className="form-group">
                      <label>Số điện thoại</label>
                      <input
                        type="tel"
                        placeholder="0912345678"
                        value={newManagerForm.phone}
                        onChange={(e) =>
                          setNewManagerForm({ ...newManagerForm, phone: e.target.value })
                        }
                        disabled={creatingManager}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-submit"
                    style={{ marginTop: 8, width: "100%", background: "#2563eb" }}
                    disabled={creatingManager}
                  >
                    {creatingManager ? (
                      <>
                        <Loader2 size={16} className="spin" /> Đang tạo tài khoản...
                      </>
                    ) : (
                      <>
                        <UserCheck size={16} style={{ marginRight: 6 }} /> Tạo tài khoản & Bổ nhiệm
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <>
                  <p className="assign-note" style={{ marginTop: 4 }}>
                    Nhập email của người dùng đã có tài khoản trên hệ thống để nâng cấp và gán quyền quản lý chi nhánh.
                  </p>

                  <form onSubmit={handleSearchUser} className="assign-search-form" style={{ marginTop: 10 }}>
                    <div className="search-input-wrap">
                      <input
                        type="email"
                        required
                        placeholder="Nhập email tài khoản nhân sự cần gán…"
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                      />
                      <button type="submit" className="btn-search-user" disabled={searchingUser}>
                        {searchingUser ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                      </button>
                    </div>
                  </form>

                  {lookupError && (
                    <div className="assign-error-banner" style={{ marginTop: 10 }}>
                      <AlertCircle size={16} />
                      <span>{lookupError}</span>
                    </div>
                  )}

                  {candidateUser && (
                    <div className="candidate-card" style={{ marginTop: 12 }}>
                      <div className="candidate-avatar">
                        <User size={24} />
                      </div>
                      <div className="candidate-info">
                        <strong>{candidateUser.name}</strong>
                        <small>{candidateUser.email}</small>
                        <span className="candidate-role-badge">
                          Vai trò hiện tại: {candidateUser.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-confirm-assign"
                        disabled={assigning}
                        onClick={() => handleAssignManager(candidateUser._id)}
                      >
                        {assigning ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          "Bổ nhiệm làm Quản lý"
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setAssignModalOpen(false)}
              >
                Đóng
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
