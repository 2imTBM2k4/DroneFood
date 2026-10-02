import React from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Tìm kiếm...",
  onClear,
  onSubmitEditing,
  style,
  accessibilityLabel = "Ô tìm kiếm",
  autoFocus = false,
}) => {
  const handleClear = () => {
    onChangeText("");
    onClear?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrapper}>
        <Icon name="search" size={18} color={colors.textSecondary} />
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        accessibilityRole="search"
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa nội dung tìm kiếm"
          hitSlop={12}
          onPress={handleClear}
          style={styles.clearButton}
        >
          <Icon name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSubtle, // #EFEFEF
    borderRadius: radius.pill,
    height: 44, // 44pt touch minimum
    paddingHorizontal: spacing.sm,
    width: "100%",
  },
  iconWrapper: {
    marginLeft: spacing.xxs,
    marginRight: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0, // Avoid vertical offset on Android
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.xxs,
  },
});
