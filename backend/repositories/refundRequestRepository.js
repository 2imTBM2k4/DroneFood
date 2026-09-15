import { RefundRequest } from "../models/index.cjs";

export const create = (data, { session } = {}) => RefundRequest.create([data], { session }).then(([request]) => request);

export const findByOrderId = (orderId) => RefundRequest.findOne({ order: orderId });

export const findById = (id) => RefundRequest.findById(id).populate("order").populate("customer", "name email phone");

export const findAll = ({ status } = {}) => RefundRequest.find(status ? { status } : {})
  .populate("order", "totalPrice paymentMethod orderStatus shippingAddress")
  .populate("customer", "name email phone")
  .populate("processedBy", "name email")
  .sort({ createdAt: -1 });

export const updateById = (id, updates, { session } = {}) => RefundRequest.findByIdAndUpdate(id, updates, {
  new: true,
  runValidators: true,
  session,
});
