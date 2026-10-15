import { Branch, Merchant } from "../models/index.cjs";
import * as restaurantRepo from "../repositories/restaurantRepository.js";
import { assertBranchOperational } from "./branchService.js";
import { isRestaurantOpenNow } from "../utils/openingHours.js";
import AppError from "../utils/AppError.js";

/** Resolve one cart location and enforce identical quote/order delivery eligibility. */
export const resolveCheckoutLocation = async ({ branchId, restaurantId, deliveryMethod }) => {
  let branch = null;
  let merchant = null;
  let restaurant = null;
  if (branchId) {
    ({ branch, merchant } = await assertBranchOperational(branchId));
  } else {
    restaurant = await restaurantRepo.findById(restaurantId);
    if (!restaurant) throw new AppError("Restaurant not found.", 404);
    if (!isRestaurantOpenNow(restaurant)) {
      throw new AppError("Nhà hàng hiện đang đóng cửa và tạm ngưng nhận đơn. Quý khách vui lòng quay lại sau.", 409);
    }
    merchant = await Merchant.findOne({ $or: [{ _id: restaurantId }, { legacyRestaurantId: restaurantId }] });
    if (merchant) {
      const main = await Branch.findOne({ merchantId: merchant._id, code: "MAIN" });
      if (main) ({ branch, merchant } = await assertBranchOperational(main._id));
    }
  }
  if (deliveryMethod === "drone") {
    // Missing applications (including old enabled flags) never grant approval.
    const approved = branch && await Branch.exists({
      _id: branch._id, droneDeliveryEnabled: true, "droneDeliveryApplication.status": "approved",
    });
    if (!approved) throw new AppError("Địa điểm chưa được duyệt hoặc chưa bật giao hàng bằng drone", 403);
  }
  const origin = branch ? {
    lat: branch.address?.lat ?? branch.location?.coordinates?.[1],
    lng: branch.address?.lng ?? branch.location?.coordinates?.[0],
  } : { lat: restaurant?.lat, lng: restaurant?.lng };
  return { branch, merchant, restaurant, origin };
};
