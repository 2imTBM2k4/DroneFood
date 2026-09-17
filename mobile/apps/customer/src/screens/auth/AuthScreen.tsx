import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { apiError, authApi, removeStoredRefreshToken, resetSessionExpiryNotification, setStoredRefreshToken, setStoredToken } from "../../api/client";

interface AuthScreenProps {
  onSuccess: (token: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Vui lòng nhập Họ và tên của bạn.");
      return;
    }

    try {
      setLoading(true);
      if (mode === "login") {
        const res = await authApi.login(email, password);
        await setStoredToken(res.token);
        if (res.refreshToken) await setStoredRefreshToken(res.refreshToken);
        else await removeStoredRefreshToken();
        resetSessionExpiryNotification();
        onSuccess(res.token);
      } else {
        const res = await authApi.register(name, email, password, phone);
        await setStoredToken(res.token);
        if (res.refreshToken) await setStoredRefreshToken(res.refreshToken);
        else await removeStoredRefreshToken();
        resetSessionExpiryNotification();
        onSuccess(res.token);
      }
    } catch (cause) {
      setError(apiError(cause, mode === "login" ? "Đăng nhập thất bại." : "Đăng ký thất bại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🛸</Text>
          </View>
          <Text style={styles.brandTitle}>Drone Food</Text>
          <Text style={styles.brandSubtitle}>
            Giao đồ ăn siêu tốc từ bầu trời tới cửa sổ nhà bạn
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          <Pressable
            style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
            onPress={() => {
              setMode("login");
              setError("");
            }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "login" && styles.segmentTextActive,
              ]}
            >
              Đăng nhập
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
            onPress={() => {
              setMode("register");
              setError("");
            }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "register" && styles.segmentTextActive,
              ]}
            >
              Tạo tài khoản
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === "register" ? (
            <>
              <Input
                label="Họ và tên"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="Số điện thoại"
                placeholder="0901234567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </>
          ) : null}

          <Input
            label="Email"
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />

          <Text style={styles.legalText}>
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Drone Food.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoIcon: {
    fontSize: 32,
  },
  brandTitle: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  brandSubtitle: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  form: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  errorBox: {
    backgroundColor: colors.statusCancelledBg,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.statusCancelledText,
    textAlign: "center",
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  legalText: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 15,
  },
});
