import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { reviewApi } from "../../api/client";
import type { Order, ReviewFlow } from "../../types";

interface OrderReviewModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onReviewCompleted: (orderId: string, updatedFlow: ReviewFlow) => void;
}

const RATING_LABELS = [
  "",
  "Rất không hài lòng",
  "Chưa hài lòng",
  "Bình thường",
  "Hài lòng / Ngon",
  "Tuyệt vời!",
];

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  visible,
  order,
  onClose,
  onReviewCompleted,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [flow, setFlow] = useState<ReviewFlow | undefined>(order?.reviewFlow);

  useEffect(() => {
    if (order?.reviewFlow) {
      setFlow(order.reviewFlow);
    }
  }, [order?.reviewFlow]);

  useEffect(() => {
    if (!visible) {
      setSelectedRating(0);
      setComment("");
    }
  }, [visible]);

  if (!order || !flow || !flow.nextTarget) {
    return null;
  }

  const nextTarget = flow.nextTarget;
  const isShipper = nextTarget.targetType === "shipper";
  const validTargets = flow.targets.filter((t) => t.status !== "not_applicable");
  const totalSteps = validTargets.length || 1;
  const currentStep =
    validTargets.findIndex(
      (t) =>
        t.targetId === nextTarget.targetId && t.targetType === nextTarget.targetType
    ) + 1 || 1;

  const submit = async (outcome: "rated" | "skipped") => {
    if (outcome === "rated" && selectedRating === 0) {
      Alert.alert("Vui lòng chọn số sao", "Hãy chọn từ 1 đến 5 sao trước khi gửi đánh giá.");
      return;
    }

    setSaving(true);
    try {
      const response = await reviewApi.submitDecision(
        order._id,
        nextTarget.targetType,
        nextTarget.targetId,
        {
          outcome,
          ...(outcome === "rated" && { rating: selectedRating }),
          ...(outcome === "rated" && !isShipper && { comment: comment.trim() }),
        }
      );

      const nextFlow = response.data.reviewFlow;
      setFlow(nextFlow);
      setSelectedRating(0);
      setComment("");
      onReviewCompleted(order._id, nextFlow);

      if (nextFlow.complete || !nextFlow.nextTarget) {
        Alert.alert(
          "Cảm ơn bạn!",
          outcome === "rated"
            ? "Đánh giá của bạn đã được ghi nhận thành công."
            : "Bạn đã bỏ qua bước đánh giá này."
        );
        onClose();
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || "Không thể lưu đánh giá lúc này.";
      Alert.alert("Lỗi", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable
          style={styles.dismissOverlay}
          onPress={() => {
            if (!saving) onClose();
          }}
        />

        <View style={styles.card}>
          {/* Header Step & Close */}
          <View style={styles.headerRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                Bước {currentStep}/{totalSteps}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              disabled={saving}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* Target Avatar / Icon */}
            <View style={styles.targetIconCircle}>
              <Text style={styles.targetEmoji}>{isShipper ? "🛵" : "🍲"}</Text>
            </View>

            {/* Title & Help */}
            <Text style={styles.title}>
              {isShipper
                ? `Bạn đánh giá tài xế ${nextTarget.name || "giao hàng"} thế nào?`
                : `Bạn đánh giá món "${nextTarget.name}" thế nào?`}
            </Text>
            <Text style={styles.helpText}>
              Đánh giá của bạn giúp cải thiện chất lượng phục vụ cho những đơn hàng sau.
            </Text>

            {/* Stars Selector */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= selectedRating;
                return (
                  <Pressable
                    key={star}
                    disabled={saving}
                    onPress={() => setSelectedRating(star)}
                    style={styles.starTouch}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.starChar,
                        isFilled ? styles.starFilled : styles.starEmpty,
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Rating Label Text */}
            <Text style={styles.ratingDescriptor}>
              {selectedRating > 0
                ? RATING_LABELS[selectedRating]
                : "Chạm vào sao để đánh giá"}
            </Text>

            {/* Optional Comment for Food */}
            {!isShipper && (
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Nhận xét về món ăn (tùy chọn)</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  placeholder="Chia sẻ hương vị, độ tươi ngon, đóng gói..."
                  placeholderTextColor={colors.textMuted}
                  value={comment}
                  onChangeText={setComment}
                  editable={!saving}
                />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.skipBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={() => submit("skipped")}
              >
                <Text style={styles.skipBtnText}>Bỏ qua</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitBtn,
                  (selectedRating === 0 || saving) && styles.btnDisabled,
                ]}
                disabled={selectedRating === 0 || saving}
                onPress={() => submit("rated")}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Gửi đánh giá</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  stepBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: "600",
  },
  scrollBody: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  targetIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  targetEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  helpText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  starRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  starTouch: {
    padding: 4,
  },
  starChar: {
    fontSize: 40,
  },
  starFilled: {
    color: "#F59E0B",
  },
  starEmpty: {
    color: "#E2E8F0",
  },
  ratingDescriptor: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D97706",
    minHeight: 22,
    marginBottom: spacing.md,
  },
  commentSection: {
    width: "100%",
    marginBottom: spacing.lg,
  },
  commentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 74,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  skipBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.canvas,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
