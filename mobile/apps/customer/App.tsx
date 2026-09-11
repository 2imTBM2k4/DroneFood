import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import MapView, { Marker, Polyline } from "react-native-maps";
import QRCode from "react-native-qrcode-svg";
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
const queryClient = new QueryClient();

type Restaurant = { _id: string; name: string; address: string; image?: string; lat?: number; lng?: number; isOpen?: boolean };
type Option = { name: string; priceDelta?: number };
type OptionGroup = { name: string; type: "single" | "multi"; required?: boolean; min?: number; max?: number; options: Option[] };
type Food = { _id: string; name: string; description: string; price: number; image?: string; optionGroups?: OptionGroup[] };
type CartLine = { lineKey: string; foodId: string; name: string; unitPrice: number; quantity: number; selectedOptions: { groupName: string; optionName: string; priceDelta: number }[] };
type Cart = { items: CartLine[]; subtotal: number };
type DeliveryMethod = "drone" | "shipper";
type Quote = { deliveryMethod: DeliveryMethod; billedDistanceKm: number; distanceType: "air" | "road"; ratePerKm: number; shippingPrice: number };
type Coordinates = { latitude: number; longitude: number };
type Order = {
  _id: string; orderStatus: string; totalPrice: number; shippingPrice: number; deliveryMethod: "drone" | "shipper"; createdAt: string;
  cancellationCode?: string; reason?: string; qrCode?: string; qrScanned?: boolean; cargoChecked?: boolean;
  shippingAddress?: { lat?: number; lng?: number }; restaurantId?: { name?: string; address?: string; lat?: number; lng?: number };
};
type Address = { fullName: string; address: string; city: string; state: string; country: string; zipCode: string; phone: string; lat: string; lng: string };
type UserProfile = { name: string; email: string; phone?: string; address?: Partial<{ fullName: string; address: string; city: string; state: string; country: string; zipCode: string; phone: string; lat: number | null; lng: number | null }> };

const defaultAddress: Address = { fullName: "", address: "", city: "", state: "", country: "Việt Nam", zipCode: "", phone: "", lat: "", lng: "" };
const formatVnd = (value = 0) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
const apiError = (cause: unknown, fallback = "Có lỗi xảy ra") => axios.isAxiosError(cause) ? cause.response?.data?.message || fallback : fallback;
const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });
const hasCoordinates = (lat?: number, lng?: number) => Number.isFinite(lat) && Number.isFinite(lng);
const NEARBY_RADIUS_KM = 15;
const haversineKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const formatDistance = (value: number) => value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`;
const toAddress = (user?: UserProfile): Address => ({
  fullName: user?.address?.fullName || user?.name || "", address: user?.address?.address || "", city: user?.address?.city || "", state: user?.address?.state || "", country: user?.address?.country || "Việt Nam", zipCode: user?.address?.zipCode || "", phone: user?.address?.phone || user?.phone || "", lat: user?.address?.lat == null ? "" : String(user.address.lat), lng: user?.address?.lng == null ? "" : String(user.address.lng),
});

function CustomerApp() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [screen, setScreen] = useState<"restaurants" | "menu" | "cart" | "checkout" | "orders" | "track" | "profile">("restaurants");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [optionPicks, setOptionPicks] = useState<Record<string, string[]>>({});
  const [address, setAddress] = useState<Address>(defaultAddress);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("shipper");
  const [deliveryQuotes, setDeliveryQuotes] = useState<Partial<Record<DeliveryMethod, Quote>>>({});
  const [quoting, setQuoting] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [profileName, setProfileName] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => { SecureStore.getItemAsync("accessToken").then(setToken); }, []);

  const restaurants = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => (await axios.get<{ data: Restaurant[] }>(`${API_URL}/api/restaurant/list`)).data.data || [],
    enabled: Boolean(token),
  });
  const foods = useQuery({
    queryKey: ["foods", restaurant?._id],
    queryFn: async () => (await axios.get<{ data: Food[] }>(`${API_URL}/api/food/list`, { params: { restaurantId: restaurant?._id } })).data.data || [],
    enabled: Boolean(token && restaurant),
  });
  const profile = useQuery({
    queryKey: ["profile", token],
    queryFn: async () => (await axios.get<{ data: UserProfile }>(`${API_URL}/api/user/me`, { headers: authHeaders(token!) })).data.data,
    enabled: Boolean(token),
  });
  const cart = useQuery({
    queryKey: ["cart", token],
    queryFn: async () => (await axios.get<Cart>(`${API_URL}/api/cart/get`, { headers: authHeaders(token!) })).data,
    enabled: Boolean(token),
  });
  const orders = useQuery({
    queryKey: ["orders", token],
    queryFn: async () => (await axios.get<{ data: Order[] }>(`${API_URL}/api/order/userorders`, { headers: authHeaders(token!) })).data.data || [],
    enabled: Boolean(token && (screen === "orders" || screen === "track")),
    // Socket is the fast path; polling also catches status changes made by an
    // external expiry job, which runs in a separate process and cannot emit on
    // this app server's Socket.io instance.
    refetchInterval: screen === "track" || screen === "orders" ? 30000 : false,
  });
  const cartCount = useMemo(() => cart.data?.items.reduce((total, item) => total + item.quantity, 0) || 0, [cart.data]);
  const trackingOrder = orders.data?.find((order) => order._id === trackingOrderId) || null;
  const selectedQuote = deliveryQuotes[deliveryMethod] || null;
  const customerLocation = useMemo(() => {
    if (liveLocation) return liveLocation;
    const saved = profile.data?.address;
    return hasCoordinates(saved?.lat ?? undefined, saved?.lng ?? undefined) ? { lat: saved!.lat!, lng: saved!.lng! } : null;
  }, [liveLocation, profile.data]);
  const nearbyRestaurants = useMemo(() => (restaurants.data || [])
    .filter((item) => item.isOpen !== false)
    .map((item) => ({ ...item, distanceKm: customerLocation && hasCoordinates(item.lat, item.lng) ? haversineKm(customerLocation, { lat: item.lat!, lng: item.lng! }) : null }))
    .filter((item) => customerLocation ? item.distanceKm !== null && item.distanceKm <= NEARBY_RADIUS_KM : false)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0)), [restaurants.data, customerLocation]);

  useEffect(() => {
    if (!profile.data) return;
    setProfileName(profile.data.name || "");
    setAddress((current) => current.fullName || current.address ? current : toAddress(profile.data));
  }, [profile.data]);
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;
    const apply = (coords: Location.LocationObjectCoords) => {
      if (active) setLiveLocation({ lat: coords.latitude, lng: coords.longitude });
    };
    const startWatching = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      apply(position.coords);
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 20000 }, (position) => apply(position.coords));
    };
    startWatching().catch(() => undefined);
    return () => { active = false; subscription?.remove(); };
  }, [token]);
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("joinCustomer"));
    socket.on("orderStatusUpdated", () => queryClient.invalidateQueries({ queryKey: ["orders", token] }));
    return () => { socket.disconnect(); };
  }, [token]);
  useEffect(() => {
    if (!token || screen !== "checkout") return undefined;
    const lat = Number(address.lat);
    const lng = Number(address.lng);
    const required = [address.fullName, address.address, address.city, address.state, address.country, address.phone];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || required.some((value) => !value.trim())) {
      setDeliveryQuotes({});
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setQuoting(true);
        // This mobile checkout currently offers COD only, which is restricted
        // to human shippers by the payment policy.
        const methods: DeliveryMethod[] = ["shipper"];
        const results = await Promise.allSettled(methods.map((method) => axios.post<{ data: Quote }>(`${API_URL}/api/order/quote`, { address: { ...address, lat, lng }, deliveryMethod: method }, { headers: authHeaders(token) })));
        if (!active) return;
        const next: Partial<Record<DeliveryMethod, Quote>> = {};
        results.forEach((result, index) => { if (result.status === "fulfilled") next[methods[index]] = result.value.data.data; });
        setDeliveryQuotes(next);
      } finally {
        if (active) setQuoting(false);
      }
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [token, screen, address.fullName, address.address, address.city, address.state, address.country, address.phone, address.lat, address.lng, cart.data?.subtotal]);

  const login = async () => {
    try {
      setWorking(true); setLoginError("");
      const response = await axios.post(`${API_URL}/api/user/login`, { email: email.trim(), password });
      await SecureStore.setItemAsync("accessToken", response.data.token);
      setToken(response.data.token);
    } catch (cause) { setLoginError(apiError(cause, "Đăng nhập thất bại")); }
    finally { setWorking(false); }
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync("accessToken");
    queryClient.clear(); setToken(null); setScreen("restaurants"); setRestaurant(null); setTrackingOrderId(null);
  };
  const goBack = () => {
    if (screen === "menu") setScreen("restaurants");
    else if (screen === "cart") setScreen("restaurants");
    else if (screen === "checkout") setScreen("cart");
    else if (screen === "track") setScreen("orders");
    else setScreen("restaurants");
  };
  const openFood = (food: Food) => {
    const picks: Record<string, string[]> = {};
    (food.optionGroups || []).forEach((group) => { picks[group.name] = []; });
    setOptionPicks(picks); setSelectedFood(food);
  };
  const toggleOption = (group: OptionGroup, optionName: string) => setOptionPicks((previous) => {
    const current = previous[group.name] || [];
    if (group.type === "single") return { ...previous, [group.name]: current[0] === optionName ? [] : [optionName] };
    if (current.includes(optionName)) return { ...previous, [group.name]: current.filter((name) => name !== optionName) };
    if (group.max && current.length >= group.max) return previous;
    return { ...previous, [group.name]: [...current, optionName] };
  });
  const addSelectedFood = async () => {
    if (!token || !selectedFood) return;
    const selectedOptions = Object.entries(optionPicks).flatMap(([groupName, names]) => names.map((optionName) => ({ groupName, optionName })));
    for (const group of selectedFood.optionGroups || []) {
      const minimum = group.required ? Math.max(group.min || 0, 1) : group.min || 0;
      if ((optionPicks[group.name] || []).length < minimum) return Alert.alert("Thiếu lựa chọn", `Vui lòng chọn ít nhất ${minimum} mục ở nhóm ${group.name}.`);
    }
    try {
      setWorking(true);
      await axios.post(`${API_URL}/api/cart/add`, { itemId: selectedFood._id, quantity: 1, selectedOptions }, { headers: authHeaders(token) });
      await queryClient.invalidateQueries({ queryKey: ["cart", token] });
      setSelectedFood(null);
    } catch (cause) { Alert.alert("Không thể thêm món", apiError(cause)); }
    finally { setWorking(false); }
  };
  const changeQuantity = async (line: CartLine, quantity: number) => {
    if (!token) return;
    try {
      await axios.post(`${API_URL}/api/cart/update-line`, { lineKey: line.lineKey, quantity }, { headers: authHeaders(token) });
      await queryClient.invalidateQueries({ queryKey: ["cart", token] });
    } catch (cause) { Alert.alert("Không thể cập nhật giỏ", apiError(cause)); }
  };
  const useCurrentLocation = async () => {
    if (!token) return;
    try {
      setWorking(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") return Alert.alert("Cần quyền vị trí", "Hãy cho phép Drone Food dùng vị trí khi đang sử dụng để báo giá giao hàng.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLiveLocation({ lat, lng });
      const response = await axios.get<{ data: Partial<Address> | null }>(`${API_URL}/api/user/reverse-geocode`, { params: { lat, lng }, headers: authHeaders(token) });
      setAddress((previous) => ({
        ...previous,
        ...(response.data.data || {}),
        lat: String(lat),
        lng: String(lng),
      }));
      setDeliveryQuotes({});
      if (!response.data.data) Alert.alert("Đã lấy tọa độ", "Không thể tìm địa chỉ cho vị trí này. Bạn có thể điền địa chỉ thủ công.");
    } catch (cause) { Alert.alert("Không lấy được vị trí", apiError(cause, "Hãy bật GPS rồi thử lại.")); }
    finally { setWorking(false); }
  };
  const findLocationFromAddress = async () => {
    if (!token) return;
    const lookupAddress = [address.address, address.city, address.state, address.country].filter((part) => part.trim()).join(", ");
    if (lookupAddress.length < 3) return Alert.alert("Thiếu địa chỉ", "Hãy nhập ít nhất số nhà hoặc tên đường trước khi tìm vị trí.");
    try {
      setWorking(true);
      const response = await axios.get<{ data: { lat: number; lng: number } | null }>(`${API_URL}/api/user/geocode`, { params: { address: lookupAddress }, headers: authHeaders(token) });
      if (!response.data.data) return Alert.alert("Không tìm thấy vị trí", "Hãy bổ sung địa chỉ chi tiết hơn hoặc dùng GPS hiện tại.");
      setAddress((previous) => ({ ...previous, lat: String(response.data.data!.lat), lng: String(response.data.data!.lng) }));
      setDeliveryQuotes({});
    } catch (cause) { Alert.alert("Không thể tìm vị trí", apiError(cause)); }
    finally { setWorking(false); }
  };
  const updateAddressCoordinates = (coordinate: Coordinates) => {
    setAddress((previous) => ({ ...previous, lat: String(coordinate.latitude), lng: String(coordinate.longitude) }));
    setDeliveryQuotes({});
  };
  const placeCodOrder = async () => {
    if (!token) return;
    const required = [address.fullName, address.address, address.city, address.state, address.country, address.phone];
    if (required.some((field) => !field.trim())) return Alert.alert("Thiếu thông tin", "Vui lòng điền đủ họ tên, địa chỉ, thành phố, tỉnh/thành, quốc gia và số điện thoại.");
    const lat = Number(address.lat); const lng = Number(address.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Alert.alert("Thiếu vị trí", "Cần vị trí GPS hoặc tọa độ hợp lệ để đặt đơn.");
    if (!selectedQuote) return Alert.alert("Chưa có phí giao", "Hãy hoàn thiện địa chỉ để hệ thống tính phí giao hàng.");
    try {
      setWorking(true);
      await axios.put(`${API_URL}/api/user/update-address`, { ...address, lat, lng }, { headers: authHeaders(token) });
      await queryClient.invalidateQueries({ queryKey: ["profile", token] });
      const result = await axios.post<{ orderId: string }>(`${API_URL}/api/order/place`, { address: { ...address, lat, lng }, deliveryMethod, paymentMethod: "COD" }, { headers: authHeaders(token) });
      await queryClient.invalidateQueries({ queryKey: ["cart", token] });
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      setDeliveryQuotes({}); setTrackingOrderId(result.data.orderId); setScreen("track");
      Alert.alert("Đặt đơn thành công", `Mã đơn: ${result.data.orderId}`);
    } catch (cause) { Alert.alert("Không thể đặt đơn", apiError(cause)); }
    finally { setWorking(false); }
  };
  const saveProfile = async () => {
    if (!token) return;
    const lat = address.lat === "" ? null : Number(address.lat);
    const lng = address.lng === "" ? null : Number(address.lng);
    if (!profileName.trim() || !address.fullName.trim() || !address.phone.trim() || !address.address.trim()) return Alert.alert("Thiếu thông tin", "Vui lòng điền tên, số điện thoại và địa chỉ lưu.");
    if ((lat !== null && !Number.isFinite(lat)) || (lng !== null && !Number.isFinite(lng))) return Alert.alert("Tọa độ không hợp lệ", "Hãy dùng GPS hoặc nhập lại tọa độ.");
    try {
      setWorking(true);
      await axios.put(`${API_URL}/api/user/profile`, { name: profileName.trim(), phone: address.phone.trim() }, { headers: authHeaders(token) });
      await axios.put(`${API_URL}/api/user/update-address`, { ...address, fullName: address.fullName.trim(), lat, lng }, { headers: authHeaders(token) });
      await queryClient.invalidateQueries({ queryKey: ["profile", token] });
      Alert.alert("Đã lưu", "Hồ sơ và địa chỉ giao hàng đã được cập nhật.");
    } catch (cause) { Alert.alert("Không thể lưu hồ sơ", apiError(cause)); }
    finally { setWorking(false); }
  };
  const confirmQr = async (order: Order) => {
    if (!token || !order.qrCode) return;
    try {
      setWorking(true);
      const result = await axios.post(`${API_URL}/api/drone/scan-qr`, { orderId: order._id, qrCode: order.qrCode }, { headers: authHeaders(token) });
      Alert.alert("Đã xác nhận QR", result.data.message || "Khoang hàng đang mở trong 5 giây.");
      await orders.refetch();
    } catch (cause) { Alert.alert("Không thể xác nhận QR", apiError(cause)); }
    finally { setWorking(false); }
  };
  const confirmDelivery = async (order: Order) => {
    if (!token) return;
    try {
      setWorking(true);
      const result = await axios.post(`${API_URL}/api/drone/confirm-delivery`, { orderId: order._id }, { headers: authHeaders(token) });
      Alert.alert("Hoàn tất", result.data.message || "Đã xác nhận nhận hàng.");
      await orders.refetch();
    } catch (cause) { Alert.alert("Chưa thể hoàn tất", apiError(cause)); }
    finally { setWorking(false); }
  };

  if (!token) return <LoginScreen email={email} password={password} error={loginError} working={working} onEmail={setEmail} onPassword={setPassword} onLogin={login} />;
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <View style={styles.header}>
      <View style={styles.headerLeft}>{screen !== "restaurants" ? <Pressable onPress={goBack}><Text style={styles.backLink}>← Quay lại</Text></Pressable> : null}<Pressable onPress={() => { setScreen("restaurants"); setRestaurant(null); }}><Text style={styles.brand}>Drone Food</Text></Pressable></View>
      <View style={styles.headerActions}>
        <Pressable onPress={() => setScreen("orders")}><Text style={styles.headerLink}>Đơn</Text></Pressable>
        <Pressable onPress={() => setScreen("cart")}><Text style={styles.headerLink}>Giỏ ({cartCount})</Text></Pressable>
        <Pressable onPress={() => setScreen("profile")}><Text style={styles.headerLink}>Hồ sơ</Text></Pressable>
        <Pressable onPress={logout}><Text style={styles.headerLink}>Thoát</Text></Pressable>
      </View>
    </View>
    {screen === "restaurants" && <RestaurantList restaurants={nearbyRestaurants} loading={restaurants.isLoading || profile.isLoading} error={restaurants.isError} hasLocation={Boolean(customerLocation)} onOpen={(item) => { setRestaurant(item); setScreen("menu"); }} />}
    {screen === "menu" && restaurant && <MenuScreen restaurant={restaurant} foods={foods.data || []} loading={foods.isLoading} onBack={() => setScreen("restaurants")} onFood={openFood} />}
    {screen === "cart" && <CartScreen cart={cart.data} loading={cart.isLoading} onCheckout={() => setScreen("checkout")} onQuantity={changeQuantity} />}
    {screen === "checkout" && <CheckoutScreen cart={cart.data} loading={cart.isLoading} address={address} quotes={deliveryQuotes} selectedMethod={deliveryMethod} quoting={quoting} working={working} onAddress={(key, value) => { setAddress((current) => ({ ...current, [key]: value })); setDeliveryQuotes({}); }} onLocation={useCurrentLocation} onFindAddress={findLocationFromAddress} onCoordinates={updateAddressCoordinates} onMethod={setDeliveryMethod} onPlace={placeCodOrder} />}
    {screen === "orders" && <OrdersScreen orders={orders.data || []} loading={orders.isLoading} onRefresh={() => orders.refetch()} onTrack={(order) => { setTrackingOrderId(order._id); setScreen("track"); }} />}
    {screen === "track" && <DroneTrackingScreen order={trackingOrder} loading={orders.isLoading} working={working} onBack={() => setScreen("orders")} onQr={confirmQr} onConfirmDelivery={confirmDelivery} />}
    {screen === "profile" && <ProfileScreen profile={profile.data} loading={profile.isLoading} name={profileName} address={address} working={working} onName={setProfileName} onAddress={(key, value) => setAddress((current) => ({ ...current, [key]: value }))} onLocation={useCurrentLocation} onFindAddress={findLocationFromAddress} onCoordinates={updateAddressCoordinates} onSave={saveProfile} />}
    <FoodOptionsModal food={selectedFood} picks={optionPicks} working={working} onClose={() => setSelectedFood(null)} onToggle={toggleOption} onAdd={addSelectedFood} />
  </SafeAreaView>;
}

function LoginScreen({ email, password, error, working, onEmail, onPassword, onLogin }: { email: string; password: string; error: string; working: boolean; onEmail: (value: string) => void; onPassword: (value: string) => void; onLogin: () => void }) {
  return <SafeAreaView style={styles.login}><Text style={styles.brand}>Drone Food</Text><Text style={styles.subtitle}>Đặt món và theo dõi giao bằng Drone</Text><TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={onEmail} /><TextInput style={styles.input} placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={onPassword} /><PrimaryButton label="Đăng nhập" onPress={onLogin} disabled={working} />{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.hint}>API: {API_URL}</Text></SafeAreaView>;
}

function RestaurantList({ restaurants, loading, error, hasLocation, onOpen }: { restaurants: (Restaurant & { distanceKm: number | null })[]; loading: boolean; error: boolean; hasLocation: boolean; onOpen: (item: Restaurant) => void }) {
  if (loading) return <Loading />;
  return <FlatList contentContainerStyle={styles.list} data={restaurants} keyExtractor={(item) => item._id} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["restaurants"] })} refreshing={loading} ListHeaderComponent={<><Text style={styles.screenTitle}>Nhà hàng gần bạn</Text><Text style={styles.muted}>Bán kính {NEARBY_RADIUS_KM} km từ vị trí GPS hoặc địa chỉ đã lưu.</Text></>} ListEmptyComponent={<Text>{error ? "Không tải được danh sách nhà hàng." : hasLocation ? "Không có nhà hàng nào trong bán kính hiện tại." : "Hãy bật quyền vị trí hoặc lưu địa chỉ trong Hồ sơ để xem nhà hàng gần bạn."}</Text>} renderItem={({ item }) => <Pressable style={styles.card} onPress={() => onOpen(item)}>{item.image ? <Image style={styles.image} source={{ uri: item.image }} /> : null}<View style={styles.cardBody}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.address}</Text>{item.distanceKm !== null ? <Text style={styles.distance}>{formatDistance(item.distanceKm)}</Text> : null}<Text style={styles.link}>Xem thực đơn →</Text></View></Pressable>} />;
}

function MenuScreen({ restaurant, foods, loading, onBack, onFood }: { restaurant: Restaurant; foods: Food[]; loading: boolean; onBack: () => void; onFood: (item: Food) => void }) {
  if (loading) return <Loading />;
  return <FlatList contentContainerStyle={styles.list} data={foods} keyExtractor={(item) => item._id} ListHeaderComponent={<><Pressable onPress={onBack}><Text style={styles.link}>← Nhà hàng</Text></Pressable><Text style={styles.screenTitle}>{restaurant.name}</Text><Text style={styles.muted}>{restaurant.address}</Text></>} ListEmptyComponent={<Text>Nhà hàng chưa có món.</Text>} renderItem={({ item }) => <View style={styles.card}>{item.image ? <Image style={styles.image} source={{ uri: item.image }} /> : null}<View style={styles.cardBody}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.muted}>{item.description}</Text><Text style={styles.price}>{formatVnd(item.price)}</Text><PrimaryButton label="Chọn món" onPress={() => onFood(item)} /></View></View>} />;
}

function CartScreen({ cart, loading, onCheckout, onQuantity }: { cart?: Cart; loading: boolean; onCheckout: () => void; onQuantity: (line: CartLine, quantity: number) => void }) {
  if (loading) return <Loading />;
  if (!cart?.items.length) return <View style={styles.empty}><Text style={styles.screenTitle}>Giỏ hàng trống</Text><Text>Chọn món từ một nhà hàng để tiếp tục.</Text></View>;
  return <ScrollView contentContainerStyle={styles.list}>
    <Text style={styles.screenTitle}>Giỏ hàng</Text>
    {cart.items.map((line) => <View key={line.lineKey} style={styles.line}><View style={styles.lineText}><Text style={styles.cardTitle}>{line.name}</Text>{line.selectedOptions.map((option) => <Text key={`${option.groupName}-${option.optionName}`} style={styles.muted}>{option.groupName}: {option.optionName}</Text>)}<Text style={styles.price}>{formatVnd(line.unitPrice)}</Text></View><View style={styles.quantity}><Pressable style={styles.quantityButton} onPress={() => onQuantity(line, line.quantity - 1)}><Text>−</Text></Pressable><Text>{line.quantity}</Text><Pressable style={styles.quantityButton} onPress={() => onQuantity(line, line.quantity + 1)}><Text>+</Text></Pressable></View></View>)}
    <Text style={styles.total}>Tạm tính: {formatVnd(cart.subtotal)}</Text>
    <PrimaryButton label="Check out" onPress={onCheckout} />
  </ScrollView>;
}

function CheckoutScreen({ cart, loading, address, quotes, selectedMethod, quoting, working, onAddress, onLocation, onFindAddress, onCoordinates, onMethod, onPlace }: { cart?: Cart; loading: boolean; address: Address; quotes: Partial<Record<DeliveryMethod, Quote>>; selectedMethod: DeliveryMethod; quoting: boolean; working: boolean; onAddress: (key: keyof Address, value: string) => void; onLocation: () => void; onFindAddress: () => void; onCoordinates: (coordinate: Coordinates) => void; onMethod: (method: DeliveryMethod) => void; onPlace: () => void }) {
  if (loading) return <Loading />;
  if (!cart?.items.length) return <View style={styles.empty}><Text style={styles.screenTitle}>Giỏ hàng trống</Text><Text>Hãy quay lại chọn món.</Text></View>;
  return <ScrollView contentContainerStyle={styles.list}>
    <Text style={styles.screenTitle}>Check out</Text>
    <Text style={styles.muted}>Thông tin đã được tự điền từ Hồ sơ. Bạn có thể sửa cho đơn này.</Text>
    <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
    <Field value={address.fullName} placeholder="Họ và tên" onChange={(value) => onAddress("fullName", value)} />
    <Field value={address.phone} placeholder="Số điện thoại" keyboardType="phone-pad" onChange={(value) => onAddress("phone", value)} />
    <Field value={address.address} placeholder="Số nhà, đường" onChange={(value) => onAddress("address", value)} />
    <Field value={address.city} placeholder="Thành phố / Quận huyện" onChange={(value) => onAddress("city", value)} />
    <Field value={address.state} placeholder="Tỉnh / Thành" onChange={(value) => onAddress("state", value)} />
    <Field value={address.country} placeholder="Quốc gia" onChange={(value) => onAddress("country", value)} />
    <SecondaryButton label="Tìm vị trí từ địa chỉ" onPress={onFindAddress} disabled={working} />
    <SecondaryButton label="Dùng vị trí GPS hiện tại" onPress={onLocation} disabled={working} />
    <LocationPreview address={address} onCoordinates={onCoordinates} />
    <Text style={styles.sectionTitle}>Phương thức giao hàng</Text>
    <DeliveryMethodChoice method="shipper" title="Shipper" detail="Đường bộ · 5.000 ₫/km" quote={quotes.shipper} active={selectedMethod === "shipper"} loading={quoting} onPress={() => onMethod("shipper")} />
    {quotes[selectedMethod] ? <View style={styles.quote}><Text style={styles.cardTitle}>Tổng COD: {formatVnd(cart.subtotal + quotes[selectedMethod]!.shippingPrice)}</Text><Text>Phí giao: {formatVnd(quotes[selectedMethod]!.shippingPrice)} · {quotes[selectedMethod]!.billedDistanceKm.toFixed(3)} km</Text></View> : <Text style={styles.hint}>Hoàn thiện địa chỉ và vị trí để hệ thống tự tính phí giao.</Text>}
    <PrimaryButton label="Xác nhận đặt đơn COD bằng Shipper" onPress={onPlace} disabled={working || quoting || !quotes[selectedMethod]} />
  </ScrollView>;
}

function ProfileScreen({ profile, loading, name, address, working, onName, onAddress, onLocation, onFindAddress, onCoordinates, onSave }: { profile?: UserProfile; loading: boolean; name: string; address: Address; working: boolean; onName: (value: string) => void; onAddress: (key: keyof Address, value: string) => void; onLocation: () => void; onFindAddress: () => void; onCoordinates: (coordinate: Coordinates) => void; onSave: () => void }) {
  if (loading) return <Loading />;
  return <ScrollView contentContainerStyle={styles.list}>
    <Text style={styles.screenTitle}>Hồ sơ</Text>
    <Text style={styles.muted}>{profile?.email || ""}</Text>
    <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
    <Field value={name} placeholder="Tên hiển thị" onChange={onName} />
    <Text style={styles.sectionTitle}>Địa chỉ giao mặc định</Text>
    <Text style={styles.muted}>Địa chỉ này sẽ tự điền ở Check out.</Text>
    <Field value={address.fullName} placeholder="Họ và tên người nhận" onChange={(value) => onAddress("fullName", value)} />
    <Field value={address.phone} placeholder="Số điện thoại" keyboardType="phone-pad" onChange={(value) => onAddress("phone", value)} />
    <Field value={address.address} placeholder="Số nhà, đường" onChange={(value) => onAddress("address", value)} />
    <Field value={address.city} placeholder="Thành phố / Quận huyện" onChange={(value) => onAddress("city", value)} />
    <Field value={address.state} placeholder="Tỉnh / Thành" onChange={(value) => onAddress("state", value)} />
    <Field value={address.country} placeholder="Quốc gia" onChange={(value) => onAddress("country", value)} />
    <SecondaryButton label="Tìm vị trí từ địa chỉ" onPress={onFindAddress} disabled={working} />
    <SecondaryButton label="Lấy tọa độ GPS hiện tại" onPress={onLocation} disabled={working} />
    <LocationPreview address={address} onCoordinates={onCoordinates} />
    <PrimaryButton label="Lưu hồ sơ" onPress={onSave} disabled={working} />
  </ScrollView>;
}

function LocationPreview({ address, onCoordinates }: { address: Address; onCoordinates: (coordinate: Coordinates) => void }) {
  const lat = Number(address.lat);
  const lng = Number(address.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return <Text style={styles.hint}>Tìm vị trí từ địa chỉ hoặc dùng GPS để kiểm tra ghim trên bản đồ.</Text>;
  const coordinate = { latitude: lat, longitude: lng };
  return <View style={styles.locationPreview}><Text style={styles.muted}>Kiểm tra vị trí ghim; chạm bản đồ hoặc kéo ghim để chỉnh chính xác.</Text><MapView key={`${lat}-${lng}`} style={styles.addressMap} initialRegion={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }} onPress={(event) => onCoordinates(event.nativeEvent.coordinate)}><Marker coordinate={coordinate} draggable onDragEnd={(event) => onCoordinates(event.nativeEvent.coordinate)} title="Điểm giao hàng" /></MapView></View>;
}

function DeliveryMethodChoice({ method, title, detail, quote, active, loading, onPress }: { method: DeliveryMethod; title: string; detail: string; quote?: Quote; active: boolean; loading: boolean; onPress: () => void }) {
  return <Pressable style={[styles.deliveryChoice, active && styles.deliveryChoiceActive, !quote && !loading && styles.deliveryChoiceUnavailable]} onPress={onPress} disabled={!quote}><View><Text style={styles.cardTitle}>{active ? "◉" : "○"} {title}</Text><Text style={styles.muted}>{detail}</Text></View><Text style={styles.price}>{loading ? "Đang tính..." : quote ? formatVnd(quote.shippingPrice) : method === "shipper" ? "Chưa khả dụng" : "Cần địa chỉ"}</Text></Pressable>;
}

function OrderStatusTimeline({ status }: { status: string }) {
  const steps = [
    { key: "pending", label: "Đã đặt" },
    { key: "preparing", label: "Đang chuẩn bị" },
    { key: "delivering", label: "Đang giao" },
    { key: "delivered", label: "Đã giao" },
  ];
  if (status === "cancelled") return <View style={styles.cancelledTimeline}><Text style={styles.error}>Đơn đã bị huỷ</Text></View>;
  const active = Math.max(0, steps.findIndex((step) => step.key === status));
  return <View style={styles.timeline}>{steps.map((step, index) => <View key={step.key} style={styles.timelineStep}><View style={[styles.timelineDot, index <= active && styles.timelineDotActive]}><Text style={styles.timelineDotText}>{index < active ? "✓" : index + 1}</Text></View>{index < steps.length - 1 ? <View style={[styles.timelineLine, index < active && styles.timelineLineActive]} /> : null}<Text style={[styles.timelineLabel, index <= active && styles.timelineLabelActive]}>{step.label}</Text></View>)}</View>;
}

function OrdersScreen({ orders, loading, onRefresh, onTrack }: { orders: Order[]; loading: boolean; onRefresh: () => void; onTrack: (order: Order) => void }) {
  if (loading) return <Loading />;
  return <FlatList contentContainerStyle={styles.list} data={orders} keyExtractor={(item) => item._id} refreshing={loading} onRefresh={onRefresh} ListHeaderComponent={<Text style={styles.screenTitle}>Đơn của tôi</Text>} ListEmptyComponent={<Text>Chưa có đơn hàng.</Text>} renderItem={({ item }) => <Pressable style={styles.card} onPress={() => onTrack(item)}><View style={styles.cardBody}><Text style={styles.cardTitle}>#{item._id.slice(-6).toUpperCase()} · {item.orderStatus}</Text><Text>Drone · Phí {formatVnd(item.shippingPrice)}</Text><Text style={styles.price}>{formatVnd(item.totalPrice)}</Text><Text style={styles.muted}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text>{item.cancellationCode ? <Text style={styles.error}>{item.cancellationCode}: {item.reason || "Đơn đã bị huỷ"}</Text> : null}<Text style={styles.link}>Theo dõi đơn →</Text></View></Pressable>} />;
}

function DroneTrackingScreen({ order, loading, working, onBack, onQr, onConfirmDelivery }: { order: Order | null; loading: boolean; working: boolean; onBack: () => void; onQr: (order: Order) => void; onConfirmDelivery: (order: Order) => void }) {
  const [progress, setProgress] = useState(0);
  const restaurant = order?.restaurantId;
  const destination = order?.shippingAddress;
  const canRenderMap = hasCoordinates(restaurant?.lat, restaurant?.lng) && hasCoordinates(destination?.lat, destination?.lng);
  const origin: Coordinates | null = canRenderMap ? { latitude: restaurant!.lat!, longitude: restaurant!.lng! } : null;
  const end: Coordinates | null = canRenderMap ? { latitude: destination!.lat!, longitude: destination!.lng! } : null;
  const drone: Coordinates | null = origin && end ? { latitude: origin.latitude + (end.latitude - origin.latitude) * progress, longitude: origin.longitude + (end.longitude - origin.longitude) * progress } : null;
  useEffect(() => {
    setProgress(0);
    if (order?.orderStatus !== "delivering") return undefined;
    const timer = setInterval(() => setProgress((value) => value >= 1 ? 0 : value + 0.025), 250);
    return () => clearInterval(timer);
  }, [order?._id, order?.orderStatus]);
  if (loading && !order) return <Loading />;
  if (!order) return <View style={styles.empty}><Text>Không tìm thấy đơn. Hãy kéo để tải lại danh sách đơn.</Text><SecondaryButton label="Quay lại đơn hàng" onPress={onBack} /></View>;
  return <ScrollView contentContainerStyle={styles.list}>
    <Pressable onPress={onBack}><Text style={styles.link}>← Đơn của tôi</Text></Pressable>
    <Text style={styles.screenTitle}>Theo dõi Drone</Text>
    <View style={styles.statusBox}><Text style={styles.cardTitle}>Trạng thái: {order.orderStatus}</Text><Text>Nhà hàng: {restaurant?.name || "Đang cập nhật"}</Text><Text>Tổng đơn: {formatVnd(order.totalPrice)}</Text></View>
    <OrderStatusTimeline status={order.orderStatus} />
    {canRenderMap && origin && end && drone ? <><MapView style={styles.map} initialRegion={{ latitude: (origin.latitude + end.latitude) / 2, longitude: (origin.longitude + end.longitude) / 2, latitudeDelta: Math.max(Math.abs(origin.latitude - end.latitude) * 1.8, 0.01), longitudeDelta: Math.max(Math.abs(origin.longitude - end.longitude) * 1.8, 0.01) }}><Marker coordinate={origin} title="Nhà hàng" pinColor="#e85d04" /><Marker coordinate={end} title="Điểm giao" pinColor="#15803d" /><Marker coordinate={drone} title="Drone (mô phỏng)" /><Polyline coordinates={[origin, end]} strokeColor="#e85d04" strokeWidth={4} /></MapView><Text style={styles.hint}>Lộ trình và Drone di chuyển trên bản đồ là mô phỏng để test flow hiện tại; chưa phải GPS/telemetry thực.</Text></> : <Text style={styles.hint}>Chưa đủ tọa độ nhà hàng hoặc điểm giao để hiển thị bản đồ.</Text>}
    {order.orderStatus === "delivering" && order.qrCode ? <View style={styles.qrBox}><Text style={styles.sectionTitle}>Nhận hàng bằng QR</Text><Text style={styles.muted}>Đưa mã này cho Drone khi đến điểm giao.</Text><View style={styles.qr}><QRCode value={order.qrCode} size={180} /></View><Text selectable style={styles.qrText}>{order.qrCode}</Text>{!order.qrScanned ? <PrimaryButton label="Xác nhận quét QR" onPress={() => onQr(order)} disabled={working} /> : !order.cargoChecked ? <Text style={styles.hint}>QR đã xác nhận. Trạng thái sẽ tự cập nhật sau khi khoang hàng đóng.</Text> : <PrimaryButton label="Xác nhận đã nhận hàng" onPress={() => onConfirmDelivery(order)} disabled={working} />}</View> : null}
  </ScrollView>;
}

function FoodOptionsModal({ food, picks, working, onClose, onToggle, onAdd }: { food: Food | null; picks: Record<string, string[]>; working: boolean; onClose: () => void; onToggle: (group: OptionGroup, optionName: string) => void; onAdd: () => void }) {
  if (!food) return null;
  return <Modal animationType="slide" transparent visible onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modal}><ScrollView><Text style={styles.screenTitle}>{food.name}</Text><Text style={styles.price}>{formatVnd(food.price)}</Text>{(food.optionGroups || []).map((group) => <View key={group.name} style={styles.optionGroup}><Text style={styles.sectionTitle}>{group.name}{group.required ? " *" : ""}</Text>{group.options.map((option) => { const active = (picks[group.name] || []).includes(option.name); return <Pressable key={option.name} style={[styles.option, active && styles.optionActive]} onPress={() => onToggle(group, option.name)}><Text>{active ? "✓ " : "○ "}{option.name}</Text><Text>{option.priceDelta ? `+${formatVnd(option.priceDelta)}` : ""}</Text></Pressable>; })}</View>)}<PrimaryButton label="Thêm vào giỏ" onPress={onAdd} disabled={working} /><SecondaryButton label="Đóng" onPress={onClose} disabled={working} /></ScrollView></View></View></Modal>;
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable style={[styles.primaryButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>; }
function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable style={[styles.secondaryButton, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>; }
function Field({ value, placeholder, keyboardType, onChange }: { value: string; placeholder: string; keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad"; onChange: (value: string) => void }) { return <TextInput style={styles.input} placeholder={placeholder} keyboardType={keyboardType} value={value} onChangeText={onChange} />; }
function Loading() { return <View style={styles.loading}><ActivityIndicator size="large" color="#e85d04" /></View>; }
export default function App() { return <QueryClientProvider client={queryClient}><CustomerApp /></QueryClientProvider>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fffaf5" }, login: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fffaf5" }, header: { paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#fde6d4" }, headerLeft: { gap: 2 }, headerActions: { flexDirection: "row", gap: 12 }, brand: { fontSize: 22, fontWeight: "800", color: "#d94801" }, backLink: { color: "#9a3412", fontWeight: "700", fontSize: 12 }, headerLink: { color: "#9a3412", fontWeight: "700" }, subtitle: { color: "#6b7280", marginBottom: 12 }, list: { padding: 18, gap: 12 }, screenTitle: { fontSize: 24, fontWeight: "800", color: "#1f2937" }, sectionTitle: { fontSize: 17, fontWeight: "800", color: "#374151", marginTop: 8 }, card: { borderWidth: 1, borderColor: "#fde6d4", borderRadius: 14, backgroundColor: "#fff", overflow: "hidden", flexDirection: "row" }, image: { width: 90, height: 90, backgroundColor: "#f3f4f6" }, cardBody: { flex: 1, padding: 12, gap: 5 }, cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937" }, muted: { color: "#6b7280" }, link: { color: "#d94801", fontWeight: "700", marginTop: 3 }, distance: { color: "#15803d", fontWeight: "700" }, price: { color: "#c2410c", fontWeight: "800", fontSize: 16 }, input: { width: "100%", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 10, padding: 12, backgroundColor: "#fff" }, primaryButton: { backgroundColor: "#e85d04", alignItems: "center", padding: 13, borderRadius: 10, marginTop: 8 }, primaryButtonText: { color: "#fff", fontWeight: "800" }, secondaryButton: { borderColor: "#e85d04", borderWidth: 1, alignItems: "center", padding: 12, borderRadius: 10, marginTop: 8 }, secondaryButtonText: { color: "#c2410c", fontWeight: "800" }, disabled: { opacity: 0.5 }, error: { color: "#b91c1c", marginTop: 4 }, hint: { color: "#6b7280", fontSize: 12 }, loading: { flex: 1, alignItems: "center", justifyContent: "center" }, empty: { flex: 1, padding: 24, gap: 8 }, line: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#fde6d4", flexDirection: "row", justifyContent: "space-between", gap: 12 }, lineText: { flex: 1, gap: 2 }, quantity: { flexDirection: "row", alignItems: "center", gap: 10 }, quantityButton: { width: 28, height: 28, borderWidth: 1, borderColor: "#fdba74", borderRadius: 14, alignItems: "center", justifyContent: "center" }, total: { fontSize: 17, fontWeight: "800", color: "#1f2937", marginTop: 4 }, row: { flexDirection: "row", gap: 8 }, coord: { flex: 1 }, quote: { borderWidth: 1, borderColor: "#86efac", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, gap: 4, marginTop: 8 }, deliveryChoice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, borderWidth: 1, borderColor: "#fed7aa", borderRadius: 12, backgroundColor: "#fff" }, deliveryChoiceActive: { borderColor: "#e85d04", backgroundColor: "#fff3e8" }, deliveryChoiceUnavailable: { opacity: 0.55 }, locationPreview: { gap: 8, marginTop: 2 }, addressMap: { height: 220, borderRadius: 12 }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }, modal: { maxHeight: "80%", backgroundColor: "#fffaf5", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 }, optionGroup: { gap: 6, marginTop: 8 }, option: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 9, padding: 10 }, optionActive: { borderColor: "#e85d04", backgroundColor: "#fff3e8" }, statusBox: { gap: 5, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#fde6d4" }, timeline: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }, timelineStep: { flex: 1, alignItems: "center", position: "relative" }, timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#d1d5db", zIndex: 1 }, timelineDotActive: { backgroundColor: "#e85d04" }, timelineDotText: { color: "#fff", fontSize: 12, fontWeight: "800" }, timelineLine: { position: "absolute", height: 3, backgroundColor: "#d1d5db", left: "50%", right: "-50%", top: 12 }, timelineLineActive: { backgroundColor: "#e85d04" }, timelineLabel: { marginTop: 6, color: "#9ca3af", fontSize: 10, textAlign: "center" }, timelineLabelActive: { color: "#9a3412", fontWeight: "700" }, cancelledTimeline: { padding: 12, borderRadius: 10, backgroundColor: "#fef2f2" }, map: { height: 300, borderRadius: 12 }, qrBox: { alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#fed7aa", borderRadius: 12, padding: 16, backgroundColor: "#fff" }, qr: { backgroundColor: "#fff", padding: 12, marginTop: 6 }, qrText: { fontWeight: "800", letterSpacing: 2, color: "#1f2937" },
});
