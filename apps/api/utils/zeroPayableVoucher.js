export const ZERO_PAYABLE_VOUCHER_STATUS = "ZERO_PAYABLE_VOUCHER";

// A checkout can be fully settled by vouchers without cash or a payment
// provider. Keep the marker strict so ordinary paid orders retain their
// existing collection and refund behavior.
export const isZeroPayableVoucherOrder = (order) =>
  order?.isPaid === true &&
  Number(order.totalPrice) === 0 &&
  order?.paymentResult?.status === ZERO_PAYABLE_VOUCHER_STATUS;
