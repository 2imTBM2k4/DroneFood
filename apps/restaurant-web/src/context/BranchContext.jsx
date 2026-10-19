import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { AuthContext } from "./AuthContext";

export const BranchContext = createContext();

export const BranchProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState(() => {
    return localStorage.getItem("selectedBranchId") || "all";
  });
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [merchant, setMerchant] = useState(null);

  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const fetchBranches = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !user) {
      setBranches([]);
      setMerchant(null);
      return;
    }

    try {
      setLoadingBranches(true);
      const res = await axios.get(`${url}/api/branch/my-branches`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        const branchList = res.data.data || [];
        setBranches(branchList);

        if (branchList.length > 0 && branchList[0].merchantId) {
          setMerchant(branchList[0].merchantId);
        }

        // Logic tự động chọn chi nhánh theo vai trò (role)
        if (user.role === "branch_manager") {
          // Quản lý chi nhánh: luôn cố định tại chi nhánh được phân công
          const assignedBranch = branchList[0];
          if (assignedBranch) {
            setSelectedBranchIdState(assignedBranch._id);
            localStorage.setItem("selectedBranchId", assignedBranch._id);
          }
        } else {
          // Chủ sở hữu (merchant_owner / restaurant_owner)
          const stored = localStorage.getItem("selectedBranchId");
          if (stored && (stored === "all" || branchList.some((b) => b._id === stored))) {
            setSelectedBranchIdState(stored);
          } else if (branchList.length === 1) {
            setSelectedBranchIdState(branchList[0]._id);
            localStorage.setItem("selectedBranchId", branchList[0]._id);
          } else {
            setSelectedBranchIdState("all");
            localStorage.setItem("selectedBranchId", "all");
          }
        }
      }
    } catch (err) {
      console.error("Fetch my-branches error in BranchContext:", err);
    } finally {
      setLoadingBranches(false);
    }
  }, [user, url]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const setSelectedBranchId = (id) => {
    // Quản lý chi nhánh không được phép chuyển chi nhánh
    if (user?.role === "branch_manager") return;

    setSelectedBranchIdState(id);
    localStorage.setItem("selectedBranchId", id);
  };

  const currentBranch =
    selectedBranchId === "all"
      ? null
      : branches.find((b) => b._id === selectedBranchId) || null;

  const isAllBranches = selectedBranchId === "all";

  return (
    <BranchContext.Provider
      value={{
        branches,
        merchant,
        selectedBranchId,
        currentBranch,
        isAllBranches,
        loadingBranches,
        refreshBranches: fetchBranches,
        setSelectedBranchId,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
};
