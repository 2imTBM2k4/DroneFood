// backend/models/index.js
// File này export tất cả models để dễ import

// const User = require('./userModel.cjs');
// const Product = require('./productModel.cjs');
// const Order = require('./orderModel.cjs');
// const Review = require('./reviewModel.cjs');
// const Category = require('./categoryModel.cjs');
// const Food = require('./foodModel.cjs');

// module.exports = {
//   User,
//   Product,
//   Order,
//   Review,
//   Category,
//   Food
// };

// backend/models/index.cjs
const User = require("./userModel.cjs");
// const Product = require("./productModel.cjs"); // Không sử dụng - comment để tránh tạo collection
const Order = require("./orderModel.cjs");
// const Review = require("./reviewModel.cjs"); // Không sử dụng - comment để tránh tạo collection
// const Category = require("./categoryModel.cjs"); // Không sử dụng - comment để tránh tạo collection
const Food = require("./foodModel.cjs");
const Restaurant = require("./restaurantModel.cjs");
const Cart = require("./cartModel.cjs");
const ShipperProfile = require("./shipperProfileModel.cjs");
const ShipperDeposit = require("./shipperDepositModel.cjs");
const ShipperEarningsWallet = require("./shipperEarningsWalletModel.cjs");
const WalletTransaction = require("./walletTransactionModel.cjs");
const WalletPayment = require("./walletPaymentModel.cjs");
const RestaurantWithdrawal = require("./restaurantWithdrawalModel.cjs");
const ShipperAccountClosure = require("./shipperAccountClosureModel.cjs");
const Voucher = require("./voucherModel.cjs");
const VoucherRedemption = require("./voucherRedemptionModel.cjs");
const VoucherUserUsage = require("./voucherUserUsageModel.cjs");
const RefundRequest = require("./refundRequestModel.cjs");

module.exports = {
  User,
  // Product, // Không sử dụng
  Order,
  // Review, // Không sử dụng
  // Category, // Không sử dụng
  Food,
  Restaurant,
  Cart,
  ShipperProfile,
  ShipperDeposit,
  ShipperEarningsWallet,
  WalletTransaction,
  WalletPayment,
  RestaurantWithdrawal,
  ShipperAccountClosure,
  Voucher,
  VoucherRedemption,
  VoucherUserUsage,
  RefundRequest,
};
