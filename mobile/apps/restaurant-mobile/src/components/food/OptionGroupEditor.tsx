import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { formatVnd } from "../../api/client";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import type { OptionGroup } from "../../types";

interface OptionGroupEditorProps {
  groups: OptionGroup[];
  onChange: (groups: OptionGroup[]) => void;
}

export const OptionGroupEditor: React.FC<OptionGroupEditorProps> = ({
  groups,
  onChange,
}) => {
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"single" | "multi">("single");

  // New option input states
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [optionName, setOptionName] = useState("");
  const [priceDelta, setPriceDelta] = useState("");

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: OptionGroup = {
      name: newGroupName.trim(),
      type: newGroupType,
      required: newGroupType === "single",
      options: [],
    };
    onChange([...groups, newGroup]);
    setNewGroupName("");
  };

  const handleRemoveGroup = (index: number) => {
    const next = groups.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleAddOptionToGroup = (groupIndex: number) => {
    if (!optionName.trim()) return;
    const delta = Number(priceDelta) || 0;
    const next = [...groups];
    next[groupIndex].options.push({
      name: optionName.trim(),
      priceDelta: delta,
    });
    onChange(next);
    setOptionName("");
    setPriceDelta("");
    setActiveGroupIndex(null);
  };

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    const next = [...groups];
    next[groupIndex].options = next[groupIndex].options.filter(
      (_, i) => i !== optionIndex
    );
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Nhóm Tùy Chọn Món (Topping & Size)
      </Text>
      <Text style={styles.sectionHint}>
        Cấu hình các tùy chọn khách hàng có thể chọn khi đặt món (ví dụ: Size M/L, Topping trân châu).
      </Text>

      {/* Existing Groups */}
      {groups.map((group, groupIdx) => (
        <View key={`${group.name}-${groupIdx}`} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <View>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupMeta}>
                {group.type === "single" ? "Chọn 1 món (Single)" : "Chọn nhiều (Multi)"} •{" "}
                {group.required ? "Bắt buộc" : "Không bắt buộc"}
              </Text>
            </View>
            <Pressable
              style={styles.deleteGroupBtn}
              onPress={() => handleRemoveGroup(groupIdx)}
            >
              <Text style={styles.deleteGroupText}>✕ Xóa nhóm</Text>
            </Pressable>
          </View>

          {/* Options in this group */}
          <View style={styles.optionsList}>
            {group.options.map((opt, optIdx) => (
              <View
                key={`${opt.name}-${optIdx}`}
                style={styles.optionRow}
              >
                <Text style={styles.optText}>
                  • {opt.name} ({opt.priceDelta ? `+${formatVnd(opt.priceDelta)}` : "0 ₫"})
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => handleRemoveOption(groupIdx, optIdx)}
                >
                  <Text style={styles.removeOptText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Add Option to this Group */}
          {activeGroupIndex === groupIdx ? (
            <View style={styles.addOptionForm}>
              <Input
                placeholder="Tên lựa chọn (ví dụ: Size L, Trân châu đen)"
                value={optionName}
                onChangeText={setOptionName}
              />
              <Input
                placeholder="Giá phụ thu VND (ví dụ: 10000 hoặc 0)"
                keyboardType="numeric"
                value={priceDelta}
                onChangeText={setPriceDelta}
              />
              <View style={styles.inlineBtnRow}>
                <Button
                  label="Thêm vào nhóm"
                  style={styles.halfBtn}
                  onPress={() => handleAddOptionToGroup(groupIdx)}
                />
                <Button
                  label="Hủy"
                  variant="outline"
                  style={styles.halfBtn}
                  onPress={() => setActiveGroupIndex(null)}
                />
              </View>
            </View>
          ) : (
            <Button
              label="+ Thêm lựa chọn con vào nhóm này"
              variant="outline"
              style={styles.addOptBtn}
              onPress={() => {
                setActiveGroupIndex(groupIdx);
                setOptionName("");
                setPriceDelta("");
              }}
            />
          )}
        </View>
      ))}

      {/* Add New Group Box */}
      <View style={styles.newGroupBox}>
        <Text style={styles.newGroupTitle}>+ Thêm nhóm tùy chọn mới</Text>
        <Input
          placeholder="Tên nhóm (ví dụ: Chọn Size, Topping thêm...)"
          value={newGroupName}
          onChangeText={setNewGroupName}
        />
        <View style={styles.typeSelectorRow}>
          <Pressable
            style={[
              styles.typeBtn,
              newGroupType === "single" && styles.typeBtnActive,
            ]}
            onPress={() => setNewGroupType("single")}
          >
            <Text
              style={[
                styles.typeBtnText,
                newGroupType === "single" && styles.typeBtnTextActive,
              ]}
            >
              Chọn 1 (Radio)
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.typeBtn,
              newGroupType === "multi" && styles.typeBtnActive,
            ]}
            onPress={() => setNewGroupType("multi")}
          >
            <Text
              style={[
                styles.typeBtnText,
                newGroupType === "multi" && styles.typeBtnTextActive,
              ]}
            >
              Chọn nhiều (Checkbox)
            </Text>
          </Pressable>
        </View>
        <Button
          label="Tạo nhóm tùy chọn"
          variant="secondary"
          disabled={!newGroupName.trim()}
          onPress={handleAddGroup}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  groupName: {
    ...typography.subhead,
    color: colors.textPrimary,
  },
  groupMeta: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  deleteGroupBtn: {
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  deleteGroupText: {
    ...typography.micro,
    color: colors.danger,
    fontWeight: "700",
  },
  optionsList: {
    gap: spacing.xxs,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  removeOptText: {
    color: colors.danger,
    fontWeight: "700",
    paddingHorizontal: spacing.xs,
  },
  addOptionForm: {
    gap: spacing.xs,
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  halfBtn: {
    flex: 1,
    minHeight: 38,
  },
  addOptBtn: {
    minHeight: 36,
  },
  newGroupBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  newGroupTitle: {
    ...typography.captionBold,
    color: colors.primary,
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginVertical: spacing.xxs,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeBtnText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  typeBtnTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
});
