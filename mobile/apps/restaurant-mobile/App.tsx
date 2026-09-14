import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { io } from "socket.io-client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:4000").replace(/\/$/, "");
const TOKEN_KEY = "restaurantAccessToken";
const queryClient = new QueryClient();

type Tab = "overview" | "orders" | "menu" | "account";
type User = { name: string; email: string; role: string; restaurantId?: string };
type Restaurant = { _id: string; name: string; address?: string; phone?: string; email?: string; description?: string; isOpen?: boolean };
type Food = { _id: string; name: string; description: string; price: number; category: string; image?: string };
type OrderStatus = "pending" | "preparing" | "delivering" | "delivered" | "cancelled";
type Order = { _id: string; orderStatus: OrderStatus; deliveryMethod: "drone" | "shipper"; totalPrice: number; createdAt: string; shippingAddress: { fullName: string; phone: string; address: string; city: string; state: string }; orderItems: { name: string; quantity: number; selectedOptions?: { groupName: string; optionName: string }[]; note?: string }[]; reason?: string };
type DraftFood = { id?: string; name: string; description: string; price: string; category: string; image?: ImagePicker.ImagePickerAsset | null; existingImage?: string };

const emptyFood = (): DraftFood => ({ name: "", description: "", price: "", category: "", image: null });
const formatVnd = (value = 0) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });
const apiError = (error: unknown, fallback = "Có lỗi xảy ra") => axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;
const statusText: Record<OrderStatus, string> = { pending: "Chờ xác nhận", preparing: "Đang chuẩn bị", delivering: "Đang giao", delivered: "Đã giao", cancelled: "Đã hủy" };

function RestaurantApp() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [working, setWorking] = useState(false);
  const [foodDraft, setFoodDraft] = useState<DraftFood | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => { SecureStore.getItemAsync(TOKEN_KEY).then(setToken); }, []);
  const user = useQuery({ queryKey: ["restaurant-user", token], enabled: Boolean(token), queryFn: async () => (await axios.get<{ data: User }>(`${API_URL}/api/user/me`, { headers: authHeaders(token!) })).data.data });
  const restaurant = useQuery({ queryKey: ["restaurant-profile", token, user.data?.restaurantId], enabled: Boolean(token && user.data?.restaurantId), queryFn: async () => (await axios.get<{ data: Restaurant }>(`${API_URL}/api/restaurant/${user.data!.restaurantId}`, { headers: authHeaders(token!) })).data.data });
  const orders = useQuery({ queryKey: ["restaurant-orders", token], enabled: Boolean(token), queryFn: async () => (await axios.get<{ data: Order[] }>(`${API_URL}/api/order/list`, { headers: authHeaders(token!) })).data.data || [], refetchInterval: 30000 });
  const foods = useQuery({ queryKey: ["restaurant-foods", token], enabled: Boolean(token), queryFn: async () => (await axios.get<{ data: Food[] }>(`${API_URL}/api/food/list`, { headers: authHeaders(token!) })).data.data || [] });
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["restaurant-profile", token] }), queryClient.invalidateQueries({ queryKey: ["restaurant-orders", token] }), queryClient.invalidateQueries({ queryKey: ["restaurant-foods", token] })]); };

  useEffect(() => {
    if (!token || !user.data?.restaurantId) return undefined;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("joinRestaurant", user.data?.restaurantId));
    socket.on("newOrder", () => { queryClient.invalidateQueries({ queryKey: ["restaurant-orders", token] }); setTab("orders"); });
    return () => { socket.disconnect(); };
  }, [token, user.data?.restaurantId]);

  const login = async () => {
    try {
      setWorking(true); setLoginError("");
      const response = await axios.post(`${API_URL}/api/user/login`, { email: email.trim(), password });
      if (response.data.role !== "restaurant_owner") throw new Error("Tài khoản này không phải tài khoản Nhà hàng.");
      await SecureStore.setItemAsync(TOKEN_KEY, response.data.token); setToken(response.data.token);
    } catch (error) { setLoginError(apiError(error, error instanceof Error ? error.message : "Đăng nhập thất bại")); }
    finally { setWorking(false); }
  };
  const logout = async () => { await SecureStore.deleteItemAsync(TOKEN_KEY); queryClient.clear(); setToken(null); setTab("overview"); };
  const toggleOpen = async () => {
    if (!token || !restaurant.data || working) return;
    try { setWorking(true); await axios.patch(`${API_URL}/api/restaurant/${restaurant.data._id}/open-state`, { isOpen: restaurant.data.isOpen === false }, { headers: authHeaders(token) }); await refresh(); }
    catch (error) { Alert.alert("Không thể đổi trạng thái", apiError(error)); }
    finally { setWorking(false); }
  };
  const updateOrder = async (order: Order, status: "preparing" | "delivering" | "cancelled", reason = "") => {
    if (!token) return;
    try { setWorking(true); await axios.post(`${API_URL}/api/order/status`, { orderId: order._id, status, ...(reason && { reason }) }, { headers: authHeaders(token) }); await refresh(); }
    catch (error) { Alert.alert("Không thể cập nhật đơn", apiError(error)); }
    finally { setWorking(false); }
  };
  const confirmCancel = async () => {
    if (!cancelOrder || !cancelReason.trim()) return Alert.alert("Cần lý do", "Hãy ghi lý do hủy đơn để thông báo rõ cho khách hàng.");
    await updateOrder(cancelOrder, "cancelled", cancelReason.trim()); setCancelOrder(null); setCancelReason("");
  };
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Cần quyền ảnh", "Hãy cho phép truy cập thư viện ảnh để đăng món.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setFoodDraft((current) => current ? { ...current, image: result.assets[0] } : current);
  };
  const saveFood = async () => {
    if (!token || !foodDraft) return;
    const price = Number(foodDraft.price);
    if (!foodDraft.name.trim() || !foodDraft.description.trim() || !foodDraft.category.trim() || !Number.isInteger(price) || price <= 0) return Alert.alert("Thông tin món chưa hợp lệ", "Tên, mô tả, danh mục và giá VND nguyên dương là bắt buộc.");
    if (!foodDraft.id && !foodDraft.image) return Alert.alert("Thiếu ảnh món", "Món mới cần một ảnh để hiển thị cho khách hàng.");
    try {
      setWorking(true);
      const body = new FormData();
      if (foodDraft.id) body.append("id", foodDraft.id);
      body.append("name", foodDraft.name.trim()); body.append("description", foodDraft.description.trim()); body.append("price", String(price)); body.append("category", foodDraft.category.trim());
      if (foodDraft.image) body.append("image", { uri: foodDraft.image.uri, type: foodDraft.image.mimeType || "image/jpeg", name: foodDraft.image.fileName || "food.jpg" } as unknown as Blob);
      const url = foodDraft.id ? `${API_URL}/api/food/update` : `${API_URL}/api/food/add`;
      await axios.post(url, body, { headers: { ...authHeaders(token), "Content-Type": "multipart/form-data" } });
      setFoodDraft(null); await refresh();
    } catch (error) { Alert.alert("Không thể lưu món", apiError(error)); }
    finally { setWorking(false); }
  };
  const removeFood = (food: Food) => Alert.alert("Xóa món", `Xóa “${food.name}” khỏi thực đơn?`, [{ text: "Giữ lại", style: "cancel" }, { text: "Xóa", style: "destructive", onPress: async () => { if (!token) return; try { setWorking(true); await axios.post(`${API_URL}/api/food/remove`, { id: food._id }, { headers: authHeaders(token) }); await refresh(); } catch (error) { Alert.alert("Không thể xóa món", apiError(error)); } finally { setWorking(false); } } }]);

  if (!token) return <LoginScreen email={email} password={password} error={loginError} working={working} onEmail={setEmail} onPassword={setPassword} onLogin={login} />;
  if (user.isLoading || (user.data?.restaurantId && restaurant.isLoading)) return <Loading />;
  if (user.data?.role !== "restaurant_owner" || !user.data.restaurantId) return <SafeAreaView style={styles.center}><Text style={styles.error}>Tài khoản chưa liên kết với Nhà hàng.</Text><PrimaryButton label="Đăng xuất" onPress={logout} /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.header}><View><Text style={styles.brand}>{restaurant.data?.name || "Drone Food Restaurant"}</Text><Text style={styles.muted}>{restaurant.data?.isOpen === false ? "Đang đóng cửa" : "Đang nhận đơn"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Đăng xuất" onPress={logout}><Text style={styles.link}>Thoát</Text></Pressable></View>
    {tab === "overview" && <OverviewScreen restaurant={restaurant.data} orders={orders.data || []} foods={foods.data || []} working={working} onToggleOpen={toggleOpen} onOrders={() => setTab("orders")} />}
    {tab === "orders" && <OrdersScreen orders={orders.data || []} loading={orders.isLoading} working={working} onRefresh={refresh} onPreparing={(order) => updateOrder(order, "preparing")} onDroneHandover={(order) => updateOrder(order, "delivering")} onCancel={(order) => { setCancelOrder(order); setCancelReason(""); }} />}
    {tab === "menu" && <MenuScreen foods={foods.data || []} loading={foods.isLoading} working={working} onRefresh={refresh} onAdd={() => setFoodDraft(emptyFood())} onEdit={(food) => setFoodDraft({ id: food._id, name: food.name, description: food.description, price: String(food.price), category: food.category, existingImage: food.image })} onRemove={removeFood} />}
    {tab === "account" && <AccountScreen restaurant={restaurant.data} onToggleOpen={toggleOpen} working={working} />}
    <BottomNav active={tab} onChange={setTab} pending={(orders.data || []).filter((order) => order.orderStatus === "pending").length} />
    <FoodEditor draft={foodDraft} working={working} onClose={() => setFoodDraft(null)} onChange={setFoodDraft} onPickImage={pickImage} onSave={saveFood} />
    <CancelModal order={cancelOrder} reason={cancelReason} working={working} onReason={setCancelReason} onClose={() => setCancelOrder(null)} onConfirm={confirmCancel} />
  </SafeAreaView>;
}

function LoginScreen({ email, password, error, working, onEmail, onPassword, onLogin }: { email: string; password: string; error: string; working: boolean; onEmail: (value: string) => void; onPassword: (value: string) => void; onLogin: () => void }) { return <SafeAreaView style={styles.login}><Text style={styles.brand}>Drone Food Restaurant</Text><Text style={styles.subtitle}>Quản lý đơn hàng và thực đơn ngay trên điện thoại.</Text><Field value={email} placeholder="Email" keyboardType="email-address" onChange={onEmail} /><Field value={password} placeholder="Mật khẩu" secure onChange={onPassword} /><PrimaryButton label="Đăng nhập" disabled={working} onPress={onLogin} />{error ? <Text style={styles.error}>{error}</Text> : null}</SafeAreaView>; }

function OverviewScreen({ restaurant, orders, foods, working, onToggleOpen, onOrders }: { restaurant?: Restaurant; orders: Order[]; foods: Food[]; working: boolean; onToggleOpen: () => void; onOrders: () => void }) { const today = new Date().toDateString(); const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today); const revenue = todayOrders.filter((order) => order.orderStatus !== "cancelled").reduce((total, order) => total + order.totalPrice, 0); const needsAction = orders.filter((order) => ["pending", "preparing"].includes(order.orderStatus)).length; return <ScrollView contentContainerStyle={styles.list}><Text style={styles.screenTitle}>Tổng quan hôm nay</Text><View style={styles.openCard}><View><Text style={styles.cardTitle}>{restaurant?.isOpen === false ? "Quán đang đóng" : "Quán đang mở"}</Text><Text style={styles.muted}>{restaurant?.isOpen === false ? "Khách hàng không thể đặt đơn mới." : "Khách hàng đang nhìn thấy quán của bạn."}</Text></View><PrimaryButton label={restaurant?.isOpen === false ? "Mở quán" : "Đóng quán"} disabled={working} onPress={onToggleOpen} /></View><View style={styles.metrics}><Metric label="Đơn hôm nay" value={String(todayOrders.length)} /><Metric label="Doanh thu đơn" value={formatVnd(revenue)} /><Metric label="Cần xử lý" value={String(needsAction)} /><Metric label="Món đang bán" value={String(foods.length)} /></View><View style={styles.panel}><Text style={styles.cardTitle}>Đơn cần xử lý</Text><Text style={styles.muted}>{needsAction ? `Có ${needsAction} đơn đang chờ xác nhận hoặc chuẩn bị.` : "Không có đơn nào cần xử lý ngay."}</Text><PrimaryButton label="Quản lý đơn" onPress={onOrders} /></View></ScrollView>; }

function OrdersScreen({ orders, loading, working, onRefresh, onPreparing, onDroneHandover, onCancel }: { orders: Order[]; loading: boolean; working: boolean; onRefresh: () => void; onPreparing: (order: Order) => void; onDroneHandover: (order: Order) => void; onCancel: (order: Order) => void }) { if (loading) return <Loading />; const sorted = [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); return <FlatList contentContainerStyle={styles.list} data={sorted} keyExtractor={(item) => item._id} onRefresh={onRefresh} refreshing={loading} ListHeaderComponent={<><Text style={styles.screenTitle}>Đơn hàng</Text><Text style={styles.muted}>Đơn mới tự xuất hiện khi khách đặt hàng.</Text></>} ListEmptyComponent={<Text style={styles.emptyText}>Chưa có đơn hàng.</Text>} renderItem={({ item }) => <OrderCard order={item} working={working} onPreparing={onPreparing} onDroneHandover={onDroneHandover} onCancel={onCancel} />} />; }

function OrderCard({ order, working, onPreparing, onDroneHandover, onCancel }: { order: Order; working: boolean; onPreparing: (order: Order) => void; onDroneHandover: (order: Order) => void; onCancel: (order: Order) => void }) { const canCancel = order.orderStatus === "pending" || order.orderStatus === "preparing"; return <View style={styles.card}><View style={styles.orderHeading}><Text style={styles.cardTitle}>#{order._id.slice(-6).toUpperCase()}</Text><Text style={[styles.status, styles[`status_${order.orderStatus}`]]}>{statusText[order.orderStatus]}</Text></View><Text>{order.shippingAddress.fullName} · {order.shippingAddress.phone}</Text><Text style={styles.muted}>{[order.shippingAddress.address, order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")}</Text><Text style={styles.sectionTitle}>Món đặt</Text>{order.orderItems.map((item, index) => <View key={`${item.name}-${index}`}><Text>• {item.name} × {item.quantity}</Text>{item.selectedOptions?.map((option) => <Text key={`${option.groupName}-${option.optionName}`} style={styles.hint}>  {option.groupName}: {option.optionName}</Text>)}{item.note ? <Text style={styles.hint}>  Ghi chú: {item.note}</Text> : null}</View>)}<Text style={styles.price}>{formatVnd(order.totalPrice)} · {order.deliveryMethod === "shipper" ? "Shipper" : "Drone"}</Text>{order.orderStatus === "pending" ? <PrimaryButton label="Xác nhận, bắt đầu chuẩn bị" disabled={working} onPress={() => onPreparing(order)} /> : null}{order.orderStatus === "preparing" && order.deliveryMethod === "drone" ? <PrimaryButton label="Bàn giao cho Drone" disabled={working} onPress={() => onDroneHandover(order)} /> : null}{order.orderStatus === "preparing" && order.deliveryMethod === "shipper" ? <Text style={styles.notice}>Đơn đã sẵn sàng. Chờ Shipper đã nhận đơn đến lấy hàng và tự xác nhận lấy hàng.</Text> : null}{canCancel ? <SecondaryButton label="Hủy đơn" disabled={working} danger onPress={() => onCancel(order)} /> : null}{order.reason ? <Text style={styles.error}>Lý do: {order.reason}</Text> : null}</View>; }

function MenuScreen({ foods, loading, working, onRefresh, onAdd, onEdit, onRemove }: { foods: Food[]; loading: boolean; working: boolean; onRefresh: () => void; onAdd: () => void; onEdit: (food: Food) => void; onRemove: (food: Food) => void }) { if (loading) return <Loading />; return <FlatList contentContainerStyle={styles.list} data={foods} keyExtractor={(item) => item._id} refreshing={loading} onRefresh={onRefresh} ListHeaderComponent={<><Text style={styles.screenTitle}>Thực đơn</Text><PrimaryButton label="Thêm món mới" onPress={onAdd} /></>} ListEmptyComponent={<Text style={styles.emptyText}>Chưa có món nào. Hãy thêm món đầu tiên.</Text>} renderItem={({ item }) => <View style={styles.foodCard}>{item.image ? <Image source={{ uri: item.image }} style={styles.foodImage} /> : <View style={styles.noImage}><Text style={styles.hint}>Chưa có ảnh</Text></View>}<View style={styles.foodBody}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.category}</Text><Text numberOfLines={2} style={styles.hint}>{item.description}</Text><Text style={styles.price}>{formatVnd(item.price)}</Text><View style={styles.inlineActions}><SecondaryButton label="Sửa" disabled={working} onPress={() => onEdit(item)} /><SecondaryButton label="Xóa" danger disabled={working} onPress={() => onRemove(item)} /></View></View></View>} />; }

function AccountScreen({ restaurant, working, onToggleOpen }: { restaurant?: Restaurant; working: boolean; onToggleOpen: () => void }) { return <ScrollView contentContainerStyle={styles.list}><Text style={styles.screenTitle}>Thông tin quán</Text><View style={styles.panel}><Text style={styles.cardTitle}>{restaurant?.name}</Text><Text>{restaurant?.address}</Text>{restaurant?.phone ? <Text>{restaurant.phone}</Text> : null}{restaurant?.email ? <Text>{restaurant.email}</Text> : null}{restaurant?.description ? <Text style={styles.muted}>{restaurant.description}</Text> : null}</View><PrimaryButton label={restaurant?.isOpen === false ? "Mở quán nhận đơn" : "Đóng quán tạm thời"} disabled={working} onPress={onToggleOpen} /></ScrollView>; }

function FoodEditor({ draft, working, onClose, onChange, onPickImage, onSave }: { draft: DraftFood | null; working: boolean; onClose: () => void; onChange: (draft: DraftFood | null) => void; onPickImage: () => void; onSave: () => void }) { if (!draft) return null; const image = draft.image?.uri || draft.existingImage; return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modal}><ScrollView contentContainerStyle={styles.modalContent}><Text style={styles.screenTitle}>{draft.id ? "Sửa món" : "Thêm món"}</Text>{image ? <Image source={{ uri: image }} style={styles.editorImage} /> : null}<SecondaryButton label={image ? "Đổi ảnh" : "Chọn ảnh món"} onPress={onPickImage} /><Field value={draft.name} placeholder="Tên món" onChange={(value) => onChange({ ...draft, name: value })} /><Field value={draft.description} placeholder="Mô tả món" multiline onChange={(value) => onChange({ ...draft, description: value })} /><Field value={draft.category} placeholder="Danh mục" onChange={(value) => onChange({ ...draft, category: value })} /><Field value={draft.price} placeholder="Giá VND (ví dụ 45000)" keyboardType="numeric" onChange={(value) => onChange({ ...draft, price: value })} /><Text style={styles.hint}>Các tuỳ chọn món nâng cao hiện vẫn quản lý trên web; app này lưu đầy đủ thông tin cơ bản của món.</Text><PrimaryButton label={draft.id ? "Lưu thay đổi" : "Đăng món"} disabled={working} onPress={onSave} /><SecondaryButton label="Đóng" disabled={working} onPress={onClose} /></ScrollView></View></View></Modal>; }

function CancelModal({ order, reason, working, onReason, onClose, onConfirm }: { order: Order | null; reason: string; working: boolean; onReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) { if (!order) return null; return <Modal transparent visible animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.dialog}><Text style={styles.cardTitle}>Hủy đơn #{order._id.slice(-6).toUpperCase()}</Text><Text style={styles.muted}>Lý do sẽ được gửi cho khách hàng.</Text><Field value={reason} placeholder="Ví dụ: Hết món, quán quá tải..." multiline onChange={onReason} /><PrimaryButton label="Xác nhận hủy đơn" disabled={working} onPress={onConfirm} /><SecondaryButton label="Quay lại" disabled={working} onPress={onClose} /></View></View></Modal>; }

function BottomNav({ active, onChange, pending }: { active: Tab; onChange: (tab: Tab) => void; pending: number }) { return <View style={styles.bottomNav}>{([ ["overview", "Tổng quan"], ["orders", pending ? `Đơn (${pending})` : "Đơn"], ["menu", "Thực đơn"], ["account", "Quán"] ] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === active }} style={[styles.navItem, key === active && styles.navItemActive]} onPress={() => onChange(key)}><Text style={[styles.navLabel, key === active && styles.navLabelActive]}>{label}</Text></Pressable>)}</View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.hint}>{label}</Text></View>; }
function Field({ value, placeholder, keyboardType, secure, multiline, onChange }: { value: string; placeholder: string; keyboardType?: "default" | "email-address" | "numeric"; secure?: boolean; multiline?: boolean; onChange: (value: string) => void }) { return <TextInput accessibilityLabel={placeholder} style={[styles.input, multiline && styles.textarea]} placeholder={placeholder} autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"} keyboardType={keyboardType} secureTextEntry={secure} multiline={multiline} value={value} onChangeText={onChange} />; }
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) { return <Pressable accessibilityRole="button" style={[styles.secondaryButton, danger && styles.dangerButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}><Text style={[styles.secondaryText, danger && styles.dangerText]}>{label}</Text></Pressable>; }
function Loading() { return <View style={styles.center}><ActivityIndicator size="large" color="#EA580C" /></View>; }
export default function App() { return <QueryClientProvider client={queryClient}><RestaurantApp /></QueryClientProvider>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF7ED" }, login: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#FFF7ED" }, header: { minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#FED7AA", backgroundColor: "#FFF" }, brand: { color: "#9A3412", fontSize: 21, fontWeight: "800" }, subtitle: { color: "#57534E", fontSize: 16, lineHeight: 24, marginBottom: 8 }, list: { padding: 18, gap: 12, paddingBottom: 100 }, center: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "#FFF7ED" }, screenTitle: { color: "#7C2D12", fontSize: 24, fontWeight: "800" }, sectionTitle: { color: "#9A3412", fontSize: 15, fontWeight: "800", marginTop: 6 }, cardTitle: { color: "#431407", fontSize: 16, fontWeight: "800" }, muted: { color: "#57534E", lineHeight: 20 }, hint: { color: "#78716C", lineHeight: 18, fontSize: 12 }, link: { color: "#C2410C", fontWeight: "800", padding: 10 }, input: { minHeight: 48, borderWidth: 1, borderColor: "#FED7AA", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FFF", fontSize: 16, textAlignVertical: "top" }, textarea: { minHeight: 90 }, primaryButton: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#EA580C", marginTop: 6 }, primaryButtonText: { color: "#FFF", fontWeight: "800", textAlign: "center" }, secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: "#EA580C", borderRadius: 10, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", marginTop: 6 }, secondaryText: { color: "#C2410C", fontWeight: "800" }, dangerButton: { borderColor: "#DC2626" }, dangerText: { color: "#B91C1C" }, disabled: { opacity: 0.48 }, error: { color: "#B91C1C", lineHeight: 20 }, emptyText: { textAlign: "center", color: "#78716C", marginTop: 36 }, card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FED7AA", padding: 14, borderRadius: 12, gap: 5 }, orderHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, status: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontSize: 12, fontWeight: "800", overflow: "hidden" }, status_pending: { backgroundColor: "#FEF3C7", color: "#92400E" }, status_preparing: { backgroundColor: "#DBEAFE", color: "#1D4ED8" }, status_delivering: { backgroundColor: "#E0E7FF", color: "#4338CA" }, status_delivered: { backgroundColor: "#DCFCE7", color: "#15803D" }, status_cancelled: { backgroundColor: "#FEE2E2", color: "#B91C1C" }, price: { color: "#C2410C", fontSize: 16, fontWeight: "800", marginTop: 6 }, notice: { borderLeftWidth: 4, borderColor: "#EA580C", backgroundColor: "#FFF7ED", color: "#7C2D12", padding: 10, lineHeight: 20 }, openCard: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FED7AA", padding: 14, borderRadius: 12, gap: 8 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { width: "47%", minHeight: 88, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FED7AA", borderRadius: 12, justifyContent: "center", padding: 12, gap: 4 }, metricValue: { color: "#7C2D12", fontSize: 19, fontWeight: "800" }, panel: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FED7AA", borderRadius: 12, padding: 14, gap: 8 }, foodCard: { flexDirection: "row", backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FED7AA", borderRadius: 12, overflow: "hidden" }, foodImage: { width: 104, height: 144, backgroundColor: "#F5F5F4" }, noImage: { width: 104, height: 144, backgroundColor: "#F5F5F4", justifyContent: "center", alignItems: "center" }, foodBody: { flex: 1, padding: 12, gap: 4 }, inlineActions: { flexDirection: "row", gap: 8 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" }, modal: { maxHeight: "90%", backgroundColor: "#FFF7ED", borderTopLeftRadius: 22, borderTopRightRadius: 22 }, modalContent: { padding: 20, gap: 10 }, dialog: { margin: 20, padding: 20, gap: 10, borderRadius: 16, backgroundColor: "#FFF" }, editorImage: { height: 190, borderRadius: 12, backgroundColor: "#F5F5F4" }, bottomNav: { minHeight: 68, flexDirection: "row", backgroundColor: "#FFF", borderTopWidth: 1, borderColor: "#FED7AA" }, navItem: { flex: 1, minHeight: 56, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 }, navItemActive: { borderTopWidth: 3, borderColor: "#EA580C" }, navLabel: { color: "#78716C", fontSize: 11, fontWeight: "700", textAlign: "center" }, navLabelActive: { color: "#C2410C" },
});
