import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import axios from "axios";
import MapView, { Marker } from "react-native-maps";
import { io } from "socket.io-client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:4000").replace(/\/$/, "");
const BACKGROUND_LOCATION_TASK = "drone-food-shipper-location";
const TOKEN_KEY = "shipperAccessToken";
const REFRESH_TOKEN_KEY = "shipperRefreshToken";
const queryClient = new QueryClient();

type ShipperStatus = "offline" | "available" | "assigned" | "delivering";
type Coordinates = { latitude: number; longitude: number };
type Registration = { name: string; email: string; phone: string; address: string; password: string };
type Profile = { status: ShipperStatus; approvalStatus: "pending" | "approved" | "rejected"; vehicleType: string; locationUpdatedAt?: string; currentOrder?: string | null };
type User = { name: string; email: string; role: string };
type WalletSummary = {
  depositBalance: number; earningsBalance: number; reservedCodLiability: number;
  warningThreshold: number; lockThreshold: number; isEarlyWarning: boolean; isAcceptanceLocked: boolean;
};
type WalletTransaction = { _id: string; amount: number; transactionType: string; createdAt: string };
type EarningsReport = {
  totalEarned: number;
  daily: { period: string; amount: number; deliveries: number }[];
  monthly: { period: string; amount: number; deliveries: number }[];
};
type Order = {
  _id: string; orderStatus: "pending" | "preparing" | "delivering" | "delivered" | "cancelled";
  totalPrice: number; shippingPrice: number; paymentMethod: "COD" | "VNPAY" | "PAYOS"; createdAt: string; deliveryMethod: "shipper";
  shippingAddress: { fullName: string; address: string; city: string; state: string; phone: string; lat?: number; lng?: number };
  restaurantId?: { name: string; address: string; phone?: string; lat?: number; lng?: number };
  orderItems: { name: string; quantity: number; selectedOptions?: { groupName: string; optionName: string }[]; note?: string }[];
  shipperAssignmentDeadlineAt?: string;
};

const formatVnd = (value = 0) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
const formatVietnamDate = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const apiError = (error: unknown, fallback = "Có lỗi xảy ra") => axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;
const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });
const statusLabel: Record<ShipperStatus, string> = { offline: "Ngoại tuyến", available: "Sẵn sàng nhận đơn", assigned: "Đã nhận đơn", delivering: "Đang giao" };

async function sendBackgroundLocation(coordinates: Coordinates) {
  let token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  try {
    await axios.put(`${API_URL}/api/shippers/me/location`, { lat: coordinates.latitude, lng: coordinates.longitude }, { headers: authHeaders(token) });
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error;
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw error;
    const refreshed = await axios.post<{ token: string }>(`${API_URL}/api/user/refresh-token`, { refreshToken });
    token = refreshed.data.token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await axios.put(`${API_URL}/api/shippers/me/location`, { lat: coordinates.latitude, lng: coordinates.longitude }, { headers: authHeaders(token) });
  }
}

type LocationTaskData = { locations: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
  if (error || !data) return;
  const locations = data.locations;
  const latest = locations[locations.length - 1];
  if (!latest) return;
  try {
    await sendBackgroundLocation({ latitude: latest.coords.latitude, longitude: latest.coords.longitude });
  } catch {
    // The foreground app retries on the next location update. A background task must not crash the OS worker.
  }
});

function ShipperApp() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [locationSyncError, setLocationSyncError] = useState("");
  const [tab, setTab] = useState<"offers" | "delivery" | "account">("offers");
  const [working, setWorking] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const locationTrackingStarted = useRef(false);

  useEffect(() => { SecureStore.getItemAsync(TOKEN_KEY).then(setToken); }, []);

  const user = useQuery({
    queryKey: ["shipper-user", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: User }>(`${API_URL}/api/user/me`, { headers: authHeaders(token!) })).data.data,
  });
  const profile = useQuery({
    queryKey: ["shipper-profile", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: Profile }>(`${API_URL}/api/shippers/me`, { headers: authHeaders(token!) })).data.data,
    refetchInterval: 30000,
  });
  const offers = useQuery({
    queryKey: ["shipper-offers", token],
    enabled: Boolean(token && profile.data?.status === "available" && profile.data?.approvalStatus === "approved"),
    queryFn: async () => (await axios.get<{ data: Order[] }>(`${API_URL}/api/shippers/me/orders/available`, { headers: authHeaders(token!) })).data.data || [],
    refetchInterval: 30000,
  });
  const currentOrder = useQuery({
    queryKey: ["shipper-current-order", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: Order | null }>(`${API_URL}/api/shippers/me/orders/current`, { headers: authHeaders(token!) })).data.data,
    refetchInterval: profile.data?.currentOrder ? 15000 : false,
  });
  const wallet = useQuery({
    queryKey: ["shipper-wallet", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: WalletSummary }>(`${API_URL}/api/wallet/shipper/me`, { headers: authHeaders(token!) })).data.data,
    refetchInterval: 30000,
  });
  const walletTransactions = useQuery({
    queryKey: ["shipper-wallet-transactions", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: WalletTransaction[] }>(`${API_URL}/api/wallet/shipper/transactions`, { headers: authHeaders(token!) })).data.data || [],
  });
  const earningsReport = useQuery({
    queryKey: ["shipper-earnings-report", token],
    enabled: Boolean(token),
    queryFn: async () => (await axios.get<{ data: EarningsReport }>(`${API_URL}/api/wallet/shipper/earnings-report`, { headers: authHeaders(token!) })).data.data,
  });

  const isApproved = profile.data?.approvalStatus === "approved";
  const isWorking = profile.data?.status === "assigned" || profile.data?.status === "delivering";
  const offersError = locationSyncError || (offers.isError ? apiError(offers.error, "Không thể tải đơn gần bạn.") : "");

  const refreshViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["shipper-profile", token] }),
      queryClient.invalidateQueries({ queryKey: ["shipper-offers", token] }),
      queryClient.invalidateQueries({ queryKey: ["shipper-current-order", token] }),
      queryClient.invalidateQueries({ queryKey: ["shipper-wallet", token] }),
      queryClient.invalidateQueries({ queryKey: ["shipper-wallet-transactions", token] }),
      queryClient.invalidateQueries({ queryKey: ["shipper-earnings-report", token] }),
    ]);
  };

  const pushLocation = async (coords: Coordinates) => {
    if (!token) return;
    await sendBackgroundLocation(coords);
    const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    if (storedToken && storedToken !== token) setToken(storedToken);
  };

  const getCurrentLocation = async (): Promise<Coordinates> => {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") throw new Error("Cần cho phép vị trí để nhận đơn trong phạm vi tối đa 5 km.");
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  };

  const beginLocationTracking = async (initialLocation: Coordinates) => {
    await pushLocation(initialLocation);
    watcher.current?.remove();
    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 20000 },
      (next) => pushLocation({ latitude: next.coords.latitude, longitude: next.coords.longitude }).catch(() => undefined),
    );

    // Background tracking is a progressive enhancement. Expo Go or a device
    // setting can reject it, but foreground tracking must remain usable.
    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status === "granted" && !(await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 20000,
          foregroundService: { notificationTitle: "Drone Food Shipper", notificationBody: "Đang cập nhật vị trí để nhận và giao đơn." },
        });
      }
    } catch {
      // Foreground updates continue when background tracking is unavailable.
    }
  };

  /** Restores live location updates when an available shipper reopens the app. */
  useEffect(() => {
    if (!token || profile.data?.status !== "available") {
      locationTrackingStarted.current = false;
      return undefined;
    }
    if (locationTrackingStarted.current) return undefined;

    let active = true;
    locationTrackingStarted.current = true;
    (async () => {
      try {
        const location = await getCurrentLocation();
        if (!active) return;
        await beginLocationTracking(location);
        if (!active) return;
        setLocationSyncError("");
        await refreshViews();
      } catch (error) {
        locationTrackingStarted.current = false;
        if (active) {
          setLocationSyncError(apiError(error, "Không thể cập nhật vị trí hiện tại. Hãy kiểm tra quyền vị trí rồi thử lại."));
        }
      }
    })();

    return () => { active = false; };
  }, [token, profile.data?.status]);

  useEffect(() => () => watcher.current?.remove(), []);
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("joinShipper"));
    socket.on("shipperOrderOffer", () => {
      queryClient.invalidateQueries({ queryKey: ["shipper-offers", token] });
      setTab("offers");
    });
    return () => { socket.disconnect(); };
  }, [token]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && profile.data?.status !== "offline") refreshViews();
    });
    return () => listener.remove();
  }, [profile.data?.status, token]);

  const login = async () => {
    try {
      setWorking(true); setLoginError("");
      const response = await axios.post(`${API_URL}/api/user/login`, { email: email.trim(), password });
      if (response.data.role !== "shipper") throw new Error("Tài khoản này không phải tài khoản Shipper.");
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.data.refreshToken || "");
      setToken(response.data.token);
    } catch (error) { setLoginError(apiError(error, error instanceof Error ? error.message : "Đăng nhập thất bại")); }
    finally { setWorking(false); }
  };
  const register = async (details: Registration) => {
    if (details.name.trim().length < 2) return setLoginError("Tên phải có ít nhất 2 ký tự.");
    if (!details.phone.trim()) return setLoginError("Số điện thoại là bắt buộc để nhà hàng và khách liên hệ Shipper.");
    if (details.password.length < 8) return setLoginError("Mật khẩu phải có ít nhất 8 ký tự.");
    try {
      setWorking(true); setLoginError("");
      const response = await axios.post(`${API_URL}/api/user/register`, {
        name: details.name.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        address: details.address.trim(),
        password: details.password,
        role: "shipper",
      });
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.data.refreshToken || "");
      setToken(response.data.token);
      Alert.alert("Đăng ký thành công", "Tài khoản đang chờ Admin duyệt. Bạn sẽ chưa thể bật trạng thái nhận đơn cho đến khi được duyệt.");
    } catch (error) { setLoginError(apiError(error, "Không thể đăng ký. Hãy kiểm tra lại thông tin và thử lại.")); }
    finally { setWorking(false); }
  };
  const logout = async () => {
    watcher.current?.remove();
    locationTrackingStarted.current = false;
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await SecureStore.deleteItemAsync(TOKEN_KEY); await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    queryClient.clear(); setToken(null); setTab("offers");
  };
  const changeStatus = async () => {
    if (!token || !isApproved || working) return;
    try {
      setWorking(true);
      if (profile.data?.status === "offline") {
        const initialLocation = await getCurrentLocation();
        await axios.put(`${API_URL}/api/shippers/me/status`, { status: "available" }, { headers: authHeaders(token) });
        try {
          locationTrackingStarted.current = true;
          await beginLocationTracking(initialLocation);
          setLocationSyncError("");
        } catch (error) {
          locationTrackingStarted.current = false;
          await axios.put(`${API_URL}/api/shippers/me/status`, { status: "offline" }, { headers: authHeaders(token) }).catch(() => undefined);
          throw error;
        }
      } else {
        await axios.put(`${API_URL}/api/shippers/me/status`, { status: "offline" }, { headers: authHeaders(token) });
        watcher.current?.remove(); watcher.current = null;
        locationTrackingStarted.current = false;
        if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
      await refreshViews();
    } catch (error) { Alert.alert("Không thể đổi trạng thái", apiError(error)); }
    finally { setWorking(false); }
  };
  const acceptOrder = async (order: Order) => {
    if (!token) return;
    try {
      setWorking(true);
      await axios.post(`${API_URL}/api/shippers/me/orders/${order._id}/accept`, {}, { headers: authHeaders(token) });
      setTab("delivery"); await refreshViews();
    } catch (error) { Alert.alert("Không thể nhận đơn", apiError(error)); await refreshViews(); }
    finally { setWorking(false); }
  };
  const advanceDelivery = async () => {
    if (!token || !currentOrder.data) return;
    const endpoint = currentOrder.data.orderStatus === "preparing" ? "pick-up" : "complete";
    try {
      setWorking(true);
      await axios.post(`${API_URL}/api/shippers/me/orders/${currentOrder.data._id}/${endpoint}`, {}, { headers: authHeaders(token) });
      await refreshViews();
    } catch (error) { Alert.alert("Không thể cập nhật đơn", apiError(error)); }
    finally { setWorking(false); }
  };
  /** Creates a PayOS deposit payment and opens the checkout safely. */
  const topUpDeposit = async (amount: number) => {
    if (!token) return;
    try {
      setWorking(true);
      const response = await axios.post<{ checkoutUrl?: string; paymentUrl?: string }>(
        `${API_URL}/api/wallet/shipper/deposit/payos`,
        { amount },
        { headers: authHeaders(token) }
      );
      const checkoutUrl = response.data.checkoutUrl || response.data.paymentUrl;
      if (!checkoutUrl) throw new Error("Không tạo được liên kết thanh toán PayOS.");
      const supported = await Linking.canOpenURL(checkoutUrl);
      if (!supported) throw new Error("Thiết bị không thể mở trang thanh toán PayOS.");
      await Linking.openURL(checkoutUrl);
      Alert.alert("Tiếp tục thanh toán", "Sau khi PayOS xác nhận, hãy quay lại app và bấm “Làm mới số dư”.");
    } catch (error) { Alert.alert("Không thể nạp ký quỹ", apiError(error, error instanceof Error ? error.message : "Có lỗi xảy ra")); }
    finally { setWorking(false); }
  };
  /** Sends a fresh GPS point and restarts foreground tracking on demand. */
  const refreshLocation = async () => {
    if (!token || profile.data?.status !== "available" || working) return;
    try {
      setWorking(true);
      const location = await getCurrentLocation();
      locationTrackingStarted.current = true;
      await beginLocationTracking(location);
      setLocationSyncError("");
      await refreshViews();
    } catch (error) {
      locationTrackingStarted.current = false;
      setLocationSyncError(apiError(error, "Không thể cập nhật vị trí hiện tại. Hãy kiểm tra quyền vị trí rồi thử lại."));
    } finally { setWorking(false); }
  };

  if (!token) return <LoginScreen email={email} password={password} error={loginError} working={working} onEmail={setEmail} onPassword={setPassword} onLogin={login} onRegister={register} />;
  if (user.isLoading || profile.isLoading) return <Loading />;
  if (user.data?.role !== "shipper") return <SafeAreaView style={styles.center}><Text style={styles.error}>Tài khoản không có quyền Shipper.</Text><PrimaryButton label="Đăng xuất" onPress={logout} /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <View style={styles.header}><View><Text style={styles.brand}>Drone Food Shipper</Text><Text style={styles.muted}>{user.data.name} · {statusLabel[profile.data?.status || "offline"]}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={logout}><Text style={styles.link}>Thoát</Text></Pressable></View>
    {!isApproved ? <ApprovalScreen status={profile.data?.approvalStatus || "pending"} /> : <>
      {tab === "offers" && <OffersScreen orders={offers.data || []} loading={offers.isLoading} online={profile.data?.status === "available"} working={working} isWorking={isWorking} error={offersError} onRefresh={refreshViews} onRefreshLocation={refreshLocation} onToggle={changeStatus} onAccept={acceptOrder} />}
      {tab === "delivery" && <DeliveryScreen order={currentOrder.data || null} loading={currentOrder.isLoading} working={working} onAdvance={advanceDelivery} />}
      {tab === "account" && <AccountScreen user={user.data} profile={profile.data} wallet={wallet.data} transactions={walletTransactions.data || []} report={earningsReport.data} walletLoading={wallet.isLoading || earningsReport.isLoading} working={working} isWorking={isWorking} onToggle={changeStatus} onRefresh={refreshViews} onTopUp={topUpDeposit} />}
      <BottomNav active={tab} onChange={setTab} hasDelivery={Boolean(currentOrder.data)} />
    </>}
  </SafeAreaView>;
}

function LoginScreen({ email, password, error, working, onEmail, onPassword, onLogin, onRegister }: { email: string; password: string; error: string; working: boolean; onEmail: (value: string) => void; onPassword: (value: string) => void; onLogin: () => void; onRegister: (details: Registration) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registration, setRegistration] = useState<Registration>({ name: "", email: "", phone: "", address: "", password: "" });
  const change = (key: keyof Registration, value: string) => setRegistration((current) => ({ ...current, [key]: value }));
  return <SafeAreaView style={styles.login}><ScrollView contentContainerStyle={styles.authForm} keyboardShouldPersistTaps="handled"><Text style={styles.brand}>Drone Food Shipper</Text><Text style={styles.subtitle}>{mode === "login" ? "Nhận đơn trong bán kính tối đa 5 km quanh nhà hàng." : "Tạo tài khoản để đăng ký làm Shipper."}</Text>
    {mode === "login" ? <><FormField label="Email" value={email} placeholder="email@example.com" keyboardType="email-address" onChange={onEmail} /><FormField label="Mật khẩu" value={password} placeholder="Ít nhất 8 ký tự" secure onChange={onPassword} /><PrimaryButton label="Đăng nhập" disabled={working} onPress={onLogin} /><SecondaryButton label="Chưa có tài khoản? Đăng ký Shipper" disabled={working} onPress={() => setMode("register")} /></> : <><FormField label="Họ và tên *" value={registration.name} placeholder="Nguyễn Văn A" onChange={(value) => change("name", value)} /><FormField label="Email *" value={registration.email} placeholder="email@example.com" keyboardType="email-address" onChange={(value) => change("email", value)} /><FormField label="Số điện thoại *" value={registration.phone} placeholder="0901234567" keyboardType="phone-pad" onChange={(value) => change("phone", value)} /><FormField label="Địa chỉ hiện tại" value={registration.address} placeholder="Số nhà, đường, phường/xã" onChange={(value) => change("address", value)} /><FormField label="Mật khẩu *" value={registration.password} placeholder="Ít nhất 8 ký tự" secure onChange={(value) => change("password", value)} /><Text style={styles.hint}>Sau khi đăng ký, Admin cần duyệt tài khoản trước khi bạn có thể nhận đơn.</Text><PrimaryButton label="Gửi đăng ký Shipper" disabled={working} onPress={() => onRegister(registration)} /><SecondaryButton label="Đã có tài khoản? Đăng nhập" disabled={working} onPress={() => setMode("login")} /></>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}</ScrollView></SafeAreaView>;
}

function ApprovalScreen({ status }: { status: string }) { return <View style={styles.center}><Text style={styles.screenTitle}>Chờ xác minh tài khoản</Text><Text style={styles.muted}>{status === "rejected" ? "Tài khoản Shipper chưa được duyệt. Hãy liên hệ quản trị viên." : "Admin đang duyệt hồ sơ Shipper của bạn."}</Text></View>; }

function OffersScreen({ orders, loading, online, working, isWorking, error, onRefresh, onRefreshLocation, onToggle, onAccept }: { orders: Order[]; loading: boolean; online: boolean; working: boolean; isWorking: boolean; error: string; onRefresh: () => void; onRefreshLocation: () => void; onToggle: () => void; onAccept: (order: Order) => void }) {
  return <FlatList contentContainerStyle={styles.list} data={online ? orders : []} keyExtractor={(item) => item._id} refreshing={loading} onRefresh={onRefresh} ListHeaderComponent={<><Text style={styles.screenTitle}>Đơn gần bạn</Text><View style={styles.activityBar}><View><Text style={styles.activityTitle}>{online ? "Đang sẵn sàng nhận đơn" : "Bạn đang ngoại tuyến"}</Text><Text style={styles.muted}>{online ? "Vị trí đang được dùng để tìm đơn trong 5 km." : "Bật để gửi vị trí và nhận đơn gần bạn."}</Text></View><Switch accessibilityLabel="Trạng thái hoạt động" value={online} disabled={working || isWorking} onValueChange={onToggle} trackColor={{ false: "#CBD5E1", true: "#86EFAC" }} thumbColor={online ? "#16A34A" : "#F8FAFC"} /></View>{online ? <Text style={styles.muted}>Chỉ hiển thị đơn còn hạn nhận và nhà hàng trong phạm vi tối đa 5 km từ vị trí mới nhất của bạn.</Text> : null}{error ? <View style={styles.locationAlert}><Text style={styles.error}>{error}</Text><SecondaryButton label="Cập nhật vị trí" disabled={working || !online} onPress={onRefreshLocation} /></View> : null}</>} ListEmptyComponent={<Text style={styles.emptyText}>{online ? "Chưa có đơn phù hợp quanh bạn." : "Bật trạng thái hoạt động để bắt đầu nhận đơn."}</Text>} renderItem={({ item }) => <OrderCard order={item} action="Nhận đơn" working={working} onPress={() => onAccept(item)} />} />;
}

function DeliveryScreen({ order, loading, working, onAdvance }: { order: Order | null; loading: boolean; working: boolean; onAdvance: () => void }) {
  if (loading) return <Loading />;
  if (!order) return <View style={styles.center}><Text style={styles.screenTitle}>Chưa có đơn đang giao</Text><Text style={styles.muted}>Nhận một đơn ở tab Đơn gần bạn để bắt đầu.</Text></View>;
  const restaurant = order.restaurantId;
  const destination = order.shippingAddress;
  const canMap = Number.isFinite(restaurant?.lat) && Number.isFinite(restaurant?.lng) && Number.isFinite(destination.lat) && Number.isFinite(destination.lng);
  const openRestaurantNavigation = async () => {
    const restaurantDestination = Number.isFinite(restaurant?.lat) && Number.isFinite(restaurant?.lng)
      ? `${restaurant!.lat},${restaurant!.lng}`
      : restaurant?.address;
    if (!restaurantDestination) return Alert.alert("Thiếu vị trí", "Nhà hàng chưa có địa chỉ để chỉ đường.");
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(restaurantDestination)}&travelmode=driving`;
    if (!(await Linking.canOpenURL(mapsUrl))) return Alert.alert("Không thể mở bản đồ", "Thiết bị không hỗ trợ mở chỉ đường.");
    await Linking.openURL(mapsUrl);
  };
  const action = order.orderStatus === "preparing" ? "Đã lấy hàng từ nhà hàng" : order.orderStatus === "delivering" ? "Hoàn tất giao hàng" : null;
  return <ScrollView contentContainerStyle={styles.list}><Text style={styles.screenTitle}>Đơn đang thực hiện</Text><OrderCard order={order} working={working} />
    {canMap ? <MapView style={styles.map} initialRegion={{ latitude: ((restaurant!.lat || 0) + (destination.lat || 0)) / 2, longitude: ((restaurant!.lng || 0) + (destination.lng || 0)) / 2, latitudeDelta: Math.max(Math.abs((restaurant!.lat || 0) - (destination.lat || 0)) * 1.8, 0.01), longitudeDelta: Math.max(Math.abs((restaurant!.lng || 0) - (destination.lng || 0)) * 1.8, 0.01) }}><Marker coordinate={{ latitude: restaurant!.lat!, longitude: restaurant!.lng! }} title="Nhà hàng" pinColor="#EA580C" /><Marker coordinate={{ latitude: destination.lat!, longitude: destination.lng! }} title="Khách hàng" pinColor="#2563EB" /></MapView> : null}
    {order.orderStatus === "pending" ? <Text style={styles.notice}>Đã nhận đơn. Chờ nhà hàng xác nhận và chuẩn bị món trước khi đến lấy.</Text> : null}
    <SecondaryButton label="Chỉ đường đến quán" onPress={openRestaurantNavigation} />
    {action ? <PrimaryButton label={action} disabled={working} onPress={onAdvance} /> : null}
  </ScrollView>;
}

const walletTransactionLabel: Record<string, string> = {
  shipper_deposit_top_up: "Nạp ký quỹ", shipper_online_delivery_earnings: "Thu nhập giao hàng",
  shipper_cod_collection: "Thu COD", shipper_closure_earnings_offset: "Đối trừ khi huỷ tài khoản",
  shipper_closure_deposit_refund: "Hoàn ký quỹ",
};

function AccountScreen({ user, profile, wallet, transactions, report, walletLoading, working, isWorking, onToggle, onRefresh, onTopUp }: { user?: User; profile?: Profile; wallet?: WalletSummary; transactions: WalletTransaction[]; report?: EarningsReport; walletLoading: boolean; working: boolean; isWorking: boolean; onToggle: () => void; onRefresh: () => void; onTopUp: (amount: number) => void }) {
  const [view, setView] = useState<"menu" | "overview" | "deposit" | "transactions" | "report" | "deposit-history" | "profile">("menu");
  const [depositAmount, setDepositAmount] = useState("");
  const online = profile?.status !== "offline";
  const minimumDeposit = wallet?.depositBalance === 0 ? 350000 : 1;
  const depositHistory = transactions.filter((transaction) => transaction.transactionType === "shipper_deposit_top_up");
  const submitDeposit = () => {
    const amount = Number(depositAmount.replace(/[^0-9]/g, ""));
    if (!Number.isSafeInteger(amount) || amount < minimumDeposit) return Alert.alert("Số tiền chưa hợp lệ", minimumDeposit === 350000 ? "Lần nạp ký quỹ đầu tiên tối thiểu là 350.000 ₫." : "Hãy nhập số tiền nạp lớn hơn 0.");
    onTopUp(amount);
  };
  const detailTitle = view === "deposit" ? "Nạp ký quỹ" : view === "transactions" ? "Giao dịch" : view === "report" ? "Báo cáo thu nhập" : view === "profile" ? "Hồ sơ Shipper" : "Lịch sử nạp tiền";
  if (view !== "menu" && view !== "overview") return <ScrollView contentContainerStyle={styles.list}><Pressable accessibilityRole="button" onPress={() => setView("menu")}><Text style={styles.backLink}>‹ Menu</Text></Pressable><Text style={styles.screenTitle}>{detailTitle}</Text>{view === "profile" ? <View style={styles.panel}><Text style={styles.cardTitle}>{user?.name || "Shipper"}</Text><Text style={styles.muted}>{user?.email}</Text><Text style={styles.muted}>Phương tiện: {profile?.vehicleType || "motorbike"}</Text><Text style={styles.muted}>Trạng thái hồ sơ: {profile?.approvalStatus === "approved" ? "Đã duyệt" : "Chờ duyệt"}</Text></View> : null}{view === "deposit" ? <View style={styles.panel}><Text style={styles.cardTitle}>Tài khoản ký quỹ</Text><Text style={styles.walletAmount}>{formatVnd(wallet?.depositBalance)}</Text><Text style={styles.muted}>Ký quỹ không âm và xác định hạn mức nhận đơn COD.</Text><View style={styles.depositForm}><Text style={styles.fieldLabel}>Số tiền nạp</Text><TextInput accessibilityLabel="Số tiền nạp ký quỹ" style={styles.input} keyboardType="number-pad" value={depositAmount} onChangeText={setDepositAmount} placeholder={minimumDeposit === 350000 ? "Tối thiểu 350.000 ₫" : "Số tiền VND"} /><PrimaryButton label="Nạp qua PayOS" onPress={submitDeposit} disabled={working || walletLoading} /></View></View> : null}{view === "report" ? <><View style={styles.panel}><Text style={styles.muted}>Tổng thu nhập từ đơn thanh toán online đã giao thành công</Text><Text style={styles.walletAmount}>{formatVnd(report?.totalEarned)}</Text></View><Text style={styles.sectionTitle}>Theo ngày</Text>{report?.daily.map((entry) => <ReportRow key={`day-${entry.period}`} label={entry.period.split("-").reverse().join("/")} amount={entry.amount} deliveries={entry.deliveries} />)}{!walletLoading && !report?.daily.length ? <Text style={styles.muted}>Chưa có thu nhập giao hàng.</Text> : null}<Text style={styles.sectionTitle}>Theo tháng</Text>{report?.monthly.map((entry) => <ReportRow key={`month-${entry.period}`} label={entry.period.split("-").reverse().join("/")} amount={entry.amount} deliveries={entry.deliveries} />)}</> : null}{view === "transactions" ? <TransactionList transactions={transactions} empty="Chưa có giao dịch ví." /> : null}{view === "deposit-history" ? <TransactionList transactions={depositHistory} empty="Chưa có giao dịch nạp ký quỹ." /> : null}</ScrollView>;
  if (view === "menu") return <ScrollView contentContainerStyle={styles.profileMenu}><View style={styles.profileHeader}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(user?.name || "S").trim().charAt(0).toUpperCase()}</Text></View><Text style={styles.profileName}>{user?.name || "Shipper"}</Text><Text style={styles.muted}>{user?.email}</Text></View><View style={styles.profileMenuList}><View style={styles.profileActivityRow}><View><Text style={styles.profileMenuTitle}>Trạng thái hoạt động</Text><Text style={styles.muted}>{online ? "Đang sẵn sàng nhận đơn" : "Đang ngoại tuyến"}</Text></View><Switch accessibilityLabel="Trạng thái hoạt động" value={online} disabled={working || isWorking} onValueChange={onToggle} trackColor={{ false: "#CBD5E1", true: "#86EFAC" }} thumbColor={online ? "#16A34A" : "#F8FAFC"} /></View><WalletMenuRow title="Hồ sơ của tôi" onPress={() => setView("profile")} /><WalletMenuRow title="Ví" subtitle={(wallet?.isEarlyWarning || wallet?.isAcceptanceLocked) ? "Cần chú ý số dư earnings" : undefined} onPress={() => setView("overview")} /><WalletMenuRow title="Thu nhập" onPress={() => setView("report")} /><WalletMenuRow title="Giao dịch" onPress={() => setView("transactions")} /></View>{isWorking ? <Text style={styles.notice}>Bạn không thể tắt hoạt động khi còn đơn được giao.</Text> : null}</ScrollView>;
  return <ScrollView contentContainerStyle={styles.walletPage}><Pressable accessibilityRole="button" onPress={() => setView("menu")}><Text style={styles.walletBackLink}>‹ Menu</Text></Pressable><View style={styles.walletHero}><Text style={styles.walletHeroTitle}>Ví của tôi</Text><Text style={styles.walletHeroLabel}>Tài khoản chính</Text><Text style={[styles.walletHeroAmount, (wallet?.earningsBalance || 0) < 0 && styles.walletHeroDebt]}>{walletLoading ? "Đang tải…" : formatVnd(wallet?.earningsBalance)}</Text><View style={styles.walletActionBar}><Pressable accessibilityRole="button" style={styles.walletAction} onPress={() => setView("deposit")}><Text style={styles.walletActionIcon}>⊕</Text><Text style={styles.walletActionText}>Nạp tiền</Text></Pressable><View style={styles.walletDivider} /><Pressable accessibilityRole="button" style={styles.walletAction} onPress={() => Alert.alert("Chưa khả dụng", "Chưa có nghiệp vụ rút tiền từ ví earnings được thiết lập.")}><Text style={styles.walletActionIcon}>⇧</Text><Text style={styles.walletActionText}>Rút tiền</Text></Pressable></View></View><View style={styles.walletMenu}><WalletMenuRow title="Tài khoản ký quỹ" value={formatVnd(wallet?.depositBalance)} subtitle={(wallet?.depositBalance || 0) < 350000 ? "Số dư thấp" : undefined} onPress={() => setView("deposit")} /><WalletMenuRow title="Giao dịch" onPress={() => setView("transactions")} /><WalletMenuRow title="Báo cáo thu nhập" onPress={() => setView("report")} /><WalletMenuRow title="Lịch sử nạp & rút tiền" onPress={() => setView("deposit-history")} /></View><View style={styles.list}>{wallet ? <View style={[styles.walletStatus, wallet.isAcceptanceLocked ? styles.walletLocked : wallet.isEarlyWarning ? styles.walletWarning : styles.walletSafe]}><Text style={styles.cardTitle}>{wallet.isAcceptanceLocked ? "Đã khoá nhận đơn mới" : wallet.isEarlyWarning ? "Cảnh báo số dư earnings" : "Số dư an toàn"}</Text><Text style={styles.muted}>Ngưỡng cảnh báo: {formatVnd(wallet.warningThreshold)} · ngưỡng khoá: {formatVnd(wallet.lockThreshold)}</Text>{(wallet.reservedCodLiability || 0) > 0 ? <Text style={styles.walletReserve}>Đang giữ cho COD: {formatVnd(wallet.reservedCodLiability)}</Text> : null}</View> : null}<SecondaryButton label="Làm mới số dư" onPress={onRefresh} disabled={working} /></View></ScrollView>;
}

function WalletMenuRow({ title, value, subtitle, onPress }: { title: string; value?: string; subtitle?: string; onPress: () => void }) { return <Pressable accessibilityRole="button" style={styles.walletMenuRow} onPress={onPress}><View><Text style={styles.walletMenuTitle}>{title}</Text>{subtitle ? <Text style={styles.walletMenuWarning}>{subtitle}</Text> : null}</View><View style={styles.walletMenuRight}>{value ? <Text style={styles.walletMenuValue}>{value}</Text> : null}<Text style={styles.walletChevron}>›</Text></View></Pressable>; }
function ReportRow({ label, amount, deliveries }: { label: string; amount: number; deliveries: number }) { return <View style={styles.transactionRow}><View><Text style={styles.transactionTitle}>{label}</Text><Text style={styles.hint}>{deliveries} đơn hoàn thành</Text></View><Text style={styles.transactionAmount}>{formatVnd(amount)}</Text></View>; }
function TransactionList({ transactions, empty }: { transactions: WalletTransaction[]; empty: string }) { return <View style={styles.panel}>{transactions.map((transaction) => <View key={transaction._id} style={styles.transactionRow}><View><Text style={styles.transactionTitle}>{walletTransactionLabel[transaction.transactionType] || transaction.transactionType}</Text><Text style={styles.hint}>{formatVietnamDate(transaction.createdAt)}</Text></View><Text style={[styles.transactionAmount, transaction.amount < 0 && styles.walletDebt]}>{transaction.amount > 0 ? "+" : ""}{formatVnd(transaction.amount)}</Text></View>)}{transactions.length === 0 ? <Text style={styles.muted}>{empty}</Text> : null}</View>; }

function OrderCard({ order, action, working, onPress }: { order: Order; action?: string; working: boolean; onPress?: () => void }) { const isCod = order.paymentMethod === "COD"; const deliveryEarning = Math.round(order.shippingPrice * 0.85); return <View style={styles.card}><Text style={styles.cardTitle}>#{order._id.slice(-6).toUpperCase()} · {order.orderStatus}</Text><Text style={styles.muted}>{order.restaurantId?.name || "Nhà hàng"}</Text><Text>{order.restaurantId?.address}</Text><Text style={styles.sectionTitle}>Giao đến</Text><Text>{order.shippingAddress.fullName} · {order.shippingAddress.phone}</Text><Text>{[order.shippingAddress.address, order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")}</Text><Text style={styles.sectionTitle}>Món</Text>{order.orderItems.map((item, index) => <Text key={`${item.name}-${index}`}>• {item.name} × {item.quantity}{item.note ? ` · ${item.note}` : ""}</Text>)}<Text style={styles.price}>{isCod ? `Thu COD: ${formatVnd(order.totalPrice)}` : `Thu nhập phí giao: ${formatVnd(deliveryEarning)}`}</Text>{action && onPress ? <PrimaryButton label={action} disabled={working} onPress={onPress} /> : null}</View>; }

function BottomNav({ active, onChange, hasDelivery }: { active: "offers" | "delivery" | "account"; onChange: (tab: "offers" | "delivery" | "account") => void; hasDelivery: boolean }) { return <View style={styles.bottomNav}>{([ ["offers", "Đơn gần bạn"], ["delivery", hasDelivery ? "Đơn đang giao" : "Đơn giao"], ["account", "Menu"] ] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active === key }} style={[styles.navItem, active === key && styles.navItemActive]} onPress={() => onChange(key)}><Text style={[styles.navLabel, active === key && styles.navLabelActive]}>{label}</Text></Pressable>)}</View>; }
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" style={[styles.secondaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function FormField({ label, value, placeholder, keyboardType, secure, onChange }: { label: string; value: string; placeholder: string; keyboardType?: "default" | "email-address" | "phone-pad"; secure?: boolean; onChange: (value: string) => void }) { return <View style={styles.formField}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} placeholder={placeholder} autoCapitalize={keyboardType === "email-address" || secure ? "none" : "words"} keyboardType={keyboardType} secureTextEntry={secure} value={value} onChangeText={onChange} /></View>; }
function Loading() { return <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>; }
export default function App() { return <QueryClientProvider client={queryClient}><ShipperApp /></QueryClientProvider>; }

const styles = StyleSheet.create({
  profileMenu: { padding: 24, paddingBottom: 100, gap: 22, backgroundColor: "#FFF" },
  profileHeader: { alignItems: "center", gap: 8, paddingTop: 18 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#FED7AA", justifyContent: "center", alignItems: "center" },
  profileAvatarText: { color: "#C2410C", fontSize: 36, fontWeight: "800" },
  profileName: { color: "#172554", fontSize: 29, fontWeight: "800" },
  profileMenuList: { gap: 2 },
  profileActivityRow: { minHeight: 82, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  profileMenuTitle: { color: "#172554", fontSize: 20, fontWeight: "800" },
  activityBar: { marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  activityTitle: { color: "#172554", fontSize: 16, fontWeight: "800" },
  walletBackLink: { color: "#1D4ED8", fontSize: 16, fontWeight: "800", paddingHorizontal: 18, paddingTop: 14 },
  safe: { flex: 1, backgroundColor: "#EFF6FF" }, login: { flex: 1, backgroundColor: "#EFF6FF" }, authForm: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 }, formField: { gap: 6 }, fieldLabel: { color: "#1E3A8A", fontWeight: "700" }, header: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#BFDBFE", backgroundColor: "#FFF" }, brand: { color: "#1E40AF", fontSize: 21, fontWeight: "800" }, subtitle: { color: "#475569", fontSize: 16, lineHeight: 24, marginBottom: 8 }, list: { padding: 18, gap: 12, paddingBottom: 100 }, walletPage: { paddingBottom: 100, gap: 14, backgroundColor: "#F1F5F9" }, center: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "#EFF6FF" }, screenTitle: { color: "#1E3A8A", fontSize: 24, fontWeight: "800" }, sectionTitle: { color: "#1E3A8A", fontSize: 15, fontWeight: "800", marginTop: 6 }, cardTitle: { color: "#172554", fontSize: 16, fontWeight: "800" }, muted: { color: "#475569", lineHeight: 20 }, hint: { color: "#64748B", fontSize: 12, lineHeight: 18 }, link: { color: "#2563EB", fontWeight: "800", padding: 10 }, backLink: { color: "#1D4ED8", fontSize: 16, fontWeight: "800" }, input: { minHeight: 48, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, paddingHorizontal: 12, backgroundColor: "#FFF", fontSize: 16 }, primaryButton: { minHeight: 48, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#2563EB", marginTop: 6 }, primaryButtonText: { color: "#FFF", fontWeight: "800", textAlign: "center" }, secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: "#2563EB", alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 12, marginTop: 6 }, secondaryButtonText: { color: "#1D4ED8", fontWeight: "800" }, disabled: { opacity: 0.48 }, error: { color: "#B91C1C", lineHeight: 20 }, locationAlert: { marginTop: 10, gap: 4 }, emptyText: { textAlign: "center", color: "#64748B", marginTop: 36 }, card: { borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, backgroundColor: "#FFF", padding: 14, gap: 5 }, price: { color: "#C2410C", fontWeight: "800", fontSize: 16, marginTop: 6 }, panel: { borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, padding: 14, gap: 7, backgroundColor: "#FFF" }, depositForm: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 12, marginTop: 6, gap: 4 }, walletAmount: { color: "#1D4ED8", fontSize: 25, fontWeight: "800" }, walletHero: { backgroundColor: "#FF5B39", paddingTop: 28, paddingHorizontal: 24, paddingBottom: 22, alignItems: "center", gap: 8 }, walletHeroTitle: { alignSelf: "stretch", color: "#FFF", fontSize: 29, fontWeight: "800" }, walletHeroLabel: { color: "#FFF", fontSize: 16, marginTop: 14 }, walletHeroAmount: { color: "#FFF", fontSize: 37, fontWeight: "800" }, walletHeroDebt: { color: "#FFF" }, walletActionBar: { flexDirection: "row", alignSelf: "stretch", backgroundColor: "#FFF", borderRadius: 15, marginTop: 24, paddingVertical: 13 }, walletAction: { flex: 1, alignItems: "center", gap: 3 }, walletActionIcon: { color: "#F14B32", fontSize: 31, fontWeight: "700" }, walletActionText: { color: "#F14B32", fontSize: 16, fontWeight: "700" }, walletDivider: { width: 1, backgroundColor: "#E2E8F0", marginVertical: 6 }, walletMenu: { backgroundColor: "#FFF" }, walletMenuRow: { minHeight: 78, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }, walletMenuTitle: { color: "#172554", fontSize: 18, fontWeight: "700" }, walletMenuRight: { flexDirection: "row", alignItems: "center", gap: 12 }, walletMenuValue: { color: "#172554", fontSize: 16, fontWeight: "800" }, walletMenuWarning: { color: "#E11D48", marginTop: 3 }, walletChevron: { color: "#94A3B8", fontSize: 30, lineHeight: 30 }, walletDebt: { color: "#B91C1C" }, walletReserve: { color: "#9A3412", fontWeight: "700" }, walletStatus: { borderLeftWidth: 4, borderRadius: 10, padding: 14, gap: 5 }, walletSafe: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" }, walletWarning: { borderColor: "#EA580C", backgroundColor: "#FFF7ED" }, walletLocked: { borderColor: "#DC2626", backgroundColor: "#FEF2F2" }, transactionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 10, marginTop: 3, gap: 10 }, transactionTitle: { color: "#334155", fontWeight: "700", flexShrink: 1 }, transactionAmount: { color: "#15803D", fontWeight: "800" }, notice: { borderLeftWidth: 4, borderColor: "#EA580C", backgroundColor: "#FFF7ED", color: "#7C2D12", padding: 12, lineHeight: 20 }, map: { height: 280, borderRadius: 12 }, bottomNav: { minHeight: 68, flexDirection: "row", backgroundColor: "#FFF", borderTopWidth: 1, borderColor: "#BFDBFE" }, navItem: { flex: 1, minHeight: 56, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 }, navItemActive: { borderTopWidth: 3, borderColor: "#2563EB" }, navLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", textAlign: "center" }, navLabelActive: { color: "#1D4ED8" },
});
