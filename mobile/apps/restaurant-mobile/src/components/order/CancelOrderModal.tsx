import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import type { Order } from "../../types";

interface CancelOrderModalProps {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (order: Order, reason: string) => Promise<void>;
  working: boolean;
}

const PRESET_REASONS = [
  "Quán đã hết nguyên liệu món này",
  "Quán đang quá tải, không kịp chuẩn bị",
  "Quán chuẩn bị đóng cửa",
  "Không liên lạc được với khách hàng",
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  visible,
  onClose,
  onConfirm,
  working,
}) => {
  const [reason, setReason] = useState("");

  if (!order) return null;

  const handleSelectPreset = (preset: string) => {
    setReason(preset);
  };

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await onConfirm(order, reason.trim());
    setReason("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>
            Từ chối đơn #{order._id.slice(-6).toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>
            Chọn hoặc nhập lý do để thông báo rõ cho khách hàng:
          </Text>

          <View style={styles.presetList}>
            {PRESET_REASONS.map((preset) => {
              const isSelected = reason === preset;
              return (
                <Pressable
                  key={preset}
                  style={[
                    styles.presetItem,
                    isSelected && styles.presetItemSelected,
                  ]}
                  onPress={() => handleSelectPreset(preset)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      isSelected && styles.presetTextSelected,
                    ]}
                  >
                    • {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Lý do cụ thể khác:"
            placeholder="Ví dụ: Nồi nước dùng cần 30 phút nấu lại..."
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <Button
            label="Xác nhận từ chối đơn"
            variant="danger"
            disabled={!reason.trim() || working}
            loading={working}
            onPress={handleConfirm}
          />
          <Button
            label="Quay lại"
            variant="outline"
            disabled={working}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  presetList: {
    gap: spacing.xs,
    marginVertical: spacing.xxs,
  },
  presetItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  presetItemSelected: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  presetText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  presetTextSelected: {
    color: colors.danger,
    fontWeight: "700",
  },
});
