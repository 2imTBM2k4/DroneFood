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
import { apiError, authApi, setStoredToken } from "../../api/client";

interface AuthScreenProps {
  onSuccess: (token: string) => void;
}

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
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState("");

  const handleSubmit = async () => {
    setError("");
    setRegisterSuccessMsg("");

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

        const token = await authApi.registerRestaurant({
          name: ownerName,
          email,
          password,
          phone,
          restaurantName,
          address,
        });

        await setStoredToken(token);
        onSuccess(token);
      }
    } catch (cause) {
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
              Đăng nhập quán
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
              Đăng ký mở quán
            </Text>
          </Pressable>
        </View>

        <View style={styles.formCard}>
          {mode === "register" ? (
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

          <Input
            label="Email đăng nhập *"
            placeholder="restaurant@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Mật khẩu *"
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

          {registerSuccessMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{registerSuccessMsg}</Text>
            </View>
          ) : null}

          <Button
            label={mode === "login" ? "Đăng nhập ngay" : "Gửi thông tin đăng ký quán"}
            loading={working}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />
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
  submitBtn: {
    marginTop: spacing.xs,
  },
});
