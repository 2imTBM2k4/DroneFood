import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../common/Button";
import { Icon, type IconName } from "../common/Icon";
import { AddressEditorModal } from "./AddressEditorModal";
import type { AddressBookEntry, AddressBookInput, UserProfile } from "../../types";

interface AddressBookModalProps {
  visible: boolean;
  onClose: () => void;
  entries: AddressBookEntry[];
  selectedId?: string | null;
  onSelectAddress?: (entry: AddressBookEntry) => void;
  onSaveEntry: (entry: AddressBookInput, editId?: string) => Promise<void>;
  onSetDefault?: (id: string) => Promise<void>;
  onDeleteEntry?: (id: string) => Promise<void>;
  onUseGpsCurrent?: () => void;
  mode?: "manage" | "select";
  userProfile?: UserProfile | null;
  loading?: boolean;
}

const MAX_ADDRESSES = 5;

export const AddressBookModal: React.FC<AddressBookModalProps> = ({
  visible,
  onClose,
  entries,
  selectedId,
  onSelectAddress,
  onSaveEntry,
  onSetDefault,
  onDeleteEntry,
  onUseGpsCurrent,
  mode = "select",
  userProfile,
  loading = false,
}) => {
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AddressBookEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const handleStartNew = () => {
    if (entries.length >= MAX_ADDRESSES) {
      Alert.alert(
        "Đã đạt giới hạn",
        `Bạn chỉ có thể lưu tối đa ${MAX_ADDRESSES} địa chỉ nhận hàng trong sổ địa chỉ.`
      );
      return;
    }
    setEditingEntry(null);
    setEditorVisible(true);
  };

  const handleEdit = (entry: AddressBookEntry) => {
    setEditingEntry(entry);
    setEditorVisible(true);
  };

  const handleSaveModal = async (input: AddressBookInput, editId?: string) => {
    try {
      setSaving(true);
      await onSaveEntry(input, editId);
      setEditorVisible(false);
      setEditingEntry(null);
      Alert.alert(
        "Thành công",
        editId ? "Đã cập nhật thông tin địa chỉ." : "Đã thêm địa chỉ mới vào sổ địa chỉ."
      );
    } catch (err: any) {
      Alert.alert("Lỗi lưu địa chỉ", err?.message || "Không thể lưu địa chỉ.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = (entry: AddressBookEntry) => {
    if (entry.isDefault) {
      Alert.alert(
        "Không thể xóa",
        "Không thể xóa địa chỉ mặc định. Vui lòng đặt một địa chỉ khác làm mặc định trước khi xóa."
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
              if (onDeleteEntry) {
                await onDeleteEntry(entry.id || entry._id || "");
                Alert.alert("Đã xóa", "Đã xóa địa chỉ thành công.");
              }
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể xóa địa chỉ.");
            }
          },
        },
      ]
    );
  };

  const handleConfirmSetDefault = async (entry: AddressBookEntry) => {
    try {
      if (onSetDefault) {
        await onSetDefault(entry.id || entry._id || "");
        Alert.alert("Thành công", `Đã đặt "${entry.label}" làm địa chỉ mặc định.`);
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể đặt làm địa chỉ mặc định.");
    }
  };

  const getLabelIcon = (label: string): IconName => {
    const l = label.toLowerCase();
    if (l.includes("nhà")) return "home";
    if (l.includes("công ty") || l.includes("văn phòng") || l.includes("work")) return "store";
    return "map-pin";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {editorVisible ? (
        <AddressEditorModal
          embedded
          visible
          onClose={() => setEditorVisible(false)}
          onSave={handleSaveModal}
          initialEntry={editingEntry}
          userProfile={userProfile}
          saving={saving}
        />
      ) : (
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>
                {mode === "select" ? "Chọn địa chỉ giao hàng" : "Sổ địa chỉ của bạn"}
              </Text>
              <Text style={styles.headerSub}>
                {entries.length}/{MAX_ADDRESSES} địa chỉ đã lưu
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              style={styles.closeBtn}
              onPress={onClose}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Quick GPS Option if provided */}
            {onUseGpsCurrent && (
              <Pressable
                style={styles.gpsOptionCard}
                onPress={() => {
                  onUseGpsCurrent();
                  onClose();
                }}
              >
                <View style={styles.gpsOptionIcon}>
                  <Icon name="crosshair" size={20} color={colors.primary} />
                </View>
                <View style={styles.gpsOptionContent}>
                  <Text style={styles.gpsOptionTitle}>Định vị GPS vị trí hiện tại</Text>
                  <Text style={styles.gpsOptionSub}>
                    DroneFood sẽ lấy tọa độ tức thì từ thiết bị của bạn
                  </Text>
                </View>
                <Text style={styles.selectArrow}>→</Text>
              </Pressable>
            )}

            {/* List of Saved Addresses */}
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}><Icon name="map-pin" size={40} color={colors.primary} /></View>
                <Text style={styles.emptyTitle}>Chưa có địa chỉ nào trong sổ</Text>
                <Text style={styles.emptyText}>
                  Lưu sẵn địa chỉ nhà riêng, công ty để đặt món bằng Drone chỉ với 1 chạm!
                </Text>
              </View>
            ) : (
              entries.map((entry) => {
                const entryId = entry.id || entry._id;
                const isSelected = selectedId === entryId;
                return (
                  <Pressable
                    key={entryId}
                    style={[
                      styles.addressCard,
                      isSelected && styles.addressCardSelected,
                      entry.isDefault && styles.addressCardDefault,
                    ]}
                    onPress={() => {
                      if (onSelectAddress) {
                        onSelectAddress(entry);
                        onClose();
                      }
                    }}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardLabelRow}>
                        <Icon name={getLabelIcon(entry.label)} size={17} color={colors.textSecondary} />
                        <Text style={styles.cardLabelText}>{entry.label}</Text>
                        {entry.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Mặc định</Text>
                          </View>
                        ) : null}
                      </View>

                      {mode === "select" && (
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleActive,
                          ]}
                        >
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      )}
                    </View>

                    <Text style={styles.recipientText}>
                      {entry.recipient || entry.fullName || userProfile?.name || "Người nhận"} •{" "}
                      {entry.phone}
                    </Text>

                    <Text style={styles.addressFullText}>
                      {entry.address}, {entry.state}, {entry.city}
                    </Text>

                    {Number.isFinite(entry.lat) && Number.isFinite(entry.lng) ? (
                      <View style={styles.coordsRow}><Icon name="drone" size={15} color={colors.primary} /><Text style={styles.coordsText}>Tọa độ Drone: {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}</Text></View>
                    ) : null}

                    {/* Actions Bar */}
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => handleEdit(entry)}
                      >
                        <Text style={styles.actionBtnText}>Sửa</Text>
                      </Pressable>

                      {!entry.isDefault && onSetDefault && (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => handleConfirmSetDefault(entry)}
                        >
                          <Text style={styles.actionBtnText}>Đặt mặc định</Text>
                        </Pressable>
                      )}

                      {!entry.isDefault && onDeleteEntry && (
                        <Pressable
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => handleConfirmDelete(entry)}
                        >
                          <View style={styles.deleteAction}><Icon name="trash" size={14} color={colors.accent} /><Text style={styles.deleteBtnText}>Xóa</Text></View>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Add New Address Button */}
            {entries.length < MAX_ADDRESSES && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm địa chỉ mới"
                style={styles.addNewCardBtn}
                onPress={handleStartNew}
              >
                <Text style={styles.addNewIcon}>＋</Text>
                <Text style={styles.addNewText}>Thêm địa chỉ giao hàng mới</Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Bottom Action */}
          <View style={styles.footerBtn}>
            <Button label="Đóng" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
      )}
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
    maxHeight: "85%",
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
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  headerTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingTop: spacing.xs,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  gpsOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  gpsOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsOptionContent: {
    flex: 1,
  },
  gpsOptionTitle: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
  gpsOptionSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectArrow: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "800",
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: "center",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
  },
  addressCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  addressCardDefault: {
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  cardLabelIcon: {
    fontSize: 18,
  },
  cardLabelText: {
    ...typography.title2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  defaultBadgeText: {
    ...typography.captionBold,
    color: "#B45309",
    fontSize: 11,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  recipientText: {
    ...typography.subhead,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  addressFullText: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  coordsText: {
    ...typography.caption,
    color: colors.droneBlue,
    marginTop: 2,
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderHairline,
  },
  actionBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  actionBtnText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  deleteBtn: {
    marginLeft: "auto",
  },
  deleteBtnText: {
    ...typography.captionBold,
    color: "#EF4444",
  },
  deleteAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addNewCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.surfaceCard,
    marginTop: spacing.xxs,
  },
  addNewIcon: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: "700",
  },
  addNewText: {
    ...typography.subhead,
    color: colors.primary,
    fontWeight: "700",
  },
  footerBtn: {
    paddingTop: spacing.xs,
  },
});
