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
  getEmailVerificationRequirement,
  removeStoredRefreshToken,
  resetSessionExpiryNotification,
  setStoredRefreshToken,
  setStoredToken,
} from "../../api/client";

interface AuthScreenProps {
  onSuccess: (token: string) => void;
}

type VerificationState = {
  rawEmail: string;
  displayEmail: string;
  source: "login" | "register";
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");

  const showVerification = (
    rawEmail: string,
    displayEmail: string | undefined,
    source: VerificationState["source"]
  ) => {
    setVerification({
      rawEmail: rawEmail.trim().toLowerCase(),
      displayEmail: displayEmail || rawEmail.trim(),
      source,
    });
    setVerificationMessage("");
    setError("");
  };

  const handleResendVerification = async () => {
    if (!verification) return;
    try {
      setLoading(true);
      setError("");
      const response = await authApi.resendVerification(verification.rawEmail);
      setVerificationMessage(
        response.message || "Nếu tài khoản đang chờ xác minh, email mới đã được gửi."
      );
    } catch (cause) {
      setError(apiError(cause, "Không thể gửi lại email xác minh. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) {
      setError("Vui lòng nhập email tài khoản.");
      return;
    }
    try {
      setLoading(true);
      await authApi.forgotPassword(email);
      setForgotSent(true);
    } catch (cause) {
      setError(apiError(cause, "Không thể gửi yêu cầu. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

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
        showVerification(email, res.email, "register");
      }
    } catch (cause) {
      const requirement = getEmailVerificationRequirement(cause);
      if (mode === "login" && requirement) {
        showVerification(email, requirement.email, "login");
        return;
      }
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
        {!forgotMode && !verification ? <View style={styles.tabWrapper}>
          <Tabs<"login" | "register">
            options={[
              { key: "login", label: "Đăng nhập" },
              { key: "register", label: "Tạo tài khoản" },
            ]}
            activeKey={mode}
            onSelectTab={(selectedKey) => {
              setMode(selectedKey);
              setError("");
              setForgotSent(false);
            }}
            variant="pill"
          />
        </View> : null}

        {/* Clean Flat Form Card */}
        <View style={styles.formCard}>
          {verification ? (
            <>
              <View style={styles.verificationIcon} accessible={false}>
                <Icon name="check" size={28} color={colors.statusDeliveredText} />
              </View>
              <Text accessibilityRole="header" style={styles.forgotTitle}>
                Kiểm tra hộp thư của bạn
              </Text>
              <Text style={styles.forgotDescription}>
                Drone Food đã gửi liên kết xác minh đến {verification.displayEmail}. Hãy mở email bằng trình duyệt, hoàn tất xác minh rồi quay lại ứng dụng để đăng nhập.
              </Text>
              {verification.source === "register" ? (
                <Text style={styles.verificationHint}>
                  Tài khoản chỉ được sử dụng sau khi địa chỉ email đã được xác minh.
                </Text>
              ) : null}
              {verificationMessage ? (
                <View style={styles.successBox} accessibilityRole="alert">
                  <Text style={styles.successText}>{verificationMessage}</Text>
                </View>
              ) : null}
              {error ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Icon name="close" size={16} color={colors.statusCancelledText} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <Button
                label="Gửi lại email xác minh"
                loading={loading}
                onPress={handleResendVerification}
                size="lg"
                fullWidth
              />
              <Button
                label="Thay đổi email"
                variant="outline"
                disabled={loading}
                onPress={() => {
                  const source = verification.source;
                  setVerification(null);
                  setVerificationMessage("");
                  setError("");
                  setMode(source);
                }}
                fullWidth
              />
              <Button
                label="Quay lại đăng nhập"
                variant="ghost"
                disabled={loading}
                onPress={() => {
                  setVerification(null);
                  setVerificationMessage("");
                  setError("");
                  setMode("login");
                }}
                fullWidth
              />
            </>
          ) : forgotMode ? (
            <>
              <Text style={styles.forgotTitle}>Quên mật khẩu</Text>
              <Text style={styles.forgotDescription}>
                Nhập email tài khoản. Nếu email tồn tại, Drone Food sẽ gửi liên kết đặt lại mật khẩu dùng một lần trong 15 phút.
              </Text>
              <Input
                label="Email"
                placeholder="name@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              {forgotSent ? (
                <View style={styles.successBox} accessibilityRole="alert">
                  <Text style={styles.successText}>Hãy kiểm tra hộp thư và thư rác. Phản hồi này không xác nhận email có tồn tại trong hệ thống.</Text>
                </View>
              ) : null}
              {error ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Icon name="close" size={16} color={colors.statusCancelledText} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <Button
                label={forgotSent ? "Gửi lại hướng dẫn" : "Gửi hướng dẫn đặt lại"}
                loading={loading}
                onPress={handleForgotPassword}
                size="lg"
                fullWidth
              />
              <Button
                label="Quay lại đăng nhập"
                variant="outline"
                disabled={loading}
                onPress={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                fullWidth
              />
            </>
          ) : mode === "register" ? (
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

          {!forgotMode && !verification ? <>
          <Input
            label="Email"
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Input
            label="Mật khẩu"
            placeholder="Nhập mật khẩu của bạn"
            isPassword
            value={password}
            onChangeText={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            textContentType={mode === "login" ? "password" : "newPassword"}
          />

          {mode === "login" ? (
            <Button
              label="Quên mật khẩu?"
              variant="ghost"
              disabled={loading}
              onPress={() => { setForgotMode(true); setForgotSent(false); setError(""); }}
              fullWidth
            />
          ) : null}

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
          </> : null}
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
  forgotTitle: {
    ...typography.title2,
    color: colors.textPrimary,
  },
  forgotDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  successBox: {
    backgroundColor: colors.statusDeliveredBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  successText: {
    ...typography.caption,
    color: colors.statusDeliveredText,
    lineHeight: 18,
  },
  verificationIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.statusDeliveredBg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  verificationHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
