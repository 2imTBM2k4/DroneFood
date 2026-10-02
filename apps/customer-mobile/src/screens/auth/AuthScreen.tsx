import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Tabs } from "../../components/common/Tabs";
import { Icon } from "../../components/common/Icon";
import {
  apiError,
  authApi,
  removeStoredRefreshToken,
  resetSessionExpiryNotification,
  setStoredRefreshToken,
  setStoredToken,
} from "../../api/client";

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
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Icon name="drone" size={32} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>Drone Food</Text>
          <Text style={styles.brandSubtitle}>
            Giao đồ ăn siêu tốc từ bầu trời tới cửa sổ nhà bạn
          </Text>
        </View>

        {/* Mode Switcher Tabs */}
        <View style={styles.tabWrapper}>
          <Tabs<"login" | "register">
            options={[
              { key: "login", label: "Đăng nhập" },
              { key: "register", label: "Tạo tài khoản" },
            ]}
            activeKey={mode}
            onSelectTab={(selectedKey) => {
              setMode(selectedKey);
              setError("");
            }}
            variant="pill"
          />
        </View>

        {/* Clean Flat Form Card */}
        <View style={styles.formCard}>
          {mode === "register" ? (
            <>
              <Input
                label="Họ và tên"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
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
            placeholder="Nhập mật khẩu của bạn"
            isPassword
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="close" size={16} color={colors.statusCancelledText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label={mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            loading={loading}
            onPress={handleSubmit}
            size="lg"
            fullWidth
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
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brandTitle: {
    ...typography.hero,
    fontSize: 26,
    color: colors.textPrimary,
  },
  brandSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tabWrapper: {
    marginBottom: spacing.md,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.statusCancelledBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.statusCancelledText,
    flex: 1,
    fontWeight: "500",
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  legalText: {
    ...typography.micro,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 15,
    marginTop: spacing.xs,
  },
});
