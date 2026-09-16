import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { userApi, apiError } from "../../api/client";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import type { AddressBookEntry, AddressBookInput, UserProfile } from "../../types";

interface AddressEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: AddressBookInput, editId?: string) => Promise<void>;
  initialEntry?: AddressBookEntry | null;
  userProfile?: UserProfile | null;
  saving?: boolean;
}

const PRESET_LABELS = [
  { id: "home", label: "Nhà riêng", icon: "🏠" },
  { id: "work", label: "Công ty", icon: "🏢" },
  { id: "other", label: "Khác", icon: "📍" },
];

export const AddressEditorModal: React.FC<AddressEditorModalProps> = ({
  visible,
  onClose,
  onSave,
  initialEntry,
  userProfile,
  saving = false,
}) => {
  const [selectedPreset, setSelectedPreset] = useState("home");
  const [customLabel, setCustomLabel] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Hồ Chí Minh");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Việt Nam");
  const [zipCode, setZipCode] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!visible) return;

    if (initialEntry) {
      // Editing mode
      const isPreset = PRESET_LABELS.find((p) => p.label === initialEntry.label);
      if (isPreset) {
        setSelectedPreset(isPreset.id);
        setCustomLabel("");
      } else {
        setSelectedPreset("other");
        setCustomLabel(initialEntry.label || "");
      }
      setRecipient(initialEntry.recipient || initialEntry.fullName || userProfile?.name || "");
      setPhone(initialEntry.phone || userProfile?.phone || "");
      setAddress(initialEntry.address || "");
      setCity(initialEntry.city || "Hồ Chí Minh");
      setState(initialEntry.state || "");
      setCountry(initialEntry.country || "Việt Nam");
      setZipCode(initialEntry.zipCode || "");
      setLat(initialEntry.lat);
      setLng(initialEntry.lng);
      setIsDefault(Boolean(initialEntry.isDefault));
    } else {
      // Create mode
      setSelectedPreset("home");
      setCustomLabel("");
      setRecipient(userProfile?.name || "");
      setPhone(userProfile?.phone || "");
      setAddress("");
      setCity("Hồ Chí Minh");
      setState("");
      setCountry("Việt Nam");
      setZipCode("");
      setLat(null);
      setLng(null);
      setIsDefault(false);
    }
  }, [visible, initialEntry, userProfile]);

  const handleUseGps = async () => {
    try {
      setLocating(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          "Cần quyền truy cập vị trí",
          "Vui lòng cấp quyền định vị trong cài đặt để lấy tọa độ giao hàng tự động."
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const curLat = pos.coords.latitude;
      const curLng = pos.coords.longitude;
      setLat(curLat);
      setLng(curLng);

      // Auto reverse-geocode to populate address details
      const geo = await userApi.reverseGeocode(curLat, curLng);
      if (geo) {
        if (geo.address && !address) setAddress(geo.address);
        if (geo.city) setCity(geo.city);
        if (geo.state) setState(geo.state);
      }
      Alert.alert("Định vị thành công", "Đã lấy tọa độ GPS chính xác cho địa chỉ này.");
    } catch (err) {
      Alert.alert("Lỗi định vị", apiError(err, "Không thể lấy vị trí GPS."));
    } finally {
      setLocating(false);
    }
  };

  const handleFindCoordinates = async () => {
    const full = [address, state, city, country].filter((s) => s.trim()).join(", ");
    if (full.length < 5) {
      Alert.alert("Thiếu địa chỉ", "Vui lòng nhập chi tiết số nhà và tên đường trước.");
      return;
    }
    try {
      setGeocoding(true);
      const res = await userApi.geocode(full);
      if (!res) {
        Alert.alert(
          "Không tìm thấy",
          "Không tìm được tọa độ cho địa chỉ này. Hãy thử bấm '🎯 Định vị GPS' khi bạn đang ở địa điểm nhận hàng."
        );
        return;
      }
      setLat(res.lat);
      setLng(res.lng);
      Alert.alert("Thành công", "Đã tìm thấy tọa độ GPS cho địa chỉ của bạn.");
    } catch (err) {
      Alert.alert("Lỗi", apiError(err, "Không thể tìm tọa độ cho địa chỉ này."));
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async () => {
    const label =
      selectedPreset === "other"
        ? customLabel.trim() || "Địa chỉ khác"
        : PRESET_LABELS.find((p) => p.id === selectedPreset)?.label || "Nhà riêng";

    if (!recipient.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên người nhận hàng.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập số điện thoại người nhận.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập số nhà, tên đường chi tiết.");
      return;
    }
    if (!city.trim() || !state.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập Tỉnh/Thành phố và Quận/Huyện.");
      return;
    }
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert(
        "Cần tọa độ GPS",
        "Để Drone và Shipper giao hàng chuẩn xác, vui lòng bấm '🎯 Định vị GPS' hoặc '🔍 Tìm tọa độ' trước khi lưu."
      );
      return;
    }

    const payload: AddressBookInput = {
      label,
      recipient: recipient.trim(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim() || "Việt Nam",
      zipCode: zipCode.trim(),
      lat,
      lng,
      isDefault,
    };

    await onSave(payload, initialEntry?.id || initialEntry?._id);
  };

  const hasCoords = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {initialEntry ? "Sửa địa chỉ giao hàng" : "Thêm địa chỉ nhận hàng"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              style={styles.closeBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Label Presets */}
            <Text style={styles.fieldLabel}>Tên gợi nhớ (Nhãn địa chỉ)</Text>
            <View style={styles.presetRow}>
              {PRESET_LABELS.map((p) => {
                const active = selectedPreset === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    onPress={() => setSelectedPreset(p.id)}
                  >
                    <Text style={styles.presetIcon}>{p.icon}</Text>
                    <Text
                      style={[
                        styles.presetText,
                        active && styles.presetTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedPreset === "other" && (
              <Input
                label="Nhãn tùy chỉnh"
                placeholder="Ví dụ: Nhà bạn bè, Ký túc xá..."
                value={customLabel}
                onChangeText={setCustomLabel}
              />
            )}

            {/* Recipient & Phone */}
            <Input
              label="Tên người nhận"
              placeholder="Nguyễn Văn A"
              value={recipient}
              onChangeText={setRecipient}
            />

            <Input
              label="Số điện thoại nhận hàng"
              placeholder="0912345678"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            {/* Detailed Address */}
            <Input
              label="Số nhà, tên đường, tòa nhà / tầng"
              placeholder="Số 123 Đường Lê Lợi, Phường Bến Nghé"
              value={address}
              onChangeText={setAddress}
            />

            <View style={styles.twoColRow}>
              <View style={styles.col}>
                <Input
                  label="Quận / Huyện"
                  placeholder="Quận 1"
                  value={state}
                  onChangeText={setState}
                />
              </View>
              <View style={styles.col}>
                <Input
                  label="Tỉnh / Thành phố"
                  placeholder="Hồ Chí Minh"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
            </View>

            {/* GPS & Geocode Tools */}
            <View style={styles.gpsBox}>
              <View style={styles.gpsHeader}>
                <Text style={styles.gpsTitle}>Tọa độ giao hàng Drone / Shipper</Text>
                {hasCoords ? (
                  <View style={styles.coordBadgeSuccess}>
                    <Text style={styles.coordBadgeSuccessText}>✓ Đã có tọa độ</Text>
                  </View>
                ) : (
                  <View style={styles.coordBadgeWarn}>
                    <Text style={styles.coordBadgeWarnText}>! Chưa có tọa độ</Text>
                  </View>
                )}
              </View>

              {hasCoords && (
                <Text style={styles.coordsDisplay}>
                  📍 Lat: {lat?.toFixed(5)} • Lng: {lng?.toFixed(5)}
                </Text>
              )}

              <View style={styles.gpsActions}>
                <Pressable
                  style={[styles.gpsActionBtn, locating && styles.btnDisabled]}
                  onPress={handleUseGps}
                  disabled={locating}
                >
                  <Text style={styles.gpsActionBtnText}>
                    {locating ? "⏳ Đang lấy GPS..." : "🎯 Định vị GPS hiện tại"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.geocodeActionBtn, geocoding && styles.btnDisabled]}
                  onPress={handleFindCoordinates}
                  disabled={geocoding}
                >
                  <Text style={styles.geocodeActionBtnText}>
                    {geocoding ? "⏳ Đang tìm..." : "🔍 Tìm tọa độ từ địa chỉ"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Default Switch */}
            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.switchTitle}>Đặt làm địa chỉ mặc định</Text>
                <Text style={styles.switchSub}>
                  Tự động ưu tiên chọn địa chỉ này khi đặt món
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Submit & Cancel Buttons */}
            <View style={styles.btnRow}>
              <Button
                label={saving ? "Đang lưu..." : initialEntry ? "Lưu thay đổi" : "Lưu vào sổ địa chỉ"}
                loading={saving}
                onPress={handleSubmit}
              />
              <Button
                label="Hủy"
                variant="outline"
                disabled={saving}
                onPress={onClose}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    maxHeight: "90%",
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  headerTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  scrollBody: {
    paddingTop: spacing.sm,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  fieldLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: -spacing.xs,
  },
  presetRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  presetChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
  },
  presetChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  presetIcon: {
    fontSize: 16,
  },
  presetText: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  presetTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  twoColRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  col: {
    flex: 1,
  },
  gpsBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  gpsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gpsTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  coordBadgeSuccess: {
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  coordBadgeSuccessText: {
    ...typography.captionBold,
    color: colors.statusDeliveredText,
    fontSize: 11,
  },
  coordBadgeWarn: {
    backgroundColor: colors.statusPendingBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  coordBadgeWarnText: {
    ...typography.captionBold,
    color: colors.statusPendingText,
    fontSize: 11,
  },
  coordsDisplay: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  gpsActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xxs,
  },
  gpsActionBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsActionBtnText: {
    ...typography.captionBold,
    color: "#fff",
  },
  geocodeActionBtn: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  geocodeActionBtnText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  switchTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  switchTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  switchSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  btnRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
