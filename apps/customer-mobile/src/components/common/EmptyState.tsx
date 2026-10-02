import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";

export interface EmptyStateProps {
  iconName?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName = "package",
  title,
  description,
  actionLabel,
  onActionPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        <Icon name={iconName} size={36} color={colors.primary} />
      </View>
      <Text
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {actionLabel && onActionPress ? (
        <View style={styles.actionWrapper}>
          <Button
            label={actionLabel}
            variant="primary"
            size="md"
            onPress={onActionPress}
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
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
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
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  actionWrapper: {
    marginTop: spacing.lg,
  },
});
