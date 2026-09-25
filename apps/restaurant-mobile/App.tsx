import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { io } from "socket.io-client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import {
  API_URL,
  apiError,
  authApi,
  foodApi,
  getStoredToken,
  orderApi,
  removeStoredToken,
  restaurantApi,
  walletApi,
} from "./src/api/client";
import { colors, spacing, typography } from "./src/theme/tokens";
import type { DraftFood, Food, Order, Tab } from "./src/types";

// Components
import { TabBar } from "./src/components/navigation/TabBar";
import { registerPushNotifications, unregisterPushNotifications } from "./src/pushNotifications";

// Screens
import { AuthScreen } from "./src/screens/auth/AuthScreen";
import { OverviewScreen } from "./src/screens/dashboard/OverviewScreen";
import { OrdersQueueScreen } from "./src/screens/orders/OrdersQueueScreen";
import { MenuScreen } from "./src/screens/menu/MenuScreen";
import { WalletScreen } from "./src/screens/wallet/WalletScreen";
import { AccountScreen } from "./src/screens/account/AccountScreen";

const queryClient = new QueryClient();

function RestaurantApp() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    getStoredToken().then(setToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    registerPushNotifications(API_URL, token).catch(() => undefined);
  }, [token]);

  // Queries
  const userQuery = useQuery({
    queryKey: ["restaurant-user", token],
    enabled: Boolean(token),
    queryFn: authApi.getMe,
  });

  const restaurantId = userQuery.data?.restaurantId;

  const restaurantQuery = useQuery({
    queryKey: ["restaurant-profile", token, restaurantId],
    enabled: Boolean(token && restaurantId),
    queryFn: () => restaurantApi.getProfile(restaurantId!),
  });

  const ordersQuery = useQuery({
    queryKey: ["restaurant-orders", token],
    enabled: Boolean(token && restaurantId),
    queryFn: orderApi.list,
    refetchInterval: 20000,
  });

  const foodsQuery = useQuery({
    queryKey: ["restaurant-foods", token],
    enabled: Boolean(token && restaurantId),
    queryFn: foodApi.list,
  });

  const bankQuery = useQuery({
    queryKey: ["restaurant-bank", token],
    enabled: Boolean(token && restaurantId),
    queryFn: restaurantApi.getBankAccount,
  });

  const withdrawalsQuery = useQuery({
    queryKey: ["restaurant-withdrawals", token],
    enabled: Boolean(token && restaurantId),
    queryFn: walletApi.getWithdrawals,
  });

  const transactionsQuery = useQuery({
    queryKey: ["restaurant-transactions", token],
    enabled: Boolean(token && restaurantId),
    queryFn: walletApi.getTransactions,
  });

  const refreshAll = async () => {
    await Promise.all([
      restaurantQuery.refetch(),
      ordersQuery.refetch(),
      foodsQuery.refetch(),
      withdrawalsQuery.refetch(),
      transactionsQuery.refetch(),
      userQuery.refetch(),
    ]);
  };

  // Socket.io for live order notifications
  useEffect(() => {
    if (!token || !restaurantId) return undefined;
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("joinRestaurant", restaurantId);
    });

    socket.on("newOrder", () => {
      // Haptic and audio feedback
      try {
        Vibration.vibrate([0, 500, 200, 500]);
      } catch {}
      ordersQuery.refetch();
      setTab("orders");
      Alert.alert("🔥 ĐƠN HÀNG MỚI!", "Có khách vừa đặt món ăn từ quán của bạn.");
    });

    return () => {
      socket.disconnect();
    };
  }, [token, restaurantId]);

  // Actions
  const handleLogout = async () => {
    if (token) await unregisterPushNotifications(API_URL, token).catch(() => undefined);
    await removeStoredToken();
    queryClient.clear();
    setToken(null);
    setTab("overview");
  };

  const handleToggleOpen = async () => {
    if (!token || !restaurantQuery.data || working) return;
    try {
      setWorking(true);
      await restaurantApi.setOpenState(
        restaurantQuery.data._id,
        restaurantQuery.data.isOpen === false
      );
      await restaurantQuery.refetch();
    } catch (cause) {
      Alert.alert("Lỗi", apiError(cause, "Không thể đổi trạng thái quán."));
    } finally {
      setWorking(false);
    }
  };

  const handleUpdateOrderStatus = async (
    order: Order,
    status: Order["orderStatus"],
    reason?: string
  ) => {
    try {
      setWorking(true);
      await orderApi.updateStatus(order._id, status, reason);
      await ordersQuery.refetch();
      if (status === "preparing") {
        Alert.alert("Đã nhận đơn", "Bắt đầu nấu món cho khách hàng!");
      } else if (status === "delivering") {
        Alert.alert("Đã bàn giao", "Đơn hàng đã được bàn giao cho Drone bay!");
      }
    } catch (cause) {
      Alert.alert("Lỗi", apiError(cause, "Không thể cập nhật đơn hàng."));
    } finally {
      setWorking(false);
    }
  };

  const handleSaveFood = async (draft: DraftFood) => {
    try {
      setWorking(true);
      await foodApi.save(draft);
      await foodsQuery.refetch();
      Alert.alert("Thành công", "Đã lưu món ăn vào thực đơn quán.");
    } catch (cause) {
      Alert.alert("Lỗi lưu món", apiError(cause));
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveFood = (food: Food) => {
    Alert.alert("Xóa món ăn", `Xóa "${food.name}" khỏi thực đơn?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setWorking(true);
            await foodApi.remove(food._id);
            await foodsQuery.refetch();
          } catch (cause) {
            Alert.alert("Lỗi", apiError(cause));
          } finally {
            setWorking(false);
          }
        },
      },
    ]);
  };

  const handleRequestWithdrawal = async (amount: number) => {
    setWorking(true);
    try {
      await walletApi.requestWithdrawal(amount);
      await Promise.all([
        withdrawalsQuery.refetch(),
        userQuery.refetch(),
      ]);
    } finally {
      setWorking(false);
    }
  };

  const handleUpdateBankAccount = async (account: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
  }) => {
    setWorking(true);
    try {
      await restaurantApi.updateBankAccount(account);
      await bankQuery.refetch();
    } finally {
      setWorking(false);
    }
  };

  const handleUpdateRestaurantProfile = async (data: {
    name: string;
    address: string;
    phone: string;
    email: string;
    description: string;
  }) => {
    if (!token || !restaurantQuery.data) return;
    try {
      setWorking(true);
      await restaurantApi.updateProfile(restaurantQuery.data._id, data);
      await restaurantQuery.refetch();
      Alert.alert("Thành công", "Đã cập nhật thông tin nhà hàng thành công.");
    } catch (cause) {
      Alert.alert("Lỗi", apiError(cause, "Không thể cập nhật thông tin quán."));
    } finally {
      setWorking(false);
    }
  };

  if (!token) {
    return <AuthScreen onSuccess={setToken} />;
  }

  if (userQuery.isLoading || restaurantQuery.isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu nhà hàng...</Text>
      </SafeAreaView>
    );
  }

  if (userQuery.data?.role !== "restaurant_owner" || !restaurantId) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Tài khoản này chưa được liên kết hoặc chưa được duyệt mở Nhà hàng.
        </Text>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Đăng xuất</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pendingCount = (ordersQuery.data || []).filter(
    (o) => o.orderStatus === "pending"
  ).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View>
          <Text numberOfLines={1} style={styles.brandTitle}>
            {restaurantQuery.data?.name || "Drone Food Restaurant"}
          </Text>
          <Text style={styles.statusMeta}>
            {restaurantQuery.data?.isOpen === false
              ? "🔴 Quán đang đóng cửa"
              : "🟢 Đang nhận đơn bình thường"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới"
          hitSlop={10}
          style={styles.refreshBtn}
          onPress={refreshAll}
        >
          <Text style={styles.refreshText}>🔄</Text>
        </Pressable>
      </View>

      {/* Main Content Body */}
      <View style={styles.content}>
        {tab === "overview" && (
          <OverviewScreen
            restaurant={restaurantQuery.data}
            orders={ordersQuery.data || []}
            foods={foodsQuery.data || []}
            working={working}
            onToggleOpen={handleToggleOpen}
            onGoOrders={() => setTab("orders")}
            onGoMenu={() => setTab("menu")}
            onGoWallet={() => setTab("wallet")}
          />
        )}

        {tab === "orders" && (
          <OrdersQueueScreen
            orders={ordersQuery.data || []}
            loading={ordersQuery.isLoading}
            working={working}
            onRefresh={() => ordersQuery.refetch()}
            onAcceptAndPrepare={(o) => handleUpdateOrderStatus(o, "preparing")}
            onDroneHandover={(o) => handleUpdateOrderStatus(o, "delivering")}
            onCancelConfirm={(o, r) => handleUpdateOrderStatus(o, "cancelled", r)}
          />
        )}

        {tab === "menu" && (
          <MenuScreen
            foods={foodsQuery.data || []}
            loading={foodsQuery.isLoading}
            working={working}
            onRefresh={() => foodsQuery.refetch()}
            onSaveFood={handleSaveFood}
            onRemoveFood={handleRemoveFood}
          />
        )}

        {tab === "wallet" && (
          <WalletScreen
            user={userQuery.data}
            restaurant={restaurantQuery.data}
            bankAccount={bankQuery.data}
            withdrawals={withdrawalsQuery.data || []}
            transactions={transactionsQuery.data || []}
            loading={withdrawalsQuery.isLoading}
            working={working}
            onRequestWithdrawal={handleRequestWithdrawal}
            onUpdateBankAccount={handleUpdateBankAccount}
            onRefresh={refreshAll}
          />
        )}

        {tab === "account" && (
          <AccountScreen
            restaurant={restaurantQuery.data}
            working={working}
            onUpdateProfile={handleUpdateRestaurantProfile}
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Bottom Tab Bar */}
      <TabBar
        activeTab={tab}
        onChangeTab={setTab}
        pendingCount={pendingCount}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RestaurantApp />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandTitle: {
    ...typography.title2,
    color: colors.primaryDark,
    maxWidth: 280,
  },
  statusMeta: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    padding: spacing.xs,
  },
  refreshText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.parchment,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.subhead,
    color: colors.danger,
    textAlign: "center",
  },
  logoutBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  logoutBtnText: {
    ...typography.subhead,
    color: colors.primary,
  },
});
