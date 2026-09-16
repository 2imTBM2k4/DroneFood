import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import type { BankAccount, Restaurant, Transaction, User, WithdrawalRequest } from "../../types";

interface WalletScreenProps {
  user?: User | null;
  restaurant?: Restaurant | null;
  bankAccount?: BankAccount | null;
  withdrawals: WithdrawalRequest[];
  transactions: Transaction[];
  loading: boolean;
  working: boolean;
  onRequestWithdrawal: (amount: number) => Promise<void>;
  onUpdateBankAccount: (bank: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
  }) => Promise<void>;
  onRefresh: () => void;
}

const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Chờ duyệt", color: "#B45309", bg: "#FEF3C7" },
  approved: { label: "Đã duyệt", color: "#1D4ED8", bg: "#DBEAFE" },
  paid: { label: "Đã thanh toán", color: "#15803D", bg: "#DCFCE7" },
  rejected: { label: "Từ chối", color: "#B91C1C", bg: "#FEE2E2" },
};

export const WalletScreen: React.FC<WalletScreenProps> = ({
  user,
  restaurant,
  bankAccount,
  withdrawals,
  transactions,
  loading,
  working,
  onRequestWithdrawal,
  onUpdateBankAccount,
  onRefresh,
}) => {
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);

  // Form states
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState(bankAccount?.bankName || "");
  const [accountHolder, setAccountHolder] = useState(bankAccount?.accountHolder || "");
  const [accountNumber, setAccountNumber] = useState("");

  const balance = restaurant?.balance ?? user?.walletBalance ?? 0;
  const reserved =
    restaurant?.reservedWithdrawalAmount != null && restaurant.reservedWithdrawalAmount > 0
      ? restaurant.reservedWithdrawalAmount
      : withdrawals
          .filter((w) => ["pending", "approved"].includes(w.status))
          .reduce((sum, w) => sum + (w.reservedAmount || w.amount || 0), 0);
  const availableToWithdraw = Math.max(0, balance - reserved);

  const handleWithdrawSubmit = async () => {
    const val = Number(withdrawAmount);
    if (!Number.isInteger(val) || val < 100000) {
      Alert.alert("Số tiền chưa hợp lệ", "Số tiền rút tối thiểu là 100.000 ₫.");
      return;
    }
    if (val > availableToWithdraw) {
      Alert.alert("Vượt quá số dư", "Số tiền rút vượt quá số dư khả dụng.");
      return;
    }

    try {
      await onRequestWithdrawal(val);
      setWithdrawModalVisible(false);
      setWithdrawAmount("");
      Alert.alert(
        "Đã gửi yêu cầu",
        "Yêu cầu rút tiền đã được gửi tới Ban quản trị để chuyển khoản."
      );
    } catch {
      Alert.alert("Lỗi", "Không thể gửi yêu cầu rút tiền.");
    }
  };

  const handleBankSubmit = async () => {
    if (!bankName.trim() || !accountHolder.trim() || !accountNumber.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng.");
      return;
    }

    try {
      await onUpdateBankAccount({
        bankName: bankName.trim(),
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
      });
      setBankModalVisible(false);
      setAccountNumber("");
      Alert.alert("Thành công", "Đã cập nhật tài khoản ngân hàng nhận tiền.");
    } catch {
      Alert.alert("Lỗi", "Không thể lưu thông tin tài khoản ngân hàng.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Wallet Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Ví doanh thu nhà hàng</Text>
        <Text style={styles.balanceAmount}>{formatVnd(balance)}</Text>

        <View style={styles.balanceRow}>
          <View style={styles.balanceCol}>
            <Text style={styles.subLabel}>Đang giữ chỗ rút</Text>
            <Text style={styles.subValue}>{formatVnd(reserved)}</Text>
          </View>
          <View style={styles.colDivider} />
          <View style={styles.balanceCol}>
            <Text style={styles.subLabel}>Có thể rút ngay</Text>
            <Text style={[styles.subValue, { color: colors.success }]}>
              {formatVnd(availableToWithdraw)}
            </Text>
          </View>
        </View>

        <Button
          label="💰 Yêu cầu rút tiền về ngân hàng"
          variant="primary"
          disabled={availableToWithdraw <= 0}
          onPress={() => setWithdrawModalVisible(true)}
          style={styles.withdrawBtn}
        />
      </View>

      {/* Bank Account Details Card */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>🏦 Tài khoản nhận tiền</Text>
          <Button
            label="Cập nhật STK"
            variant="outline"
            style={styles.updateBankBtn}
            onPress={() => {
              setBankName(bankAccount?.bankName || "");
              setAccountHolder(bankAccount?.accountHolder || "");
              setAccountNumber("");
              setBankModalVisible(true);
            }}
          />
        </View>

        {bankAccount?.bankName ? (
          <View style={styles.bankInfoBox}>
            <Text style={styles.bankName}>{bankAccount.bankName}</Text>
            <Text style={styles.accountHolder}>
              Chủ tài khoản: {bankAccount.accountHolder}
            </Text>
            <Text style={styles.accountNumber}>
              Số tài khoản: {bankAccount.accountNumberMasked || "••••••••"}
            </Text>
          </View>
        ) : (
          <Text style={styles.noBankText}>
            Chưa thiết lập tài khoản ngân hàng. Hãy bấm "Cập nhật STK" để nhận tiền rút.
          </Text>
        )}
      </View>

      {/* Withdrawal Requests History */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Lịch sử yêu cầu rút tiền</Text>
        {withdrawals.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có yêu cầu rút tiền nào.</Text>
        ) : (
          <View style={styles.listWrap}>
            {withdrawals.map((req) => {
              const badge = statusLabel[req.status] || statusLabel.pending;
              return (
                <View key={req._id} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyAmount}>
                      {formatVnd(req.amount)}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                    </Text>
                    {req.bankTransactionReference ? (
                      <Text style={styles.refText}>
                        Mã GD: {req.bankTransactionReference}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badge.bg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Transactions History */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Lịch sử hạch toán</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có giao dịch hạch toán.</Text>
        ) : (
          <View style={styles.listWrap}>
            {transactions.map((tx) => (
              <View key={tx._id} style={styles.historyRow}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text
                    style={[
                      styles.historyAmount,
                      tx.amount >= 0 ? styles.positiveAmount : styles.negativeAmount,
                    ]}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {formatVnd(tx.amount)}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </Text>
                  {tx.balanceAfter != null && (
                    <Text style={styles.balanceAfterText}>
                      Số dư sau GD: {formatVnd(tx.balanceAfter)}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.txType}>
                    {tx.transactionType.replaceAll("_", " ")}
                  </Text>
                  {tx.description ? (
                    <Text style={styles.txDesc} numberOfLines={1}>
                      {tx.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Withdrawal Request Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tạo yêu cầu rút tiền</Text>
            <Text style={styles.modalSub}>
              Số tiền tối đa có thể rút: {formatVnd(availableToWithdraw)}
            </Text>

            <Input
              label="Số tiền muốn rút (VND) *"
              placeholder="Tối thiểu 100.000đ"
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <Button
              label="Xác nhận gửi yêu cầu"
              loading={working}
              onPress={handleWithdrawSubmit}
            />
            <Button
              label="Hủy"
              variant="outline"
              disabled={working}
              onPress={() => setWithdrawModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Bank Account Modal */}
      <Modal
        visible={bankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cập nhật tài khoản nhận tiền</Text>

            <Input
              label="Tên Ngân hàng *"
              placeholder="Ví dụ: Vietcombank, MB Bank, Techcombank..."
              value={bankName}
              onChangeText={setBankName}
            />
            <Input
              label="Họ và tên chủ tài khoản (in hoa không dấu) *"
              placeholder="NGUYEN VAN A"
              autoCapitalize="characters"
              value={accountHolder}
              onChangeText={setAccountHolder}
            />
            <Input
              label="Số tài khoản ngân hàng *"
              placeholder="Nhập số tài khoản"
              keyboardType="numeric"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />

            <Button
              label="Lưu tài khoản ngân hàng"
              loading={working}
              onPress={handleBankSubmit}
            />
            <Button
              label="Hủy"
              variant="outline"
              disabled={working}
              onPress={() => setBankModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  balanceCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  balanceTitle: {
    ...typography.captionBold,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  balanceRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    padding: spacing.sm,
    justifyContent: "space-around",
    marginTop: spacing.xs,
  },
  balanceCol: {
    flex: 1,
    alignItems: "center",
  },
  colDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  subLabel: {
    ...typography.micro,
    color: "#94A3B8",
  },
  subValue: {
    ...typography.subhead,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 2,
  },
  withdrawBtn: {
    marginTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  updateBankBtn: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  bankInfoBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 3,
  },
  bankName: {
    ...typography.subhead,
    color: colors.primary,
  },
  accountHolder: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  accountNumber: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  noBankText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  listWrap: {
    gap: spacing.xs,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  historyAmount: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  positiveAmount: {
    color: colors.success,
  },
  negativeAmount: {
    color: colors.danger,
  },
  historyDate: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  balanceAfterText: {
    ...typography.micro,
    color: colors.primary,
    marginTop: 2,
    fontWeight: "600",
  },
  txDesc: {
    ...typography.micro,
    color: colors.textMuted,
    maxWidth: 160,
  },
  refText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusText: {
    ...typography.micro,
    fontWeight: "700",
  },
  txType: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    paddingVertical: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  modalSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
