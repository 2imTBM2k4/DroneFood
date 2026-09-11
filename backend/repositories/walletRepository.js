import {
  Order,
  Restaurant,
  ShipperDeposit,
  ShipperEarningsWallet,
  WalletTransaction,
  WalletPayment,
} from "../models/index.cjs";

export const ensureShipperWallets = async (shipperId, session) => {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true, ...(session && { session }) };
  await Promise.all([
    ShipperDeposit.findOneAndUpdate({ shipper: shipperId }, { $setOnInsert: { shipper: shipperId, balance: 0 } }, options),
    ShipperEarningsWallet.findOneAndUpdate(
      { shipper: shipperId },
      { $setOnInsert: { shipper: shipperId, balance: 0, reservedCodLiability: 0 } },
      options
    ),
  ]);
};

export const getShipperWallets = async (shipperId, session) => {
  const options = session ? { session } : undefined;
  const [deposit, earnings] = await Promise.all([
    ShipperDeposit.findOne({ shipper: shipperId }, null, options),
    ShipperEarningsWallet.findOne({ shipper: shipperId }, null, options),
  ]);
  return { deposit, earnings };
};

export const updateRestaurantBalance = async (restaurantId, amount, session) =>
  Restaurant.findOneAndUpdate(
    amount < 0 ? { _id: restaurantId, balance: { $gte: -amount } } : { _id: restaurantId },
    { $inc: { balance: amount } },
    { new: true, session, runValidators: true }
  );

export const updateDepositBalance = async (shipperId, amount, session) =>
  ShipperDeposit.findOneAndUpdate(
    amount < 0 ? { shipper: shipperId, balance: { $gte: -amount } } : { shipper: shipperId },
    { $inc: { balance: amount } },
    { new: true, session, runValidators: true }
  );

export const updateEarningsBalance = async (shipperId, amount, session) =>
  ShipperEarningsWallet.findOneAndUpdate(
    { shipper: shipperId },
    { $inc: { balance: amount } },
    { new: true, session, runValidators: true }
  );

export const updateReservedCodLiability = async (shipperId, amount, session) =>
  ShipperEarningsWallet.findOneAndUpdate(
    amount < 0
      ? { shipper: shipperId, reservedCodLiability: { $gte: -amount } }
      : { shipper: shipperId },
    { $inc: { reservedCodLiability: amount } },
    { new: true, session, runValidators: true }
  );

export const createTransaction = async (data, session) =>
  WalletTransaction.create([{ ...data }], { session }).then(([transaction]) => transaction);

export const findTransactionByEventKey = (eventKey) => WalletTransaction.findOne({ eventKey });

export const createPayment = async (data) => WalletPayment.create(data);
export const findPaymentByReference = async (vnpTxnRef) => WalletPayment.findOne({ vnpTxnRef });

export const listTransactions = async ({ ownerId, walletType }) =>
  WalletTransaction.find({ ownerId, ...(walletType && { walletType }) }).sort({ createdAt: -1 });

/** Lists completed online-delivery earnings used by the shipper income report. */
export const listShipperOnlineEarnings = async (shipperId) =>
  WalletTransaction.find({
    ownerId: shipperId,
    walletType: "shipper_earnings",
    transactionType: "shipper_online_delivery_earnings",
  }).sort({ createdAt: -1 });

export const reserveOrderCodLiability = async (orderId, shipperId, amount, session) =>
  Order.findOneAndUpdate(
    { _id: orderId, shipperId, codReservationStatus: "none" },
    { $set: { codReservationStatus: "reserved", codReservedLiability: amount } },
    { new: true, session }
  );

export const releaseOrderCodLiability = async (orderId, session) =>
  Order.findOneAndUpdate(
    { _id: orderId, codReservationStatus: "reserved" },
    { $set: { codReservationStatus: "released", codReservedLiability: 0 } },
    { new: true, session }
  );
