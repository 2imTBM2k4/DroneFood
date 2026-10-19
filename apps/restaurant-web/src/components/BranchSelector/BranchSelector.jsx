import React, { useState, useRef, useEffect, useContext } from "react";
import { Store, ChevronDown, Check, Building2, MapPin } from "lucide-react";
import { useBranch } from "../../context/BranchContext";
import { AuthContext } from "../../context/AuthContext";
import "./BranchSelector.css";

const BranchSelector = () => {
  const { user } = useContext(AuthContext);
  const {
    branches,
    selectedBranchId,
    currentBranch,
    isAllBranches,
    setSelectedBranchId,
    loadingBranches,
  } = useBranch();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isManager = user?.role === "branch_manager";
  const isMerchantOwner = user?.role === "merchant_owner" || user?.role === "admin";

  // Quản lý thương hiệu: Không cần nút chọn chi nhánh (xem toàn chuỗi thống nhất)
  if (isMerchantOwner) {
    return null;
  }

  if (loadingBranches && branches.length === 0) {
    return (
      <div className="branch-selector-loading">
        <Store size={16} className="spin" />
        <span>Đang tải chi nhánh…</span>
      </div>
    );
  }

  // Quản lý chi nhánh: Hiển thị thẻ cố định, không có dropdown
  if (isManager) {
    const branch = currentBranch || branches[0];
    return (
      <div className="branch-manager-badge" title="Chi nhánh bạn đang quản lý">
        <span className="branch-badge-icon">
          <Store size={15} />
        </span>
        <div className="branch-badge-info">
          <span className="branch-badge-title">
            {branch ? branch.name : "Chi nhánh được gán"}
            {branch?.code && <small className="branch-code-tag">{branch.code}</small>}
          </span>
          {branch && (
            <span className={`branch-status-dot ${branch.isOpen ? "open" : "closed"}`}>
              {branch.isOpen ? "Đang mở cửa" : "Đang đóng cửa"}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Chủ sở hữu (merchant_owner / restaurant_owner): Dropdown chọn chi nhánh
  const labelText = isAllBranches
    ? `Tất cả chi nhánh (${branches.length})`
    : currentBranch
    ? currentBranch.name
    : "Chọn chi nhánh";

  return (
    <div className="branch-selector-container" ref={dropdownRef}>
      <button
        type="button"
        className={`branch-selector-trigger ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="branch-trigger-icon">
          {isAllBranches ? <Building2 size={16} /> : <Store size={16} />}
        </span>
        <div className="branch-trigger-text">
          <small className="branch-trigger-sub">Đang xem</small>
          <span className="branch-trigger-main">
            {labelText}
            {currentBranch?.code && (
              <span className="branch-code-tag">{currentBranch.code}</span>
            )}
          </span>
        </div>
        <ChevronDown size={16} className={`branch-chevron ${isOpen ? "rotate" : ""}`} />
      </button>

      {isOpen && (
        <div className="branch-dropdown-menu" role="listbox">
          <div className="branch-dropdown-header">
            <span>Danh sách chi nhánh ({branches.length})</span>
          </div>

          <button
            type="button"
            className={`branch-option-item ${isAllBranches ? "selected" : ""}`}
            onClick={() => {
              setSelectedBranchId("all");
              setIsOpen(false);
            }}
            role="option"
            aria-selected={isAllBranches}
          >
            <div className="branch-option-icon">
              <Building2 size={16} />
            </div>
            <div className="branch-option-content">
              <strong>Tất cả chi nhánh</strong>
              <small>Xem tổng hợp toàn chuỗi</small>
            </div>
            {isAllBranches && <Check size={16} className="branch-check-icon" />}
          </button>

          <div className="branch-dropdown-divider" />

          {branches.map((b) => {
            const isSelected = selectedBranchId === b._id;
            return (
              <button
                key={b._id}
                type="button"
                className={`branch-option-item ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  setSelectedBranchId(b._id);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={isSelected}
              >
                <div className="branch-option-icon">
                  <Store size={16} />
                </div>
                <div className="branch-option-content">
                  <div className="branch-option-title-row">
                    <strong>{b.name}</strong>
                    <span className="branch-code-tag">{b.code}</span>
                    <span className={`branch-status-dot ${b.isOpen ? "open" : "closed"}`}>
                      {b.isOpen ? "Mở" : "Đóng"}
                    </span>
                  </div>
                  {b.address?.text && (
                    <small className="branch-option-address">
                      <MapPin size={11} /> {b.address.text}
                    </small>
                  )}
                </div>
                {isSelected && <Check size={16} className="branch-check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BranchSelector;
