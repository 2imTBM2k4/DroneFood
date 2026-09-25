import type * as ImagePicker from "expo-image-picker";

export type Tab = "overview" | "orders" | "menu" | "wallet" | "account";

export type User = {
  _id?: string;
  name: string;
  email: string;
  role: string;
  restaurantId?: string;
  walletBalance?: number;
};

export type Restaurant = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  image?: string;
  isOpen?: boolean;
  lat?: number;
  lng?: number;
  balance?: number;
  reservedWithdrawalAmount?: number;
};

export type Option = {
  name: string;
  priceDelta?: number;
};

export type OptionGroup = {
  name: string;
  type: "single" | "multi";
  required?: boolean;
  min?: number;
  max?: number;
  options: Option[];
};

export type Food = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  optionGroups?: OptionGroup[];
};

export type OrderStatus =
  | "pending"
  | "preparing"
  | "delivering"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  name: string;
  quantity: number;
  price?: number;
  selectedOptions?: { groupName: string; optionName: string }[];
  note?: string;
};

export type Order = {
  _id: string;
  orderStatus: OrderStatus;
  deliveryMethod: "drone" | "shipper";
  totalPrice: number;
  createdAt: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
  };
  orderItems: OrderItem[];
  reason?: string;
  paymentMethod?: string;
};

export type DraftFood = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  image?: ImagePicker.ImagePickerAsset | null;
  existingImage?: string;
  optionGroups: OptionGroup[];
};

export type BankAccount = {
  bankName: string;
  accountHolder: string;
  accountNumber?: string;
  accountNumberMasked?: string;
};

export type WithdrawalRequest = {
  _id: string;
  amount: number;
  reservedAmount?: number;
  status: "pending" | "approved" | "paid" | "rejected";
  createdAt: string;
  bankTransactionReference?: string;
  rejectionReason?: string;
};

export type Transaction = {
  _id: string;
  amount: number;
  transactionType: string;
  createdAt: string;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
};
