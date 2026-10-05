import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";

export interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionText,
  onActionPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Text>
      {actionText && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionText}
          hitSlop={10}
          onPress={onActionPress}
        >
          <Text style={styles.actionText}>{actionText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.textPrimary,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
});
