import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../common/Button";
import { ModalContainer } from "../common/ModalContainer";
import { useToast } from "../common/ToastProvider";
import type { Food, OptionGroup } from "../../types";

interface OptionGroupModalProps {
  food: Food | null;
  onClose: () => void;
  onAddToCart: (
    food: Food,
    quantity: number,
    selectedOptions: { groupName: string; optionName: string }[]
  ) => Promise<void>;
  loading?: boolean;
  initial?: {
    quantity: number;
    selectedOptions: { groupName: string; optionName: string }[];
  };
  submitLabel?: string;
}

export const OptionGroupModal: React.FC<OptionGroupModalProps> = ({
  food,
  onClose,
  onAddToCart,
  loading = false,
  initial: initialValue,
  submitLabel,
}) => {
  const { showToast } = useToast();
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  // Initialize picks whenever food changes
  React.useEffect(() => {
    if (!food) {
      setPicks({});
      setQuantity(1);
      return;
    }
    const initial: Record<string, string[]> = {};
    (food.optionGroups || []).forEach((group) => {
      const existing = (initialValue?.selectedOptions || [])
        .filter((option) => option.groupName === group.name)
        .map((option) => option.optionName);
      // If group is required and single, pick the first one by default
      if (existing.length > 0) {
        initial[group.name] = existing;
      } else if (group.required && group.type === "single" && group.options.length > 0) {
        initial[group.name] = [group.options[0].name];
      } else {
        initial[group.name] = [];
      }
    });
    setPicks(initial);
    setQuantity(initialValue?.quantity || 1);
  }, [food, initialValue]);

  const toggleOption = (group: OptionGroup, optionName: string) => {
    const current = picks[group.name] || [];
    if (
      group.type !== "single"
      && !current.includes(optionName)
      && group.max
      && current.length >= group.max
    ) {
      showToast({
        type: "warning",
        title: "Giới hạn lựa chọn",
        message: `Nhóm ${group.name} chỉ được chọn tối đa ${group.max} mục.`,
      });
      return;
    }

    setPicks((prev) => {
      const current = prev[group.name] || [];
      if (group.type === "single") {
        return {
          ...prev,
          [group.name]: current[0] === optionName && !group.required ? [] : [optionName],
        };
      }
      if (current.includes(optionName)) {
        return {
          ...prev,
          [group.name]: current.filter((n) => n !== optionName),
        };
      }
      return {
        ...prev,
        [group.name]: [...current, optionName],
      };
    });
  };

  const unitPrice = useMemo(() => {
    if (!food) return 0;
    let total = food.price;
    (food.optionGroups || []).forEach((group) => {
      const selected = picks[group.name] || [];
      group.options.forEach((opt) => {
        if (selected.includes(opt.name)) {
          total += opt.priceDelta || 0;
        }
      });
    });
    return total;
  }, [food, picks]);

  const handleAdd = async () => {
    if (!food) return;

    // Validate required groups
    for (const group of food.optionGroups || []) {
      const selected = picks[group.name] || [];
      const minRequired = group.required ? Math.max(group.min || 1, 1) : group.min || 0;
      if (selected.length < minRequired) {
        showToast({
          type: "warning",
          title: "Chưa đủ lựa chọn",
          message: `Vui lòng chọn ít nhất ${minRequired} mục ở nhóm "${group.name}".`,
        });
        return;
      }
    }

    const selectedOptions: { groupName: string; optionName: string }[] = [];
    Object.entries(picks).forEach(([groupName, names]) => {
      names.forEach((optionName) => {
        selectedOptions.push({ groupName, optionName });
      });
    });

    await onAddToCart(food, quantity, selectedOptions);
  };

  if (!food) return null;

  return (
    <ModalContainer
      visible={Boolean(food)}
      onClose={onClose}
      title={food.name}
      subtitle={food.description}
      footer={(
        <View style={styles.modalFooterContent}>
          <View style={styles.quantitySection}>
            <Text style={styles.quantityLabel}>Số lượng</Text>
            <View style={styles.quantityControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Giảm số lượng"
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                disabled={quantity <= 1}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tăng số lượng"
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Button
            label={submitLabel || `Thêm vào giỏ hàng • ${formatVnd(unitPrice * quantity)}`}
            loading={loading}
            onPress={handleAdd}
            size="md"
            fullWidth
            style={styles.submitBtn}
          />
        </View>
      )}
    >
      {food.image ? (
        <Image
          source={{ uri: food.image }}
          style={styles.modalHeroImage}
          resizeMode="cover"
        />
      ) : null}

      {(food.optionGroups || []).map((group) => {
        const selected = picks[group.name] || [];
        return (
          <View key={group.name} style={styles.groupContainer}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group.name}</Text>
              <Text style={styles.groupSubtitle}>
                {group.required ? "Bắt buộc · " : "Tùy chọn · "}
                {group.type === "single"
                  ? "Chọn 1"
                  : `Tối đa ${group.max || "không giới hạn"}`}
              </Text>
            </View>

            <View style={styles.optionsList}>
              {group.options.map((option) => {
                const isSelected = selected.includes(option.name);
                return (
                  <Pressable
                    key={option.name}
                    style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                    onPress={() => toggleOption(group, option.name)}
                  >
                    <View style={styles.optionLeft}>
                      <View
                        style={[
                          group.type === "single"
                            ? styles.radioCircle
                            : styles.checkboxSquare,
                          isSelected && styles.checkedIndicator,
                        ]}
                      >
                        {isSelected ? (
                          <View
                            style={
                              group.type === "single"
                                ? styles.radioInner
                                : styles.checkTick
                            }
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.optionName,
                          isSelected && styles.optionNameSelected,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </View>
                    <Text style={styles.priceDelta}>
                      {option.priceDelta && option.priceDelta > 0
                        ? `+${formatVnd(option.priceDelta)}`
                        : "0 ₫"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ModalContainer>
  );
};

const styles = StyleSheet.create({
  modalHeroImage: {
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.sm,
  },
  groupContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  groupSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  optionsList: {
    gap: spacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkTick: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  checkedIndicator: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  optionNameSelected: {
    fontWeight: "600",
    color: colors.primary,
  },
  priceDelta: {
    ...typography.subhead,
    color: colors.textSecondary,
  },
  quantitySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xxs,
  },
  quantityLabel: {
    ...typography.subheadBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  qtyText: {
    ...typography.subheadBold,
    fontSize: 16,
    minWidth: 24,
    textAlign: "center",
    color: colors.textPrimary,
  },
  modalFooterContent: {
    gap: spacing.xs,
  },
  submitBtn: {
    minHeight: 44,
    borderRadius: radius.pill,
  },
});
