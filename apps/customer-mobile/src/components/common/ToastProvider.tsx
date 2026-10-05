import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, motion, radius, shadows, spacing, typography } from "../../theme/tokens";
import { Icon } from "./Icon";

export type ToastType = "info" | "success" | "warning" | "error";

interface ToastAction {
  label: string;
  onPress?: () => void | Promise<void>;
  destructive?: boolean;
}

interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  primaryAction?: ToastAction;
  secondaryAction?: ToastAction;
}

interface VisibleToast extends ToastOptions {
  id: number;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const titles: Record<ToastType, string> = {
  info: "Thông báo",
  success: "Thành công",
  warning: "Cần chú ý",
  error: "Đã xảy ra lỗi",
};

const accentColors: Record<ToastType, string> = {
  info: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.danger,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<VisibleToast | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-18)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    const hidingToastId = toastIdRef.current;
    clearTimer();
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast((current) => current?.id === hidingToastId ? null : current);
      }
    });
  }, [clearTimer, opacity, translateY]);

  const showToast = useCallback((options: ToastOptions) => {
    clearTimer();
    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(-18);
    setToast({
      ...options,
      id: ++toastIdRef.current,
      type: options.type || "info",
    });
  }, [clearTimer, opacity, translateY]);

  useEffect(() => {
    if (!toast) return;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const duration = toast.duration ?? (toast.primaryAction || toast.secondaryAction ? 6500 : 3500);
    if (duration > 0) timerRef.current = setTimeout(hideToast, duration);

    return clearTimer;
  }, [clearTimer, hideToast, opacity, toast, translateY]);

  const value = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);
  const accent = toast ? accentColors[toast.type] : colors.primary;

  const runAction = (action?: ToastAction) => {
    hideToast();
    if (action?.onPress) void action.onPress();
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.viewport}>
        <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
          {toast ? (
            <Animated.View
              key={toast.id}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={[styles.animatedToast, { opacity, transform: [{ translateY }] }]}
            >
              <View style={[styles.toastContent, shadows.floating]}>
                <View style={[styles.accent, { backgroundColor: accent }]} />
                <View style={styles.iconBadge}>
                  <Icon name={toast.type === "success" ? "check" : toast.type === "error" ? "close" : "sparkles"} size={18} color={accent} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{toast.title || titles[toast.type]}</Text>
                  <Text style={styles.message}>{toast.message}</Text>
                  {toast.primaryAction || toast.secondaryAction ? (
                    <View style={styles.actions}>
                      {toast.secondaryAction ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => runAction(toast.secondaryAction)}
                          style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.pressed]}
                        >
                          <Text style={styles.secondaryActionText}>{toast.secondaryAction.label}</Text>
                        </Pressable>
                      ) : null}
                      {toast.primaryAction ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => runAction(toast.primaryAction)}
                          style={({ pressed }) => [
                            styles.actionButton,
                            { backgroundColor: toast.primaryAction?.destructive ? colors.danger : colors.primary },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.primaryActionText}>{toast.primaryAction.label}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng thông báo"
                  hitSlop={8}
                  onPress={hideToast}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Icon name="close" size={17} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </SafeAreaView>
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
};

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  safeArea: {
    width: "100%",
    alignItems: "center",
  },
  animatedToast: {
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  toastContent: {
    minHeight: 76,
    padding: spacing.md,
    paddingLeft: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  title: {
    ...typography.subheadBold,
    color: colors.textPrimary,
    paddingRight: spacing.xl,
  },
  message: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
  },
  closeButton: {
    position: "absolute",
    right: spacing.xs,
    top: spacing.xs,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSolid,
  },
  secondaryActionText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  primaryActionText: {
    ...typography.captionBold,
    color: colors.textWhite,
  },
  pressed: {
    opacity: motion.pressedOpacity,
  },
});
