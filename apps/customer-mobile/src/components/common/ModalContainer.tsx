import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { GlassSurface } from "./GlassSurface";
import { Icon } from "./Icon";

interface ModalContainerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export const ModalContainer: React.FC<ModalContainerProps> = ({ visible, onClose, title, subtitle, children, contentStyle }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Đóng" style={styles.dismissArea} onPress={onClose} />
      <GlassSurface style={styles.sheetShell} radiusValue={radius.sheet} intensity={72} tone="strong" elevated>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={8} style={styles.closeButton} onPress={onClose}>
                <Icon name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </GlassSurface>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end", padding: spacing.sm },
  dismissArea: { flex: 1 },
  sheetShell: { maxHeight: "88%" },
  sheet: { maxHeight: "100%", paddingBottom: spacing.xl },
  grabber: { width: 42, height: 5, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: "center", marginTop: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  titleContainer: { flex: 1 },
  title: { ...typography.title2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeButton: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle, alignItems: "center", justifyContent: "center", marginLeft: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
});
