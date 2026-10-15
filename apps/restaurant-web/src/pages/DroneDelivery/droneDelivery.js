/** Derive application actions independently from the operational delivery switch. */
export const applicationState = (branch) => {
  const status = branch.droneDeliveryApplication?.status || "not_registered";
  return {
    status,
    canSubmit: status === "not_registered" || status === "rejected",
    canToggle: status === "approved",
    enabled: status === "approved" && branch.droneDeliveryEnabled === true,
  };
};

export const applicationLabels = {
  not_registered: "Chưa đăng ký", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Bị từ chối",
};
