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
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import type { Restaurant } from "../../types";

interface AccountScreenProps {
  restaurant?: Restaurant | null;
  working: boolean;
  onUpdateProfile?: (data: {
    name: string;
    address: string;
    phone: string;
    email: string;
    description: string;
  }) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onLogout: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  restaurant,
  working,
  onUpdateProfile,
  onChangePassword,
  onLogout,
}) => {
  const isOpen = restaurant?.isOpen !== false;
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");

  // Form states for editing restaurant
  const [name, setName] = useState(restaurant?.name || "");
  const [address, setAddress] = useState(restaurant?.address || "");
  const [phone, setPhone] = useState(restaurant?.phone || "");
  const [email, setEmail] = useState(restaurant?.email || "");
  const [description, setDescription] = useState(restaurant?.description || "");

  const handleOpenEdit = () => {
    setName(restaurant?.name || "");
    setAddress(restaurant?.address || "");
    setPhone(restaurant?.phone || "");
    setEmail(restaurant?.email || "");
    setDescription(restaurant?.description || "");
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên nhà hàng.");
      return;
    }
    if (!onUpdateProfile) return;

    try {
      await onUpdateProfile({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        description: description.trim(),
      });
      setEditModalVisible(false);
    } catch {
      // Error handled by parent
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có muốn đăng xuất khỏi tài khoản nhà hàng?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: onLogout },
    ]);
  };

  const handleChangePassword = async () => {
    setSecurityError("");
    setSecuritySuccess("");
    if (newPassword.length < 8) return setSecurityError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (newPassword !== confirmPassword) return setSecurityError("Hai mật khẩu mới chưa khớp.");
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecuritySuccess("Đã đổi mật khẩu. Các phiên đăng nhập cũ đã được đóng.");
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : "Không thể đổi mật khẩu.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.headerRow}>
          <Text style={styles.storeName}>
            {restaurant?.name || "Nhà hàng của bạn"}
          </Text>
          <Badge status={isOpen ? "open" : "closed"} />
        </View>

        <Text style={styles.storeAddress}>
          📍 {restaurant?.address || "Chưa cập nhật địa chỉ"}
        </Text>

        {restaurant?.phone ? (
          <Text style={styles.metaText}>📞 SĐT: {restaurant.phone}</Text>
        ) : null}

        {restaurant?.email ? (
          <Text style={styles.metaText}>✉️ Email: {restaurant.email}</Text>
        ) : null}

        {restaurant?.description ? (
          <Text style={styles.descText}>{restaurant.description}</Text>
        ) : null}

        <View style={styles.profileActionRow}>
          <Button
            label="✏️ Chỉnh sửa thông tin quán"
            variant="outline"
            style={styles.editBtn}
            onPress={handleOpenEdit}
          />
        </View>
      </View>

      {/* System info */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Bảo mật tài khoản</Text>
        <Text style={styles.sectionHint}>Đổi mật khẩu đăng nhập của chủ nhà hàng.</Text>
        <Button label="Đổi mật khẩu" variant="outline" onPress={() => { setSecurityError(""); setSecuritySuccess(""); setSecurityModalVisible(true); }} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Hệ thống vận hành</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phiên bản App</Text>
          <Text style={styles.infoValue}>Restaurant Mobile v2.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tích hợp Drone</Text>
          <Text style={styles.infoValue}>Autonomous Drone Fleet API v2</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Kênh kết nối</Text>
          <Text style={styles.infoValue}>Socket.io Real-time Connected</Text>
        </View>
      </View>

      <Button
        label="Đăng xuất tài khoản quán"
        variant="outline"
        onPress={handleConfirmLogout}
      />

      {/* Edit Restaurant Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sửa thông tin nhà hàng</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGap}>
                <Input
                  label="Tên nhà hàng *"
                  placeholder="Nhập tên nhà hàng"
                  value={name}
                  onChangeText={setName}
                />
                <Input
                  label="Địa chỉ quán"
                  placeholder="Số nhà, tên đường, phường/xã..."
                  value={address}
                  onChangeText={setAddress}
                />
                <Input
                  label="Số điện thoại liên hệ"
                  placeholder="Ví dụ: 0987654321"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
                <Input
                  label="Email liên hệ"
                  placeholder="contact@nhahang.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <Input
                  label="Mô tả / Giới thiệu quán"
                  placeholder="Giới thiệu phong cách ẩm thực, đặc sản của quán..."
                  multiline
                  numberOfLines={3}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <Button
                label="Lưu thay đổi"
                variant="primary"
                loading={working}
                onPress={handleSaveProfile}
              />
              <Button
                label="Hủy"
                variant="outline"
                disabled={working}
                onPress={() => setEditModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={securityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSecurityModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            <Input label="Mật khẩu hiện tại" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
            <Input label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="Ít nhất 8 ký tự; có thể dán từ trình quản lý mật khẩu." />
            <Input label="Xác nhận mật khẩu mới" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            {securityError ? <Text accessibilityRole="alert" style={styles.errorText}>{securityError}</Text> : null}
            {securitySuccess ? <Text accessibilityRole="alert" style={styles.successText}>{securitySuccess}</Text> : null}
            <View style={styles.modalButtons}>
              <Button label="Đổi mật khẩu" loading={working} disabled={!currentPassword || !newPassword || !confirmPassword} onPress={handleChangePassword} />
              <Button label="Đóng" variant="outline" disabled={working} onPress={() => setSecurityModalVisible(false)} />
            </View>
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
  profileCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  storeName: {
    ...typography.title2,
    color: colors.textPrimary,
    flex: 1,
  },
  storeAddress: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  descText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.xxs,
  },
  sectionCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xxs,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  profileActionRow: {
    marginTop: spacing.xs,
  },
  editBtn: {
    minHeight: 38,
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
  formGap: {
    gap: spacing.sm,
  },
  modalButtons: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 19,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
    lineHeight: 19,
  },
});
