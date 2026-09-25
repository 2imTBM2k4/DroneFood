import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../../components/common/Button";
import { Header } from "../../components/common/Header";
import { Input } from "../../components/common/Input";
import { Icon, type IconName } from "../../components/common/Icon";
import { GlassSurface } from "../../components/common/GlassSurface";
import { AddressEditorModal } from "../../components/address/AddressEditorModal";
import type {
  Address,
  AddressBookEntry,
  AddressBookInput,
  UserProfile,
  UserTransaction,
} from "../../types";

interface ProfileScreenProps {
  profile?: UserProfile | null;
  loading: boolean;
  onUpdateProfile: (name: string, phone: string) => Promise<void>;
  onUpdateAvatar: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  onLogout: () => void;
  savedAddress?: Address;
  addressBook: AddressBookEntry[];
  onSaveAddressEntry: (entry: AddressBookInput, editId?: string) => Promise<void>;
  onSetDefaultAddress: (id: string) => Promise<void>;
  onDeleteAddressEntry: (id: string) => Promise<void>;
  transactions?: UserTransaction[];
  transactionsLoading?: boolean;
  onRefreshTransactions?: () => void;
}

const MAX_ADDRESSES = 5;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  loading,
  onUpdateProfile,
  onUpdateAvatar,
  onLogout,
  savedAddress,
  addressBook = [],
  onSaveAddressEntry,
  onSetDefaultAddress,
  onDeleteAddressEntry,
  transactions = [],
  transactionsLoading = false,
  onRefreshTransactions,
}) => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  // Navigation between sub-views/modals
  const [activeView, setActiveView] = useState<
    "profile" | "addresses" | "transactions" | "settings" | null
  >(null);

  // Edit profile form states
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Address Editor Modal state
  const [addressEditorVisible, setAddressEditorVisible] = useState(false);
  const [editingAddressEntry, setEditingAddressEntry] =
    useState<AddressBookEntry | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);

  const handleOpenEditProfile = () => {
    setName(profile?.name || "");
    setPhone(profile?.phone || "");
    setActiveView("profile");
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu họ tên", "Vui lòng nhập họ và tên của bạn.");
      return;
    }
    try {
      setSavingProfile(true);
      await onUpdateProfile(name.trim(), phone.trim());
      setActiveView(null);
      Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân.");
    } catch {
      Alert.alert("Lỗi", "Không thể cập nhật hồ sơ, vui lòng thử lại.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Cần quyền truy cập ảnh",
        "Vui lòng cho phép DroneFood truy cập thư viện ảnh để đổi ảnh đại diện."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    try {
      setUploadingAvatar(true);
      await onUpdateAvatar(result.assets[0]);
      Alert.alert("Thành công", "Đã cập nhật ảnh đại diện.");
    } catch (err: any) {
      Alert.alert("Không thể cập nhật ảnh", err?.message || "Vui lòng thử lại.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: onLogout },
    ]);
  };

  const handleAddNewAddress = () => {
    if (addressBook.length >= MAX_ADDRESSES) {
      Alert.alert(
        "Đã đạt giới hạn",
        `Bạn chỉ có thể lưu tối đa ${MAX_ADDRESSES} địa chỉ nhận hàng.`
      );
      return;
    }
    setEditingAddressEntry(null);
    setAddressEditorVisible(true);
  };

  const handleEditAddress = (entry: AddressBookEntry) => {
    setEditingAddressEntry(entry);
    setAddressEditorVisible(true);
  };

  const handleSaveAddressModal = async (
    input: AddressBookInput,
    editId?: string
  ) => {
    try {
      setSavingAddress(true);
      await onSaveAddressEntry(input, editId);
      setAddressEditorVisible(false);
      setEditingAddressEntry(null);
      Alert.alert(
        "Thành công",
        editId
          ? "Đã cập nhật địa chỉ thành công."
          : "Đã thêm địa chỉ vào sổ địa chỉ."
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể lưu địa chỉ.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleConfirmDeleteAddress = (entry: AddressBookEntry) => {
    if (entry.isDefault) {
      Alert.alert(
        "Không thể xóa",
        "Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước khi xóa."
      );
      return;
    }
    Alert.alert(
      "Xóa địa chỉ",
      `Bạn có chắc chắn muốn xóa địa chỉ "${entry.label}" khỏi sổ địa chỉ?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await onDeleteAddressEntry(entry.id || entry._id || "");
              Alert.alert("Thành công", "Đã xóa địa chỉ.");
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể xóa địa chỉ.");
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (entry: AddressBookEntry) => {
    try {
      await onSetDefaultAddress(entry.id || entry._id || "");
      Alert.alert("Thành công", `Đã đặt "${entry.label}" làm địa chỉ mặc định.`);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể đặt làm mặc định.");
    }
  };

  const getLabelIcon = (label: string): IconName => {
    const l = (label || "").toLowerCase();
    if (l.includes("nhà")) return "home";
    if (l.includes("công ty") || l.includes("văn phòng") || l.includes("work")) return "store";
    return "map-pin";
  };

  return (
    <View style={styles.container}>
      <Header title="Tài khoản của tôi" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* User Profile Overview Card */}
        <GlassSurface tone="soft" contentStyle={[styles.userCard, compact && styles.userCardCompact]}>
          <View style={styles.avatarWrap}>
            {profile?.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                style={styles.avatarImage}
                accessibilityLabel="Ảnh đại diện của bạn"
              />
            ) : (
              <View style={styles.avatarCircle}>
                {profile?.name ? <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text> : <Icon name="profile" size={27} color={colors.primary} />}
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi ảnh đại diện"
              style={({ pressed }) => [styles.avatarEditButton, pressed && styles.avatarEditButtonPressed]}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              hitSlop={6}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : (
                <Icon name="camera" size={15} color={colors.canvas} />
              )}
            </Pressable>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {profile?.name || "Khách hàng"}
            </Text>
            <Text style={styles.userEmail}>{profile?.email}</Text>
            {profile?.phone ? (
              <View style={styles.phoneRow}><Icon name="phone" size={14} color={colors.textSecondary} /><Text style={styles.userPhone}>{profile.phone}</Text></View>
            ) : null}
          </View>
        </GlassSurface>

        {/* Function Menu Group List (Apple Style) */}
        <GlassSurface tone="strong" contentStyle={styles.menuGroupCard}>
          {/* Item 1: Hồ sơ */}
          <Pressable
            style={styles.menuRow}
            onPress={handleOpenEditProfile}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Icon name="profile" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Hồ sơ cá nhân</Text>
                <Text style={styles.menuSubtitle}>
                  {profile?.name || "Cập nhật họ tên, SĐT"}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={19} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* Item 2: Địa chỉ đã lưu */}
          <Pressable
            style={styles.menuRow}
            onPress={() => setActiveView("addresses")}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Icon name="map-pin" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Địa chỉ đã lưu (sổ địa chỉ)</Text>
                <Text style={styles.menuSubtitle}>
                  {addressBook.length}/{MAX_ADDRESSES} địa chỉ đã lưu
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={19} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* Item 3: Lịch sử giao dịch */}
          <Pressable
            style={styles.menuRow}
            onPress={() => {
              onRefreshTransactions?.();
              setActiveView("transactions");
            }}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Icon name="credit-card" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Lịch sử giao dịch</Text>
                <Text style={styles.menuSubtitle}>
                  Xem biến động và số dư sau giao dịch
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={19} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.menuDivider} />

          {/* Item 4: Cài đặt */}
          <Pressable
            style={styles.menuRow}
            onPress={() => setActiveView("settings")}
          >
            <View style={styles.menuLeft}>
              <View style={styles.menuIconBox}>
                <Icon name="settings" size={20} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuTitle}>Cài đặt & Trợ giúp</Text>
                <Text style={styles.menuSubtitle}>
                  Thông tin ứng dụng, hỗ trợ và đăng xuất
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={19} color={colors.textSecondary} />
          </Pressable>
        </GlassSurface>
      </ScrollView>

      {/* Modal 1: Edit Profile */}
      <Modal
        visible={activeView === "profile"}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveView(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cập nhật thông tin hồ sơ</Text>
            <Input
              label="Họ và tên"
              value={name}
              onChangeText={setName}
              placeholder="Nguyễn Văn A"
            />
            <Input
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              placeholder="0901234567"
              keyboardType="phone-pad"
            />
            <Button
              label="Lưu thay đổi"
              loading={savingProfile}
              onPress={handleSaveProfile}
            />
            <Button
              label="Đóng"
              variant="outline"
              onPress={() => setActiveView(null)}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 2: Address Book */}
      <Modal
        visible={activeView === "addresses"}
        animationType="slide"
        onRequestClose={() => setActiveView(null)}
      >
        {addressEditorVisible ? (
          <AddressEditorModal
            embedded
            visible
            onClose={() => setAddressEditorVisible(false)}
            onSave={handleSaveAddressModal}
            initialEntry={editingAddressEntry}
            userProfile={profile}
            saving={savingAddress}
          />
        ) : (
        <View style={styles.fullModalContainer}>
          <Header
            title="Sổ địa chỉ đã lưu"
            onBack={() => setActiveView(null)}
          />
          <ScrollView
            contentContainerStyle={styles.fullModalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionSubtitle}>
                {addressBook.length}/{MAX_ADDRESSES} địa chỉ đã lưu
              </Text>
              {addressBook.length < MAX_ADDRESSES && (
                <Pressable
                  style={styles.addAddressHeaderBtn}
                  onPress={handleAddNewAddress}
                >
                  <Text style={styles.addAddressHeaderBtnText}>＋ Thêm mới</Text>
                </Pressable>
              )}
            </View>

            {addressBook.length === 0 ? (
              <View style={styles.emptyAddressBox}>
                <View style={styles.emptyAddressIcon}><Icon name="map-pin" size={40} color={colors.primary} /></View>
                <Text style={styles.emptyAddressTitle}>
                  Chưa có địa chỉ nào trong sổ
                </Text>
                <Text style={styles.emptyAddressText}>
                  Lưu sẵn các địa chỉ (Nhà riêng, Công ty...) để đặt hàng bay
                  Drone chỉ với 1 chạm.
                </Text>
                <Pressable
                  style={styles.addFirstAddressBtn}
                  onPress={handleAddNewAddress}
                >
                  <Text style={styles.addFirstAddressBtnText}>
                    ＋ Thêm địa chỉ đầu tiên
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.addressList}>
                {addressBook.map((entry) => {
                  const entryId = entry.id || entry._id || "";
                  return (
                    <View
                      key={entryId}
                      style={[
                        styles.addressItemCard,
                        entry.isDefault && styles.addressItemCardDefault,
                      ]}
                    >
                      <View style={styles.addressItemHeader}>
                        <View style={styles.addressLabelRow}>
                          <Icon name={getLabelIcon(entry.label)} size={17} color={colors.textSecondary} />
                          <Text style={styles.addressItemLabel}>
                            {entry.label}
                          </Text>
                          {entry.isDefault ? (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>
                                Mặc định
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <Text style={styles.addressItemRecipient}>
                        {entry.recipient ||
                          entry.fullName ||
                          profile?.name ||
                          "Người nhận"}{" "}
                        • {entry.phone}
                      </Text>

                      <Text style={styles.addressItemDetail}>
                        {entry.address}, {entry.state}, {entry.city}
                      </Text>

                      <View style={styles.addressActionsRow}>
                        <Pressable
                          style={styles.actionPill}
                          onPress={() => handleEditAddress(entry)}
                        >
                          <Text style={styles.actionPillText}>Sửa</Text>
                        </Pressable>

                        {!entry.isDefault && (
                          <Pressable
                            style={styles.actionPill}
                            onPress={() => handleSetDefault(entry)}
                          >
                            <Text style={styles.actionPillText}>
                              Đặt mặc định
                            </Text>
                          </Pressable>
                        )}

                        {!entry.isDefault && (
                          <Pressable
                            style={[styles.actionPill, styles.deletePill]}
                            onPress={() => handleConfirmDeleteAddress(entry)}
                          >
                            <Text style={styles.deletePillText}>Xóa</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
        )}
      </Modal>

      {/* Modal 3: Transaction History */}
      <Modal
        visible={activeView === "transactions"}
        animationType="slide"
        onRequestClose={() => setActiveView(null)}
      >
        <View style={styles.fullModalContainer}>
          <Header
            title="Lịch sử giao dịch PayOS"
            onBack={() => setActiveView(null)}
          />
          <ScrollView
            contentContainerStyle={styles.fullModalScroll}
            showsVerticalScrollIndicator={false}
          >
            {transactionsLoading ? (
              <Text style={styles.emptyListText}>Đang tải giao dịch PayOS...</Text>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyAddressBox}>
                <View style={styles.emptyAddressIcon}><Icon name="credit-card" size={40} color={colors.primary} /></View>
                <Text style={styles.emptyAddressTitle}>
                  Chưa có giao dịch PayOS nào
                </Text>
                <Text style={styles.emptyAddressText}>
                  Lịch sử thanh toán online qua cổng PayOS cho các đơn hàng của bạn sẽ được hiển thị tại đây.
                </Text>
              </View>
            ) : (
              <View style={styles.txListContainer}>
                {transactions.map((tx) => (
                  <View key={tx._id} style={styles.txItemCard}>
                    <View style={styles.txItemTop}>
                      <View style={styles.txTitleCol}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={styles.txTitleText}>{tx.title}</Text>
                          <View style={styles.payosBadge}>
                            <Text style={styles.payosBadgeText}>PayOS</Text>
                          </View>
                        </View>
                        <Text style={styles.txDateText}>
                          {new Date(tx.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.txAmountText,
                          tx.amount >= 0 ? styles.txPositive : styles.txNegative,
                        ]}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatVnd(tx.amount)}
                      </Text>
                    </View>

                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal 4: Settings & Info */}
      <Modal
        visible={activeView === "settings"}
        animationType="slide"
        onRequestClose={() => setActiveView(null)}
      >
        <View style={styles.fullModalContainer}>
          <Header
            title="Cài đặt & Hệ thống"
            onBack={() => setActiveView(null)}
          />
          <ScrollView
            contentContainerStyle={styles.fullModalScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Thông tin ứng dụng</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phiên bản</Text>
                <Text style={styles.infoValue}>Drone Food v2.1.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hỗ trợ khách hàng</Text>
                <Text style={styles.infoValue}>support@dronefood.vn</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vận chuyển</Text>
                <Text style={styles.infoValue}>Autonomous Drone Fleet</Text>
              </View>
            </View>

            <Button
              label="Đăng xuất tài khoản"
              variant="outline"
              onPress={handleConfirmLogout}
            />
          </ScrollView>
        </View>
      </Modal>

    </View>
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
  userCard: {
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  userCardCompact: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    position: "relative",
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  userEmail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  userPhone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  menuGroupCard: {
    overflow: "hidden",
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
  },
  avatarEditButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  avatarEditButtonPressed: {
    backgroundColor: colors.primaryFocus,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 68,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  menuText: {
    flex: 1,
    minWidth: 0,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  menuIconText: {
    fontSize: 20,
  },
  menuTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  chevron: {
    fontSize: 24,
    color: "#94A3B8",
    fontWeight: "300",
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fullModalScroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 60,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  addAddressHeaderBtn: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  addAddressHeaderBtnText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  emptyAddressBox: {
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.94)",
    borderStyle: "dashed",
    marginTop: spacing.md,
  },
  emptyAddressIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyAddressTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  emptyAddressText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  addFirstAddressBtn: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addFirstAddressBtnText: {
    ...typography.captionBold,
    color: "#FFF",
  },
  addressList: {
    gap: spacing.sm,
  },
  addressItemCard: {
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  addressItemCardDefault: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  addressItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addressItemIcon: {
    fontSize: 16,
  },
  addressItemLabel: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  defaultBadgeText: {
    ...typography.micro,
    color: colors.primary,
    fontWeight: "700",
  },
  addressItemRecipient: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  addressItemDetail: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  addressActionsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  actionPill: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  actionPillText: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontSize: 11,
  },
  deletePill: {
    backgroundColor: "#FEE2E2",
  },
  deletePillText: {
    ...typography.captionBold,
    color: colors.danger,
    fontSize: 11,
  },
  txListContainer: {
    gap: spacing.sm,
  },
  txItemCard: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  txItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  txTitleCol: {
    flex: 1,
    gap: 2,
  },
  txTitleText: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  txDateText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  txAmountText: {
    ...typography.subheadBold,
    fontSize: 15,
  },
  txPositive: {
    color: colors.success,
  },
  txNegative: {
    color: colors.textPrimary,
  },
  payosBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payosBadgeText: {
    ...typography.micro,
    fontWeight: "800",
    color: colors.primary,
  },
  emptyListText: {
    ...typography.subhead,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 30,
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.94)",
  },
  sectionTitle: {
    ...typography.subheadBold,
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 400,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.98)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 6,
  },
  modalTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
});
