import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";
import { Button } from "./Button";

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
  title?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Có lỗi xảy ra",
  message = "Không thể tải dữ liệu vào lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.",
  onRetry,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Icon name="close" size={32} color={colors.danger} />
      </View>
      <Text
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.actionWrapper}>
          <Button
            label="Thử lại"
            variant="secondary"
            size="md"
            onPress={onRetry}
            icon={<Icon name="refresh" size={16} color={colors.textPrimary} />}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.statusCancelledBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    ...typography.screenTitle,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: "center",
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 290,
  },
  actionWrapper: {
    marginTop: spacing.lg,
  },
});
