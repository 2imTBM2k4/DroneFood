import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "./Button";

export interface DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  loading = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Đóng"
          style={styles.dismissArea}
          onPress={onCancel}
        />
        <View style={styles.dialogBox}>
          <Text
            accessibilityRole="header"
            style={styles.title}
          >
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actionRow}>
            <View style={styles.buttonHalf}>
              <Button
                label={cancelLabel}
                variant="secondary"
                size="md"
                onPress={onCancel}
                disabled={loading}
              />
            </View>
            <View style={styles.buttonHalf}>
              <Button
                label={confirmLabel}
                variant={confirmVariant}
                size="md"
                onPress={onConfirm}
                loading={loading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  dismissArea: {
    ...StyleSheet.absoluteFill,
  },
  dialogBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg, // 20px
    padding: spacing.xl,
    zIndex: 1,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonHalf: {
    flex: 1,
  },
});
