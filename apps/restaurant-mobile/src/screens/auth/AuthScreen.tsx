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
import {
  apiError,
  authApi,
  getEmailVerificationRequirement,
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

  // Login inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register inputs
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [address, setAddress] = useState("");

  const [working, setWorking] = useState(false);
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
      setWorking(true);
      setError("");
      const response = await authApi.resendVerification(verification.rawEmail);
      setVerificationMessage(
        response.message || "Nếu tài khoản đang chờ xác minh, email mới đã được gửi."
      );
    } catch (cause) {
      setError(apiError(cause, "Không thể gửi lại email xác minh. Vui lòng thử lại."));
    } finally {
      setWorking(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) {
      setError("Vui lòng nhập email tài khoản.");
      return;
    }
    try {
      setWorking(true);
      await authApi.forgotPassword(email);
      setForgotSent(true);
    } catch (cause) {
      setError(apiError(cause, "Không thể gửi yêu cầu. Vui lòng thử lại."));
    } finally {
      setWorking(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }

    try {
      setWorking(true);
      if (mode === "login") {
        const res = await authApi.login(email, password);
        await setStoredToken(res.token);
        onSuccess(res.token);
      } else {
        if (!ownerName.trim() || !phone.trim() || !restaurantName.trim() || !address.trim()) {
          setError("Vui lòng điền đầy đủ thông tin quán và chủ quán.");
          return;
        }

        const response = await authApi.registerRestaurant({
          name: ownerName,
          email,
          password,
          phone,
          restaurantName,
          address,
        });

        showVerification(email, response.email, "register");
      }
    } catch (cause) {
      const requirement = getEmailVerificationRequirement(cause);
      if (mode === "login" && requirement) {
        showVerification(email, requirement.email, "login");
        return;
      }
      setError(apiError(cause, mode === "login" ? "Đăng nhập thất bại." : "Đăng ký quán thất bại."));
    } finally {
      setWorking(false);
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
            <Text style={styles.logoIcon}>🏪</Text>
          </View>
          <Text style={styles.brandTitle}>Drone Food Restaurant</Text>
          <Text style={styles.brandSubtitle}>
            Cổng quản lý đơn hàng & thực đơn dành riêng cho đối tác Nhà hàng
          </Text>
        </View>

        {!forgotMode && !verification ? <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "login" }}
            style={[styles.segmentBtn, mode === "login" && styles.segmentBtnActive]}
            onPress={() => {
              setMode("login");
              setError("");
              setForgotSent(false);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "login" && styles.segmentTextActive,
              ]}
            >
              Đăng nhập quán
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "register" }}
            style={[styles.segmentBtn, mode === "register" && styles.segmentBtnActive]}
            onPress={() => {
              setMode("register");
              setError("");
              setForgotSent(false);
            }}
          >
            <Text
              style={[
                styles.segmentText,
                mode === "register" && styles.segmentTextActive,
              ]}
            >
              Đăng ký mở quán
            </Text>
          </Pressable>
        </View> : null}

        <View style={styles.formCard}>
          {verification ? (
            <>
              <Text accessibilityRole="header" style={styles.verificationTitle}>
                Kiểm tra email để tiếp tục
              </Text>
              <Text style={styles.forgotDescription}>
                Drone Food đã gửi liên kết xác minh đến {verification.displayEmail}. Hãy mở email bằng trình duyệt, hoàn tất xác minh rồi quay lại ứng dụng để đăng nhập.
              </Text>
              {verification.source === "register" ? (
                <View style={styles.approvalNotice}>
                  <Text style={styles.approvalNoticeText}>
                    Xác minh email và duyệt nhà hàng là hai bước riêng biệt. Sau khi xác minh email, hồ sơ nhà hàng vẫn cần Admin phê duyệt trước khi hoạt động.
                  </Text>
                </View>
              ) : null}
              {verificationMessage ? (
                <View style={styles.successBox}>
                  <Text accessibilityRole="alert" style={styles.successText}>{verificationMessage}</Text>
                </View>
              ) : null}
              {error ? (
                <View style={styles.errorBox}>
                  <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <Button label="Gửi lại email xác minh" loading={working} onPress={handleResendVerification} />
              <Button
                label="Thay đổi email"
                variant="outline"
                disabled={working}
                onPress={() => {
                  const source = verification.source;
                  setVerification(null);
                  setVerificationMessage("");
                  setError("");
                  setMode(source);
                }}
              />
              <Button
                label="Quay lại đăng nhập"
                variant="outline"
                disabled={working}
                onPress={() => {
                  setVerification(null);
                  setVerificationMessage("");
                  setError("");
                  setMode("login");
                }}
              />
            </>
          ) : forgotMode ? (
            <>
              <Text style={styles.formSectionTitle}>Khôi phục mật khẩu</Text>
              <Text style={styles.forgotDescription}>
                Nếu email tồn tại trong hệ thống, Drone Food sẽ gửi liên kết đặt lại mật khẩu dùng một lần trong 15 phút.
              </Text>
              <Input
                label="Email đăng nhập"
                placeholder="restaurant@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              {forgotSent ? (
                <View style={styles.successBox}>
                  <Text accessibilityRole="alert" style={styles.successText}>Hãy kiểm tra hộp thư và thư rác. Phản hồi này không xác nhận email có tồn tại.</Text>
                </View>
              ) : null}
              {error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text></View> : null}
              <Button label={forgotSent ? "Gửi lại hướng dẫn" : "Gửi hướng dẫn đặt lại"} loading={working} onPress={handleForgotPassword} />
              <Button label="Quay lại đăng nhập" variant="outline" disabled={working} onPress={() => { setForgotMode(false); setForgotSent(false); setError(""); }} />
            </>
          ) : mode === "register" ? (
            <>
              <Text style={styles.formSectionTitle}>Thông tin chủ quán:</Text>
              <Input
                label="Họ và tên chủ quán *"
                placeholder="Nguyễn Văn A"
                value={ownerName}
                onChangeText={setOwnerName}
              />
              <Input
                label="Số điện thoại liên hệ *"
                placeholder="0901234567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.formSectionTitle}>Thông tin nhà hàng:</Text>
              <Input
                label="Tên nhà hàng / Quán ăn *"
                placeholder="Ví dụ: Trà Sữa Gong Cha - Q.1"
                value={restaurantName}
                onChangeText={setRestaurantName}
              />
              <Input
                label="Địa chỉ kinh doanh cụ thể *"
                placeholder="Số nhà, tên đường, phường, quận..."
                value={address}
                onChangeText={setAddress}
              />
            </>
          ) : null}

          {!forgotMode && !verification ? <>
          <Input
            label="Email đăng nhập *"
            placeholder="restaurant@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Input
            label="Mật khẩu *"
            placeholder="Nhập mật khẩu"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            textContentType={mode === "login" ? "password" : "newPassword"}
          />
          </> : null}

          {!forgotMode && !verification && mode === "login" ? (
            <Button label="Quên mật khẩu?" variant="outline" disabled={working} onPress={() => { setForgotMode(true); setForgotSent(false); setError(""); }} />
          ) : null}

          {!forgotMode && !verification && error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!forgotMode && !verification ? <Button
            label={mode === "login" ? "Đăng nhập ngay" : "Gửi thông tin đăng ký quán"}
            loading={working}
            onPress={handleSubmit}
            style={styles.submitBtn}
          /> : null}
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
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  logoIcon: {
    fontSize: 30,
  },
  brandTitle: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  brandSubtitle: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
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
  formCard: {
    backgroundColor: colors.canvas,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formSectionTitle: {
    ...typography.captionBold,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: "center",
  },
  successBox: {
    backgroundColor: colors.successLight,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  successText: {
    ...typography.caption,
    color: colors.success,
    textAlign: "center",
  },
  forgotDescription: {
    ...typography.bodySecondary,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  verificationTitle: {
    ...typography.title1,
    color: colors.textPrimary,
    textAlign: "center",
  },
  approvalNotice: {
    backgroundColor: colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  approvalNoticeText: {
    ...typography.bodySecondary,
    color: colors.primaryDark,
    lineHeight: 20,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
