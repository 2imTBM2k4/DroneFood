import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { ModalContainer } from "../common/ModalContainer";
import { OptionGroupEditor } from "./OptionGroupEditor";
import type { DraftFood } from "../../types";

interface FoodEditorModalProps {
  draft: DraftFood | null;
  working: boolean;
  onClose: () => void;
  onChange: (draft: DraftFood) => void;
  onSave: () => Promise<void>;
}

export const FoodEditorModal: React.FC<FoodEditorModalProps> = ({
  draft,
  working,
  onClose,
  onChange,
  onSave,
}) => {
  if (!draft) return null;

  const imageUri = draft.image?.uri || draft.existingImage;

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert("Vui lòng cấp quyền truy cập thư viện ảnh để đăng món.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      onChange({ ...draft, image: res.assets[0] });
    }
  };

  return (
    <ModalContainer
      visible={Boolean(draft)}
      onClose={onClose}
      title={draft.id ? "Chỉnh sửa món ăn" : "Thêm món ăn mới"}
      subtitle="Cập nhật hình ảnh, giá bán và các nhóm tùy chọn Topping"
    >
      <View style={styles.form}>
        {/* Image Preview & Pick */}
        <View style={styles.imageSection}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.foodImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageIcon}>📷</Text>
              <Text style={styles.noImageText}>Chưa có ảnh món ăn</Text>
            </View>
          )}
          <Button
            label={imageUri ? "Đổi ảnh món khác" : "Chọn ảnh từ thư viện"}
            variant="secondary"
            style={styles.pickBtn}
            onPress={handlePickImage}
          />
        </View>

        <Input
          label="Tên món ăn *"
          placeholder="Ví dụ: Trà Sữa Oolong Nướng Trân Châu"
          value={draft.name}
          onChangeText={(val) => onChange({ ...draft, name: val })}
        />

        <Input
          label="Mô tả món ăn *"
          placeholder="Mô tả hương vị, nguyên liệu..."
          value={draft.description}
          onChangeText={(val) => onChange({ ...draft, description: val })}
          multiline
        />

        <View style={styles.row}>
          <Input
            containerStyle={styles.halfCol}
            label="Danh mục *"
            placeholder="Ví dụ: Trà sữa"
            value={draft.category}
            onChangeText={(val) => onChange({ ...draft, category: val })}
          />
          <Input
            containerStyle={styles.halfCol}
            label="Giá bán (VND) *"
            placeholder="Ví dụ: 45000"
            keyboardType="numeric"
            value={draft.price}
            onChangeText={(val) => onChange({ ...draft, price: val })}
          />
        </View>

        {/* Option Groups (Topping & Size) Editor */}
        <OptionGroupEditor
          groups={draft.optionGroups || []}
          onChange={(groups) => onChange({ ...draft, optionGroups: groups })}
        />

        <View style={styles.btnRow}>
          <Button
            label={draft.id ? "Lưu thay đổi món" : "Đăng món mới"}
            variant="primary"
            loading={working}
            onPress={onSave}
          />
          <Button
            label="Hủy bỏ"
            variant="outline"
            disabled={working}
            onPress={onClose}
          />
        </View>
      </View>
    </ModalContainer>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  imageSection: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  foodImage: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  noImage: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  noImageIcon: {
    fontSize: 32,
  },
  noImageText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pickBtn: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  halfCol: {
    flex: 1,
  },
  btnRow: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
