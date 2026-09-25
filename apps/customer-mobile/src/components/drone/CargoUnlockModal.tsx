import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import { ModalContainer } from "../common/ModalContainer";
import type { Order } from "../../types";

interface CargoUnlockModalProps {
  order: Order | null;
  visible: boolean;
  onClose: () => void;
  onOpenCargo: (order: Order) => Promise<void>;
  onConfirmDelivery: (order: Order) => Promise<void>;
  loading?: boolean;
}

export const CargoUnlockModal: React.FC<CargoUnlockModalProps> = ({
  order,
  visible,
  onClose,
  onOpenCargo,
  onConfirmDelivery,
  loading = false,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => (c !== null ? c - 1 : null));
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!order || order.orderStatus === "delivered") return null;

  const handleOpenCargo = async () => {
    setCountdown(5);
    await onOpenCargo(order);
  };

  const handleConfirmReceived = async () => {
    await onConfirmDelivery(order);
    onClose();
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title="Mở Khoang Hàng Drone"
      subtitle={`Đơn hàng #${order._id.slice(-6).toUpperCase()}`}
    >
      <View style={styles.container}>
        <View style={styles.qrCard}>
          {order.qrCode ? (
            <QRCode
              value={order.qrCode}
              size={180}
              color={colors.textPrimary}
              backgroundColor="#FFFFFF"
            />
          ) : (
            <View style={styles.noQr}>
              <Text style={styles.noQrText}>Đang tạo mã bảo mật...</Text>
            </View>
          )}
          <Text style={styles.qrHint}>
            Đưa mã này trước camera Drone hoặc bấm nút mở tự động bên dưới
          </Text>
        </View>

        {countdown !== null ? (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownTitle}>KHOANG HÀNG ĐANG MỞ</Text>
            <Text style={styles.countdownNumber}>{countdown}s</Text>
            <Text style={styles.countdownSub}>
              Vui lòng lấy món ăn ra khỏi khoang trước khi nắp tự động đóng lại!
            </Text>
          </View>
        ) : (
          <Button
            label="Mở nắp khoang hàng (5 giây)"
            icon={<Icon name="package" size={17} color={colors.textWhite} />}
            variant="primary"
            loading={loading}
            onPress={handleOpenCargo}
          />
        )}

        <Button
          label="Xác nhận đã nhận đủ hàng"
          icon={<Icon name="check" size={17} color={colors.primary} />}
          variant="secondary"
          loading={loading}
          onPress={handleConfirmReceived}
        />
      </View>
    </ModalContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  qrCard: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
    width: "100%",
  },
  noQr: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
  },
  noQrText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  qrHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  countdownBox: {
    width: "100%",
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  countdownTitle: {
    ...typography.captionBold,
    color: colors.primary,
    letterSpacing: 1,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.primary,
  },
  countdownSub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
