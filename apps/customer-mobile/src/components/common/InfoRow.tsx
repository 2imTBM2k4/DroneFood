import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";

export interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  isTotal?: boolean;
  isHighlight?: boolean;
  subValue?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
  hasDivider?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  isTotal = false,
  isHighlight = false,
  subValue,
  style,
  labelStyle,
  valueStyle,
  hasDivider = false,
}) => {
  return (
    <View style={[styles.wrapper, hasDivider && styles.divider, style]}>
      <View style={styles.row}>
        <Text
          style={[
            styles.label,
            isTotal && styles.totalLabel,
            labelStyle,
          ]}
        >
          {label}
        </Text>
        <View style={styles.valueContainer}>
          {typeof value === "string" ? (
            <Text
              style={[
                styles.value,
                isTotal && styles.totalValue,
                isHighlight && styles.highlightValue,
                valueStyle,
              ]}
            >
              {value}
            </Text>
          ) : (
            value
          )}
          {subValue ? (
            <Text style={styles.subValue}>{subValue}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: spacing.xs,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalLabel: {
    ...typography.sectionTitle,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  valueContainer: {
    alignItems: "flex-end",
  },
  value: {
    ...typography.body,
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  totalValue: {
    ...typography.sectionTitle,
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  highlightValue: {
    color: colors.primary,
    fontWeight: "700",
  },
  subValue: {
    ...typography.micro,
    color: colors.textMuted,
    marginTop: 2,
  },
});
