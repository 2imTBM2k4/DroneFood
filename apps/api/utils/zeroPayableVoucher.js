export const ZERO_PAYABLE_VOUCHER_STATUS = "ZERO_PAYABLE_VOUCHER";

// A PAYOS selection can be fully settled by vouchers without a provider
// payment. Keep the marker strict so historic/ordinary paid PayOS orders
// retain their existing provider-refund behavior.
export const isZeroPayableVoucherOrder = (order) =>
  order?.paymentMethod === "PAYOS" &&
  order?.isPaid === true &&
  Number(order.totalPrice) === 0 &&
  order?.paymentResult?.status === ZERO_PAYABLE_VOUCHER_STATUS;
