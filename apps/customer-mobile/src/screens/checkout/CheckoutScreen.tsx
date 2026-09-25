import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Input } from "../../components/common/Input";
import { Icon } from "../../components/common/Icon";
import { GlassSurface } from "../../components/common/GlassSurface";
import { AddressEditorModal } from "../../components/address/AddressEditorModal";
import type {
  Address,
  AddressBookEntry,
  AddressBookInput,
  Cart,
  DeliveryMethod,
  PaymentMethod,
  Quote,
  UserProfile,
} from "../../types";

interface CheckoutScreenProps {
  cart?: Cart;
  address: Address;
  onAddressChange: (key: keyof Address, value: string) => void;
  onUseGps: () => Promise<void>;
  onFindGeocode: () => Promise<void>;
  deliveryMethod: DeliveryMethod;
  onDeliveryMethodChange: (method: DeliveryMethod) => void;
  quotes: Partial<Record<DeliveryMethod, Quote>>;
  quoting: boolean;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onPlaceOrder: () => Promise<void>;
  working: boolean;
  onBack: () => void;
  addressBook?: AddressBookEntry[];
  selectedAddressId?: string;
  onSelectSavedAddress?: (entry: AddressBookEntry) => void;
  onSaveNewAddress?: (entry: AddressBookInput) => Promise<void>;
  userProfile?: UserProfile | null;
  voucherCodes?: string[];
  onApplyVoucher?: (code: string) => Promise<void>;
  onRemoveVoucher?: (code: string) => Promise<void>;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  cart,
  address,
  onAddressChange,
  onUseGps,
  onFindGeocode,
  deliveryMethod,
  onDeliveryMethodChange,
  quotes,
  quoting,
  paymentMethod,
  onPaymentMethodChange,
  onPlaceOrder,
  working,
  onBack,
  addressBook = [],
  selectedAddressId,
  onSelectSavedAddress,
  onSaveNewAddress,
  userProfile,
  voucherCodes = [],
  onApplyVoucher,
  onRemoveVoucher,
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [useCustomAddress, setUseCustomAddress] = React.useState(false);
  const [voucherInput, setVoucherInput] = React.useState("");
  const [applyingVoucher, setApplyingVoucher] = React.useState(false);
  const [voucherErrorMsg, setVoucherErrorMsg] = React.useState("");
  const [showAddAddressModal, setShowAddAddressModal] = React.useState(false);
  const [savingNewAddress, setSavingNewAddress] = React.useState(false);

  const currentQuote = quotes[deliveryMethod];
  const subtotal = cart?.subtotal || 0;
  const shippingFee = currentQuote?.shippingPrice || 0;
  const discountAmount = currentQuote?.discountAmount || 0;
  const total = currentQuote?.totalPrice ?? Math.max(0, subtotal + shippingFee - discountAmount);
  const appliedVouchers = currentQuote?.vouchers || [];

  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) return;
    if (voucherCodes.includes(voucherInput.trim().toUpperCase())) {
      setVoucherErrorMsg("Mã voucher này đã được áp dụng.");
      return;
    }
    try {
      setApplyingVoucher(true);
      setVoucherErrorMsg("");
      await onApplyVoucher?.(voucherInput.trim().toUpperCase());
      setVoucherInput("");
    } catch (err: any) {
      setVoucherErrorMsg(err?.message || "Mã voucher không hợp lệ hoặc đã hết hạn.");
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = async (code: string) => {
    try {
      setApplyingVoucher(true);
      setVoucherErrorMsg("");
      await onRemoveVoucher?.(code);
    } catch (err: any) {
      setVoucherErrorMsg(err?.message || "Không thể bỏ mã voucher này.");
    } finally {
      setApplyingVoucher(false);
    }
  };

  const hasCoords =
    Number.isFinite(Number(address.lat)) && Number.isFinite(Number(address.lng));

  const handleSelectDeliveryMethod = (method: DeliveryMethod) => {
    onDeliveryMethodChange(method);
    // If switching to Drone, payment must be online (PayOS)
    if (method === "drone" && paymentMethod === "COD") {
      onPaymentMethodChange("PAYOS");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Header title="Thanh toán & Đặt đơn" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Delivery Address Section */}
        <GlassSurface tone="strong" contentStyle={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}><Icon name="map-pin" size={19} color={colors.textPrimary} /><Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text></View>
            {hasCoords ? (
              <View style={styles.coordBadge}>
                <Text style={styles.coordText}>Tọa độ GPS ✓</Text>
              </View>
            ) : (
              <View style={[styles.coordBadge, styles.coordWarning]}>
                <Text style={styles.coordWarningText}>Chưa có tọa độ GPS</Text>
              </View>
            )}
          </View>

          {/* Address Book Options - Like Web */}
          {addressBook.length > 0 && !useCustomAddress ? (
            <View style={styles.savedAddressList}>
              <Text style={styles.savedSubTitle}>Chọn địa chỉ nhận hàng đã lưu:</Text>
              {addressBook.map((entry) => {
                const entryId = entry.id || entry._id;
                const isSelected =
                  (selectedAddressId && selectedAddressId === entryId) ||
                  (!selectedAddressId && address.address.trim() === entry.address.trim());
                return (
                  <Pressable
                    key={entryId}
                    style={[
                      styles.addressOptionCard,
                      isSelected && styles.addressOptionCardSelected,
                    ]}
                    onPress={() => {
                      setUseCustomAddress(false);
                      onSelectSavedAddress?.(entry);
                    }}
                  >
                    <View style={styles.radioOptionRow}>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={styles.addressOptionContent}>
                        <View style={styles.addressOptionHeader}>
                          <Text style={styles.addressOptionLabel}>
                            {entry.label}
                          </Text>
                          {entry.isDefault ? (
                            <View style={styles.defaultBadgePill}>
                              <Text style={styles.defaultBadgePillText}>Mặc định</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.addressOptionRecipient}>
                          {entry.recipient || entry.fullName || userProfile?.name || "Người nhận"} • {entry.phone}
                        </Text>
                        <Text style={styles.addressOptionDetail} numberOfLines={2}>
                          {entry.address}, {entry.city}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                style={styles.chooseOtherBtn}
                onPress={() => setUseCustomAddress(true)}
              >
                <Text style={styles.chooseOtherBtnText}>
                  ＋ Giao đến địa chỉ khác ngoài sổ
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.customAddressForm}>
              {addressBook.length > 0 ? (
                <Pressable
                  style={styles.backToSavedBtn}
                  onPress={() => setUseCustomAddress(false)}
                >
                  <Text style={styles.backToSavedText}>‹ Chọn từ Sổ địa chỉ đã lưu</Text>
                </Pressable>
              ) : null}

              <Input
                label="Họ và tên người nhận"
                placeholder="Nguyễn Văn A"
                value={address.fullName}
                onChangeText={(val) => onAddressChange("fullName", val)}
              />

              <Input
                label="Số điện thoại"
                placeholder="0901234567"
                keyboardType="phone-pad"
                value={address.phone}
                onChangeText={(val) => onAddressChange("phone", val)}
              />

              <Input
                label="Số nhà, tên đường"
                placeholder="Ví dụ: 123 Nguyễn Huệ, P. Bến Nghé"
                value={address.address}
                onChangeText={(val) => onAddressChange("address", val)}
              />

              <View style={[styles.row, compact && styles.stackOnCompact]}>
                <Input
                  containerStyle={[styles.halfCol, compact && styles.fullWidth]}
                  label="Quận / Huyện"
                  placeholder="Quận 1"
                  value={address.city}
                  onChangeText={(val) => onAddressChange("city", val)}
                />
                <Input
                  containerStyle={[styles.halfCol, compact && styles.fullWidth]}
                  label="Tỉnh / Thành"
                  placeholder="TP. Hồ Chí Minh"
                  value={address.state}
                  onChangeText={(val) => onAddressChange("state", val)}
                />
              </View>

              <View style={[styles.locButtonsRow, compact && styles.stackOnCompact]}>
                <Button
                  label="Dùng GPS hiện tại"
                  icon={<Icon name="crosshair" size={17} color={colors.primary} />}
                  variant="secondary"
                  loading={working}
                  style={[styles.halfBtn, compact && styles.fullWidth]}
                  onPress={onUseGps}
                />
                <Button
                  label="Tìm tọa độ từ địa chỉ"
                  icon={<Icon name="search" size={17} color={colors.textPrimary} />}
                  variant="outline"
                  loading={working}
                  style={[styles.halfBtn, compact && styles.fullWidth]}
                  onPress={onFindGeocode}
                />
              </View>
            </View>
          )}
        </GlassSurface>

        {/* Delivery Method Selector */}
        <GlassSurface tone="strong" contentStyle={styles.sectionCard}>
          <View style={styles.sectionTitleRow}><Icon name="drone" size={20} color={colors.textPrimary} /><Text style={styles.sectionTitle}>Phương thức giao hàng</Text></View>

          <Pressable
            style={[
              styles.methodOption,
              compact && styles.optionCompact,
              deliveryMethod === "drone" && styles.methodSelected,
            ]}
            onPress={() => handleSelectDeliveryMethod("drone")}
          >
            <View style={styles.methodIconWrapper}>
              <Icon name="drone" size={26} color={colors.primary} />
            </View>
            <View style={styles.methodBody}>
              <View style={styles.methodTitleRow}>
                <Text style={styles.methodTitle}>Giao bằng Drone siêu tốc</Text>
                <View style={styles.fastTag}>
                  <Text style={styles.fastTagText}>10-15 phút</Text>
                </View>
              </View>
              <Text style={styles.methodDesc}>
                Bay thẳng theo đường chim bay, không lo kẹt xe. Chỉ áp dụng thanh toán online.
              </Text>
              <Text style={styles.methodFee}>
                {quoting ? "Đang tính phí..." : quotes.drone ? formatVnd(quotes.drone.shippingPrice) : "Chờ nhập địa chỉ"}
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.methodOption,
              compact && styles.optionCompact,
              deliveryMethod === "shipper" && styles.methodSelected,
            ]}
            onPress={() => handleSelectDeliveryMethod("shipper")}
          >
            <View style={styles.methodIconWrapper}>
              <Icon name="motorcycle" size={26} color={colors.primary} />
            </View>
            <View style={styles.methodBody}>
              <View style={styles.methodTitleRow}>
                <Text style={styles.methodTitle}>Giao bằng Shipper truyền thống</Text>
                <View style={[styles.fastTag, styles.shipperTag]}>
                  <Text style={styles.shipperTagText}>25-35 phút</Text>
                </View>
              </View>
              <Text style={styles.methodDesc}>
                Tài xế giao xe máy tận cửa, hỗ trợ trả tiền mặt COD hoặc chuyển khoản.
              </Text>
              <Text style={styles.methodFee}>
                {quoting ? "Đang tính phí..." : quotes.shipper ? formatVnd(quotes.shipper.shippingPrice) : "Chờ nhập địa chỉ"}
              </Text>
            </View>
          </Pressable>
        </GlassSurface>

        {/* Payment Method Selector */}
        <GlassSurface tone="strong" contentStyle={styles.sectionCard}>
          <View style={styles.sectionTitleRow}><Icon name="credit-card" size={20} color={colors.textPrimary} /><Text style={styles.sectionTitle}>Hình thức thanh toán</Text></View>

          <Pressable
            style={[
              styles.paymentOption,
              compact && styles.optionCompact,
              paymentMethod === "PAYOS" && styles.paymentSelected,
            ]}
            onPress={() => onPaymentMethodChange("PAYOS")}
          >
            <Icon name="credit-card" size={27} color={colors.primary} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>
                PayOS (Chuyển khoản VietQR / Thẻ ATM)
              </Text>
              <Text style={styles.paymentDesc}>
                Thanh toán nhanh qua ứng dụng ngân hàng, an toàn và tức thì.
              </Text>
            </View>
            <View
              style={[
                styles.radioCircle,
                paymentMethod === "PAYOS" && styles.radioCircleSelected,
              ]}
            >
              {paymentMethod === "PAYOS" ? (
                <View style={styles.radioInner} />
              ) : null}
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.paymentOption,
              compact && styles.optionCompact,
              paymentMethod === "COD" && styles.paymentSelected,
              deliveryMethod === "drone" && styles.paymentDisabled,
            ]}
            disabled={deliveryMethod === "drone"}
            onPress={() => onPaymentMethodChange("COD")}
          >
            <Icon name="banknote" size={27} color={colors.primary} />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Tiền mặt khi nhận hàng (COD)</Text>
              <Text style={styles.paymentDesc}>
                {deliveryMethod === "drone"
                  ? "Drone không thu tiền mặt, vui lòng chọn thanh toán online."
                  : "Thanh toán trực tiếp cho Shipper khi nhận món."}
              </Text>
            </View>
            <View
              style={[
                styles.radioCircle,
                paymentMethod === "COD" && styles.radioCircleSelected,
              ]}
            >
              {paymentMethod === "COD" ? (
                <View style={styles.radioInner} />
              ) : null}
            </View>
          </Pressable>
        </GlassSurface>

        {/* Voucher Section */}
        <GlassSurface tone="soft" contentStyle={styles.sectionCard}>
          <View style={styles.sectionTitleRow}><Icon name="ticket" size={20} color={colors.textPrimary} /><Text style={styles.sectionTitle}>Mã ưu đãi / Voucher</Text></View>
          <View style={[styles.voucherInputRow, compact && styles.stackOnCompact]}>
            <Input
              containerStyle={styles.voucherInput}
              placeholder="Nhập mã voucher (VD: DRONE50)"
              value={voucherInput}
              onChangeText={(text) => {
                setVoucherInput(text.toUpperCase());
                setVoucherErrorMsg("");
              }}
              autoCapitalize="characters"
            />
            <Button
              label="Áp dụng"
              variant="primary"
              disabled={!voucherInput.trim() || applyingVoucher}
              loading={applyingVoucher}
              style={[styles.voucherApplyBtn, compact && styles.fullWidth]}
              onPress={handleApplyVoucher}
            />
          </View>

          {appliedVouchers.length > 0 ? (
            <View style={styles.appliedVoucherList}>
              {appliedVouchers.map((voucher) => (
                <View key={voucher.code} style={styles.appliedVoucherBox}>
                  <View style={styles.appliedVoucherLeft}>
                    <Text style={styles.appliedVoucherBadge}>MÃ: {voucher.code}</Text>
                    <Text style={styles.appliedVoucherDiscount}>
                      Giảm: -{formatVnd(voucher.discountAmount)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ voucher ${voucher.code}`}
                    disabled={applyingVoucher || working}
                    onPress={() => handleRemoveVoucher(voucher.code)}
                    style={styles.removeVoucherBtn}
                  >
                    <Text style={styles.removeVoucherText}>Bỏ mã</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {voucherErrorMsg ? (
            <Text style={styles.voucherErrorText}>{voucherErrorMsg}</Text>
          ) : null}
        </GlassSurface>

        {/* Total Summary */}
        <GlassSurface tone="strong" contentStyle={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Tiền món ({cart?.items.length || 0} món)</Text>
            <Text style={styles.priceVal}>{formatVnd(subtotal)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>
              Phí giao hàng ({deliveryMethod === "drone" ? "Drone" : "Shipper"})
            </Text>
            <Text style={styles.priceVal}>
              {quoting ? "..." : formatVnd(shippingFee)}
            </Text>
          </View>
          {discountAmount > 0 ? (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.success }]}>
                Giảm giá Voucher ({appliedVouchers.length} mã)
              </Text>
              <Text style={[styles.priceVal, { color: colors.success, fontWeight: "700" }]}>
                -{formatVnd(discountAmount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.grandLabel}>Tổng thanh toán</Text>
            <Text style={styles.grandVal}>{formatVnd(total)}</Text>
          </View>
        </GlassSurface>

        <Button
          label={`Đặt đơn hàng ngay • ${formatVnd(total)}`}
          loading={working || quoting}
          onPress={onPlaceOrder}
        />
      </ScrollView>

      {/* Add Address Modal directly from Checkout */}
      {onSaveNewAddress ? (
        <AddressEditorModal
          visible={showAddAddressModal}
          onClose={() => setShowAddAddressModal(false)}
          onSave={async (input) => {
            try {
              setSavingNewAddress(true);
              await onSaveNewAddress(input);
              setShowAddAddressModal(false);
              Alert.alert("Thành công", "Đã thêm địa chỉ mới vào sổ địa chỉ!");
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể lưu địa chỉ.");
            } finally {
              setSavingNewAddress(false);
            }
          }}
          userProfile={userProfile}
          saving={savingNewAddress}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 110,
  },
  scrollContentCompact: {
    paddingHorizontal: spacing.sm,
  },
  sectionCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  coordBadge: {
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  coordText: {
    ...typography.micro,
    color: colors.statusDeliveredText,
    fontWeight: "700",
  },
  coordWarning: {
    backgroundColor: colors.statusPendingBg,
  },
  coordWarningText: {
    ...typography.micro,
    color: colors.statusPendingText,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stackOnCompact: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  halfCol: {
    flex: 1,
  },
  fullWidth: {
    width: "100%",
    flex: 0,
  },
  locButtonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  halfBtn: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  optionCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  methodOption: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    minHeight: 96,
  },
  methodSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  methodIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: "rgba(235, 245, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodIcon: {
    fontSize: 22,
  },
  methodBody: {
    flex: 1,
    gap: 3,
  },
  methodTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  methodTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  fastTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  fastTagText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "700",
  },
  shipperTag: {
    backgroundColor: colors.surfaceSubtle,
  },
  shipperTagText: {
    color: colors.textSecondary,
  },
  methodDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  methodFee: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
    marginTop: 4,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    minHeight: 88,
  },
  paymentSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentDisabled: {
    opacity: 0.45,
  },
  paymentIcon: {
    fontSize: 22,
  },
  paymentInfo: {
    flex: 1,
    gap: 2,
  },
  paymentName: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  paymentDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  priceVal: {
    ...typography.bodySecondary,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  grandLabel: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  grandVal: {
    ...typography.title1,
    color: colors.primary,
    fontWeight: "700",
  },
  savedBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  savedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  savedTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  addInlineBtn: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  addInlineText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  savedScroll: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  savedChip: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 140,
    maxWidth: 200,
    gap: 2,
  },
  savedChipPicked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  savedChipTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  savedChipIcon: {
    fontSize: 14,
  },
  savedChipLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 1,
  },
  savedChipLabelPicked: {
    color: colors.primary,
  },
  savedChipStar: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "700",
  },
  savedChipStreet: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  savedAddressList: {
    gap: spacing.xs,
  },
  savedSubTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  addressOptionCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    minHeight: 72,
  },
  addressOptionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  radioOptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  addressOptionContent: {
    flex: 1,
    gap: 2,
  },
  addressOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addressOptionLabel: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  defaultBadgePill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  defaultBadgePillText: {
    ...typography.micro,
    color: "#B45309",
    fontWeight: "700",
  },
  addressOptionRecipient: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  addressOptionDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chooseOtherBtn: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    backgroundColor: "rgba(255, 255, 255, 0.68)",
  },
  chooseOtherBtnText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  customAddressForm: {
    gap: spacing.xs,
  },
  backToSavedBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.xs,
    marginBottom: 4,
  },
  backToSavedText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  voucherInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  voucherInput: {
    flex: 1,
    marginBottom: 0,
  },
  voucherApplyBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  appliedVoucherBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  appliedVoucherList: {
    gap: spacing.xs,
  },
  appliedVoucherLeft: {
    flex: 1,
    gap: 2,
  },
  appliedVoucherBadge: {
    ...typography.captionBold,
    color: "#166534",
  },
  appliedVoucherDiscount: {
    ...typography.caption,
    color: "#15803D",
    fontWeight: "600",
  },
  removeVoucherBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: "#FEE2E2",
  },
  removeVoucherText: {
    ...typography.captionBold,
    color: "#DC2626",
    fontSize: 11,
  },
  voucherErrorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 4,
  },
});
