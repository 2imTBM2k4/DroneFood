import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import { io } from "socket.io-client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import {
  API_URL,
  apiError,
  cartApi,
  droneApi,
  clearCustomerSession,
  getStoredToken,
  haversineKm,
  orderApi,
  restaurantApi,
  setSessionExpiredHandler,
  foodApi,
  userApi,
} from "./src/api/client";
import { colors } from "./src/theme/tokens";
import type {
  Address,
  AddressBookEntry,
  AddressBookInput,
  CartLine,
  Coordinates,
  DeliveryMethod,
  Food,
  LiveShipperRoute,
  LiveShipperRouteStatus,
  Order,
  PaymentMethod,
  Quote,
  Restaurant,
  ScreenName,
  UserProfile,
} from "./src/types";

// Components
import { TabBar } from "./src/components/navigation/TabBar";
import { FloatingCartBar } from "./src/components/navigation/FloatingCartBar";
import { ActiveOrderBanner } from "./src/components/navigation/ActiveOrderBanner";
import { floatingSurfaceForScreen } from "./src/components/navigation/activeOrderBannerState";
import { OptionGroupModal } from "./src/components/food/OptionGroupModal";
import { AddressBookModal } from "./src/components/address/AddressBookModal";
import { AmbientBackground } from "./src/components/common/AmbientBackground";
import { ToastProvider, useToast } from "./src/components/common/ToastProvider";
import { registerPushNotifications, unregisterPushNotifications } from "./src/pushNotifications";

// Screens
import { AuthScreen } from "./src/screens/auth/AuthScreen";
import { HomeScreen } from "./src/screens/home/HomeScreen";
import { SearchScreen } from "./src/screens/search/SearchScreen";
import { RestaurantDetailScreen } from "./src/screens/restaurant/RestaurantDetailScreen";
import { CartScreen } from "./src/screens/cart/CartScreen";
import { CartIndexScreen } from "./src/screens/cart/CartIndexScreen";
import { CheckoutScreen } from "./src/screens/checkout/CheckoutScreen";
import { OrdersScreen } from "./src/screens/orders/OrdersScreen";
import { DroneTrackingScreen } from "./src/screens/orders/DroneTrackingScreen";
import { ShipperTrackingScreen } from "./src/screens/orders/ShipperTrackingScreen";
import { CompletedOrderDetailScreen } from "./src/screens/orders/CompletedOrderDetailScreen";
import { ProfileScreen } from "./src/screens/profile/ProfileScreen";
import { getCartBadgeCount, selectRestaurantCart } from "./src/cart/cartState";

const queryClient = new QueryClient();
const NEARBY_RADIUS_KM = 15;

const isActiveShipperTrackingOrder = (order: Order | null) => (
  order?.deliveryMethod === "shipper" && ["delivering", "arrived_at_delivery"].includes(order.orderStatus)
);

const isCompletedOrder = (order: Order | null) => order?.orderStatus === "delivered";

const defaultAddress: Address = {
  fullName: "",
  address: "",
  city: "",
  state: "",
  country: "Việt Nam",
  zipCode: "",
  phone: "",
  lat: "",
  lng: "",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isCoordinates = (value: unknown): value is Coordinates =>
  isRecord(value) && typeof value.lat === "number" && typeof value.lng === "number" &&
  Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
  Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;

const isRouteGeometry = (value: unknown): value is [number, number][] =>
  Array.isArray(value) && value.length >= 2 && value.every((point): point is [number, number] =>
    Array.isArray(point) && point.length === 2 &&
    typeof point[0] === "number" && typeof point[1] === "number" &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
  );

const isLiveShipperRoute = (value: unknown): value is LiveShipperRoute =>
  isRecord(value) && isCoordinates(value.origin) && isRouteGeometry(value.geometry) &&
  typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0 &&
  typeof value.generatedAt === "string";

const isLiveShipperRouteStatus = (value: unknown): value is LiveShipperRouteStatus =>
  value === "available" || value === "unavailable";

function CustomerApp() {
  const { showToast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<ScreenName>("home");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [selectedFoodForModal, setSelectedFoodForModal] = useState<Food | null>(null);
  const [editingCartLine, setEditingCartLine] = useState<CartLine | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState("");

  const [address, setAddress] = useState<Address>(defaultAddress);
  const [selectedAddressId, setSelectedAddressId] = useState<string | undefined>(undefined);
  const [voucherCodes, setVoucherCodes] = useState<string[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("drone");
  const [deliveryQuotes, setDeliveryQuotes] = useState<Partial<Record<DeliveryMethod, Quote>>>({});
  const [quoting, setQuoting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PAYOS");
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);

  // Check stored auth token on start
  useEffect(() => {
    getStoredToken().then(setToken);
  }, []);

  useEffect(() => {
    let expired = false;
    setSessionExpiredHandler(async () => {
      if (expired) return;
      expired = true;
      queryClient.clear();
      setTrackingOrderId(null);
      setSelectedRestaurant(null);
      setScreen("home");
      setToken(null);
      showToast({
        type: "warning",
        title: "Phiên đăng nhập đã hết hạn",
        message: "Vui lòng đăng nhập lại.",
      });
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    registerPushNotifications(API_URL, token).catch(() => undefined);
  }, [token]);

  // Queries
  const restaurantsQuery = useQuery({
    queryKey: ["restaurants"],
    queryFn: restaurantApi.list,
    enabled: Boolean(token),
  });

  const foodsQuery = useQuery({
    queryKey: ["foods", selectedRestaurant?._id],
    queryFn: () => foodApi.listByRestaurant(selectedRestaurant!._id),
    enabled: Boolean(token && selectedRestaurant),
  });

  const profileQuery = useQuery({
    queryKey: ["profile", token],
    queryFn: userApi.getProfile,
    enabled: Boolean(token),
  });

  const addressBookQuery = useQuery({
    queryKey: ["addressBook", token],
    queryFn: userApi.listAddressBook,
    enabled: Boolean(token),
  });

  const cartsQuery = useQuery({
    queryKey: ["carts", token, selectedAddressId],
    queryFn: () => cartApi.list(selectedAddressId),
    enabled: Boolean(token),
  });

  const restaurantImageById = useMemo(
    () => new Map(
      (restaurantsQuery.data || []).map((restaurant) => [String(restaurant._id), restaurant.image])
    ),
    [restaurantsQuery.data]
  );
  const cartSummariesWithRestaurantImages = useMemo(
    () => (cartsQuery.data?.carts || []).map((cart) => ({
      ...cart,
      restaurant: {
        ...cart.restaurant,
        image: cart.restaurant.image
          || restaurantImageById.get(String(cart.restaurant.id))
          || "",
      },
    })),
    [cartsQuery.data?.carts, restaurantImageById]
  );
  const restaurantCart = selectRestaurantCart(cartSummariesWithRestaurantImages, selectedRestaurant?._id);
  const visibleCartId = screen === "restaurant" ? restaurantCart?.cartId || null : selectedCartId;
  const cartQuery = useQuery({
    queryKey: ["cart", token, visibleCartId],
    queryFn: () => cartApi.get(visibleCartId!),
    enabled: Boolean(token && visibleCartId),
  });
  const cartWithRestaurantImage = useMemo(() => {
    if (!cartQuery.data) return undefined;
    return {
      ...cartQuery.data,
      restaurant: {
        ...cartQuery.data.restaurant,
        image: cartQuery.data.restaurant.image
          || restaurantImageById.get(String(cartQuery.data.restaurant.id))
          || "",
      },
    };
  }, [cartQuery.data, restaurantImageById]);

  const transactionsQuery = useQuery({
    queryKey: ["userTransactions", token],
    queryFn: userApi.getTransactions,
    enabled: Boolean(token),
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", token],
    queryFn: orderApi.getUserOrders,
    enabled: Boolean(token),
    refetchInterval: screen === "track" || screen === "orders" ? 20000 : false,
  });

  const trackedOrderFromList = (ordersQuery.data || []).find((order) => order._id === trackingOrderId) || null;
  const shipperTrackingDetailQuery = useQuery({
    queryKey: ["customer-order-detail", token, trackingOrderId],
    enabled: Boolean(token && screen === "track" && trackingOrderId && isActiveShipperTrackingOrder(trackedOrderFromList)),
    queryFn: () => orderApi.getDetail(trackingOrderId!),
    refetchInterval: 20_000,
  });

  // Calculate nearby restaurants
  const customerLocation = useMemo(() => {
    if (liveLocation) return liveLocation;
    const saved = profileQuery.data?.address;
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
      return { lat: saved.lat!, lng: saved.lng! };
    }
    const addrLat = Number(address.lat);
    const addrLng = Number(address.lng);
    if (Number.isFinite(addrLat) && Number.isFinite(addrLng) && addrLat !== 0 && addrLng !== 0) {
      return { lat: addrLat, lng: addrLng };
    }
    return null;
  }, [liveLocation, profileQuery.data, address.lat, address.lng]);

  const nearbyRestaurants = useMemo(() => {
    return (restaurantsQuery.data || [])
      .filter((item) => item.isOpen !== false)
      .map((item) => {
        let distanceKm: number | null = null;
        if (
          customerLocation &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng)
        ) {
          distanceKm = haversineKm(customerLocation, {
            lat: item.lat!,
            lng: item.lng!,
          });
        }
        return { ...item, distanceKm };
      })
      .filter((item) => {
        // Only include restaurants within 15km of the user's location
        if (!customerLocation) return false;
        return item.distanceKm !== null && item.distanceKm <= NEARBY_RADIUS_KM;
      })
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
  }, [restaurantsQuery.data, customerLocation]);

  // Sync profile address
  useEffect(() => {
    if (profileQuery.data?.address) {
      const saved = profileQuery.data.address;
      setAddress((current) => ({
        fullName: saved.fullName || profileQuery.data?.name || current.fullName,
        phone: saved.phone || profileQuery.data?.phone || current.phone,
        address: saved.address || current.address,
        city: saved.city || current.city,
        state: saved.state || current.state,
        country: saved.country || current.country || "Việt Nam",
        zipCode: saved.zipCode || current.zipCode,
        lat: saved.lat != null ? String(saved.lat) : current.lat,
        lng: saved.lng != null ? String(saved.lng) : current.lng,
      }));
    }
  }, [profileQuery.data]);

  // Auto-sync default address from Address Book
  useEffect(() => {
    const list = addressBookQuery.data || [];
    if (!list.length) return;
    const defaultEntry = list.find((item) => item.isDefault) || list[0];
    if (defaultEntry && !address.address.trim()) {
      setSelectedAddressId(defaultEntry.id);
      setAddress({
        fullName: defaultEntry.recipient || defaultEntry.fullName || profileQuery.data?.name || "",
        phone: defaultEntry.phone || profileQuery.data?.phone || "",
        address: defaultEntry.address,
        city: defaultEntry.city,
        state: defaultEntry.state,
        country: defaultEntry.country || "Việt Nam",
        zipCode: defaultEntry.zipCode || "",
        lat: String(defaultEntry.lat),
        lng: String(defaultEntry.lng),
      });
    }
  }, [addressBookQuery.data]);

  // Watch GPS Location
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    let sub: Location.LocationSubscription | undefined;

    const startWatching = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (active) {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLiveLocation({ lat, lng });
          userApi.reverseGeocode(lat, lng).then((geo) => {
            if (active && geo) {
              setAddress((prev) => {
                if (prev.address.trim()) return prev;
                return {
                  ...prev,
                  ...geo,
                  lat: String(lat),
                  lng: String(lng),
                };
              });
            }
          }).catch(() => {});
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30000 },
          (p) => {
            if (active) {
              setLiveLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
            }
          }
        );
      } catch {}
    };

    startWatching();
    return () => {
      active = false;
      sub?.remove();
    };
  }, [token]);

  // Socket.io for live updates
  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("joinCustomer");
    });

    socket.on("orderStatusUpdated", (payload) => {
      queryClient.invalidateQueries({ queryKey: ["orders", token] });
      if (payload?.orderId) queryClient.invalidateQueries({ queryKey: ["customer-order-detail", token, String(payload.orderId)] });
    });

    socket.on("shipperLocationUpdated", (payload) => {
      if (!isRecord(payload) || typeof payload.orderId !== "string" || !isCoordinates(payload.location)) return;

      const orderId = payload.orderId;
      const location = payload.location;
      const route = isLiveShipperRoute(payload.route) ? payload.route : undefined;
      const routeStatus = isLiveShipperRouteStatus(payload.routeStatus) ? payload.routeStatus : undefined;
      const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();
      const mergeTracking = (order: Order): Order => {
        if (order._id !== orderId) return order;
        return {
          ...order,
          tracking: {
            ...order.tracking,
            location,
            updatedAt,
            // A GPS-only event must not discard a route that was delivered by
            // an earlier event. The server sends `unavailable` explicitly when
            // the provider route should no longer be shown.
            ...(route ? { route } : {}),
            ...(routeStatus ? { routeStatus } : {}),
          },
        };
      };
      const mergeDetailTracking = (order: Order | undefined): Order | undefined =>
        order ? mergeTracking(order) : order;

      queryClient.setQueryData<Order[]>(["orders", token], (orders) => orders?.map((order) => mergeTracking(order)));
      queryClient.setQueryData<Order>(["customer-order-detail", token, orderId], mergeDetailTracking);
    });

    return () => {
      socket.off("shipperLocationUpdated");
      socket.disconnect();
    };
  }, [token]);

  // Fetch Quotes when in Checkout
  useEffect(() => {
    if (!token || screen !== "checkout" || !selectedCartId || !cartQuery.data) return undefined;
    const lat = Number(address.lat);
    const lng = Number(address.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address.address.trim()) {
      setDeliveryQuotes({});
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setQuoting(true);
        const methods: DeliveryMethod[] = ["drone", "shipper"];
        const results = await Promise.allSettled(
          methods.map((method) =>
            orderApi.getQuote(
              selectedCartId,
              { ...address, lat, lng },
              method,
              voucherCodes,
              selectedAddressId
            )
          )
        );
        if (!active) return;
        const next: Partial<Record<DeliveryMethod, Quote>> = {};
        results.forEach((res, idx) => {
          if (res.status === "fulfilled") {
            next[methods[idx]] = res.value;
          }
        });
        setDeliveryQuotes(next);
      } finally {
        if (active) setQuoting(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, screen, address.address, address.lat, address.lng, cartQuery.data, voucherCodes, selectedAddressId, selectedCartId]);

  useEffect(() => {
    setVoucherCodes([]);
    setDeliveryQuotes({});
  }, [selectedCartId]);

  // Actions
  const handleLogout = async () => {
    if (token) await unregisterPushNotifications(API_URL, token).catch(() => undefined);
    await clearCustomerSession();
    queryClient.clear();
    setToken(null);
    setScreen("home");
    setSelectedRestaurant(null);
    setTrackingOrderId(null);
  };

  const handleUseGps = async () => {
    try {
      setWorking(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          type: "warning",
          title: "Cần quyền định vị",
          message: "Vui lòng cho phép quyền vị trí để định vị địa chỉ nhận hàng.",
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLiveLocation({ lat, lng });

      const geo = await userApi.reverseGeocode(lat, lng);
      setAddress((prev) => ({
        ...prev,
        ...(geo || {}),
        lat: String(lat),
        lng: String(lng),
      }));
      setDeliveryQuotes({});
      showToast({ type: "success", message: "Đã cập nhật vị trí GPS hiện tại của bạn." });
    } catch (cause) {
      showToast({
        type: "error",
        title: "Lỗi vị trí",
        message: apiError(cause, "Không thể lấy vị trí GPS."),
      });
    } finally {
      setWorking(false);
    }
  };

  const handleFindGeocode = async () => {
    const fullText = [address.address, address.city, address.state, address.country]
      .filter((s) => s.trim())
      .join(", ");
    if (fullText.length < 5) {
      showToast({
        type: "warning",
        title: "Thiếu địa chỉ",
        message: "Vui lòng nhập chi tiết số nhà và tên đường.",
      });
      return;
    }
    try {
      setWorking(true);
      const res = await userApi.geocode(fullText);
      if (!res) {
        showToast({
          type: "warning",
          title: "Không tìm thấy",
          message: "Không tìm được tọa độ cho địa chỉ này.",
        });
        return;
      }
      setAddress((prev) => ({
        ...prev,
        lat: String(res.lat),
        lng: String(res.lng),
      }));
      setDeliveryQuotes({});
      showToast({ type: "success", message: "Đã tìm thấy tọa độ cho địa chỉ của bạn." });
    } catch (cause) {
      showToast({ type: "error", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleSaveAddressBookEntry = async (entry: AddressBookInput, editId?: string) => {
    try {
      setWorking(true);
      if (editId) {
        await userApi.updateAddressEntry(editId, entry);
      } else {
        await userApi.createAddressEntry(entry);
      }
      await queryClient.invalidateQueries({ queryKey: ["addressBook", token] });
    } finally {
      setWorking(false);
    }
  };

  const handleSetDefaultAddressEntry = async (id: string) => {
    try {
      setWorking(true);
      await userApi.setDefaultAddressEntry(id);
      await queryClient.invalidateQueries({ queryKey: ["addressBook", token] });
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteAddressEntry = async (id: string) => {
    try {
      setWorking(true);
      await userApi.deleteAddressEntry(id);
      await queryClient.invalidateQueries({ queryKey: ["addressBook", token] });
    } finally {
      setWorking(false);
    }
  };

  const handleSelectAddressBookEntry = (entry: AddressBookEntry) => {
    setSelectedAddressId(entry.id);
    setAddress({
      fullName: entry.recipient || entry.fullName || profileQuery.data?.name || "",
      phone: entry.phone || profileQuery.data?.phone || "",
      address: entry.address,
      city: entry.city,
      state: entry.state,
      country: entry.country || "Việt Nam",
      zipCode: entry.zipCode || "",
      lat: String(entry.lat),
      lng: String(entry.lng),
    });
    setDeliveryQuotes({});
    setLiveLocation(null);
  };

  const handleApplyVoucher = async (code: string) => {
    if (!selectedCartId) throw new Error("Chưa chọn giỏ hàng.");
    const normalizedCode = code.trim().toUpperCase();
    if (voucherCodes.includes(normalizedCode)) {
      throw new Error("Mã voucher này đã được áp dụng.");
    }

    try {
      setWorking(true);
      const lat = Number(address.lat);
      const lng = Number(address.lng);
      const nextVoucherCodes = [...voucherCodes, normalizedCode];
      const quote = await orderApi.getQuote(
        selectedCartId,
        { ...address, lat: Number.isFinite(lat) ? lat : 0, lng: Number.isFinite(lng) ? lng : 0 },
        deliveryMethod,
        nextVoucherCodes,
        selectedAddressId
      );
      setVoucherCodes(nextVoucherCodes);
      setDeliveryQuotes((prev) => ({ ...prev, [deliveryMethod]: quote }));
    } catch (cause) {
      throw cause;
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveVoucher = async (code: string) => {
    if (!selectedCartId) return;
    const nextVoucherCodes = voucherCodes.filter((voucherCode) => voucherCode !== code);
    try {
      setWorking(true);
      const lat = Number(address.lat);
      const lng = Number(address.lng);
      const quote = await orderApi.getQuote(
        selectedCartId,
        { ...address, lat: Number.isFinite(lat) ? lat : 0, lng: Number.isFinite(lng) ? lng : 0 },
        deliveryMethod,
        nextVoucherCodes,
        selectedAddressId
      );
      setVoucherCodes(nextVoucherCodes);
      setDeliveryQuotes((prev) => ({ ...prev, [deliveryMethod]: quote }));
    } catch (cause) {
      throw cause;
    } finally {
      setWorking(false);
    }
  };

  const handleAddToCart = async (
    food: Food,
    quantity: number,
    selectedOptions: { groupName: string; optionName: string }[]
  ) => {
    try {
      setWorking(true);
      const updated = await cartApi.add(food._id, quantity, selectedOptions);
      if (updated?.cartId) queryClient.setQueryData(["cart", token, updated.cartId], updated);
      await queryClient.invalidateQueries({ queryKey: ["carts", token] });
      setSelectedFoodForModal(null);
      showToast({
        type: "success",
        title: "Đã thêm món",
        message: `Đã thêm ${quantity}x "${food.name}" vào giỏ hàng!`,
      });
    } catch (cause) {
      showToast({ type: "error", title: "Lỗi thêm món", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleUpdateCartQuantity = async (line: CartLine, quantity: number) => {
    if (!selectedCartId) return;
    try {
      setWorking(true);
      const updated = await cartApi.updateLine(selectedCartId, line.lineKey, quantity);
      // A quote belongs to a particular server-priced cart version. Once the
      // mutation succeeds, hide the previous quote until the checkout effect
      // receives a new server quote for this basket.
      setDeliveryQuotes({});
      if (!updated?.items?.length) {
        queryClient.removeQueries({ queryKey: ["cart", token, selectedCartId] });
        setSelectedCartId(null);
        setScreen("cart");
      } else {
        queryClient.setQueryData(["cart", token, selectedCartId], updated);
      }
      await queryClient.invalidateQueries({ queryKey: ["cart", token, selectedCartId] });
      await queryClient.invalidateQueries({ queryKey: ["carts", token] });
    } catch (cause) {
      showToast({ type: "error", title: "Lỗi giỏ hàng", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleCustomizeCartLine = async (line: CartLine) => {
    try {
      setWorking(true);
      const food = await foodApi.get(line.foodId);
      setEditingCartLine(line);
      setSelectedFoodForModal(food);
    } catch (cause) {
      showToast({ type: "error", title: "Không thể tùy chỉnh món", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleOptionModalSubmit = async (
    food: Food,
    quantity: number,
    selectedOptions: { groupName: string; optionName: string }[]
  ) => {
    if (!editingCartLine) {
      await handleAddToCart(food, quantity, selectedOptions);
      return;
    }
    if (!selectedCartId) return;

    try {
      setWorking(true);
      // A cart line's key is derived from its options. Replacing the old line
      // with a server-validated new line matches the existing web cart flow.
      const removed = await cartApi.updateLine(selectedCartId, editingCartLine.lineKey, 0);
      if (!removed) return;
      const updated = await cartApi.add(food._id, quantity, selectedOptions);
      if (updated?.cartId) {
        queryClient.setQueryData(["cart", token, updated.cartId], updated);
        setDeliveryQuotes({});
      }
      await queryClient.invalidateQueries({ queryKey: ["cart", token, selectedCartId] });
      await queryClient.invalidateQueries({ queryKey: ["carts", token] });
      setEditingCartLine(null);
      setSelectedFoodForModal(null);
    } catch (cause) {
      showToast({ type: "error", title: "Không thể cập nhật món", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleClearCart = async () => {
    if (!selectedCartId) return;
    try {
      await cartApi.clear(selectedCartId);
      queryClient.removeQueries({ queryKey: ["cart", token, selectedCartId] });
      await queryClient.invalidateQueries({ queryKey: ["carts", token] });
      setSelectedCartId(null);
      setScreen("cart");
    } catch (cause) {
      showToast({ type: "error", title: "Không thể xóa giỏ hàng", message: apiError(cause) });
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedCartId || !cartQuery.data) {
      showToast({
        type: "error",
        title: "Giỏ hàng không hợp lệ",
        message: "Vui lòng chọn lại giỏ hàng của nhà hàng.",
      });
      setScreen("cart");
      return;
    }
    const required = [address.fullName, address.address, address.city, address.state, address.phone];
    if (required.some((f) => !f.trim())) {
      showToast({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.",
      });
      return;
    }
    const lat = Number(address.lat);
    const lng = Number(address.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      showToast({
        type: "warning",
        title: "Thiếu tọa độ GPS",
        message: "Cần có tọa độ vị trí để tính toán lộ trình bay của Drone.",
      });
      return;
    }

    try {
      setWorking(true);
      // Save address first
      await userApi.updateAddress({ ...address, lat: String(lat), lng: String(lng) });
      await queryClient.invalidateQueries({ queryKey: ["profile", token] });

      const res = await orderApi.place({
        cartId: selectedCartId,
        cartVersion: cartQuery.data.cartVersion,
        address: { ...address, lat, lng },
        addressEntryId: selectedAddressId,
        deliveryMethod,
        paymentMethod,
        voucherCodes: voucherCodes.length > 0 ? voucherCodes : undefined,
      });

      queryClient.removeQueries({ queryKey: ["cart", token, selectedCartId] });
      await queryClient.invalidateQueries({ queryKey: ["carts", token] });
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });

      setTrackingOrderId(res.orderId);
      setScreen("track");

      if (!res.zeroPayableVoucherCheckout && paymentMethod === "PAYOS" && (res.checkoutUrl || res.paymentUrl)) {
        const payUrl = res.checkoutUrl || res.paymentUrl;
        showToast({
          type: "success",
          title: "Đặt đơn thành công",
          message: "Mở PayOS để hoàn tất thanh toán an toàn.",
          duration: 8000,
          primaryAction: {
            label: "Thanh toán PayOS",
            onPress: () => {
              if (payUrl) void Linking.openURL(payUrl);
            },
          },
        });
      } else {
        showToast({
          type: "success",
          title: "Đặt đơn thành công",
          message: `Mã đơn hàng: #${res.orderId.slice(-6).toUpperCase()}`,
        });
      }
    } catch (cause) {
      showToast({ type: "error", title: "Không thể đặt đơn", message: apiError(cause) });
      const status = (cause as { response?: { status?: number } })?.response?.status;
      if (status === 409 && selectedCartId) {
        await queryClient.invalidateQueries({ queryKey: ["cart", token, selectedCartId] });
        setScreen("cart-detail");
      } else if (status === 404) {
        setSelectedCartId(null);
        await queryClient.invalidateQueries({ queryKey: ["carts", token] });
        setScreen("cart");
      }
    } finally {
      setWorking(false);
    }
  };

  const handleOpenCargo = async (order: Order) => {
    if (!order.qrCode) {
      showToast({
        type: "warning",
        title: "Chưa có mã QR",
        message: "Mã bảo mật đang được đồng bộ, vui lòng thử lại.",
      });
      return;
    }
    try {
      setWorking(true);
      const res = await droneApi.scanQr(order._id, order.qrCode);
      showToast({
        type: "success",
        title: "Đã mở khoang hàng",
        message: res.message || "Khoang hàng Drone đang mở trong 5 giây!",
      });
      await ordersQuery.refetch();
    } catch (cause) {
      showToast({ type: "error", title: "Không thể mở khoang", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleConfirmDelivery = async (order: Order) => {
    try {
      setWorking(true);
      const res = await droneApi.confirmDelivery(order._id);
      showToast({
        type: "success",
        title: "Hoàn tất",
        message: res.message || "Bạn đã xác nhận nhận đủ hàng thành công!",
      });
      await ordersQuery.refetch();
    } catch (cause) {
      showToast({ type: "error", title: "Không thể xác nhận", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string) => {
    try {
      setWorking(true);
      await orderApi.cancel(orderId, reason);
      showToast({ type: "success", title: "Đã hủy đơn", message: "Đơn hàng đã được hủy thành công." });
      await ordersQuery.refetch();
    } catch (cause) {
      showToast({ type: "error", title: "Không thể hủy", message: apiError(cause) });
    } finally {
      setWorking(false);
    }
  };

  // Find tracking order
  const trackingOrder = trackedOrderFromList || (ordersQuery.data || [])[0] || null;

  // Active order for banner
  const activeOrder = useMemo(() => {
    return (ordersQuery.data || []).find((o) =>
      ["preparing", "delivering", "arrived_at_delivery"].includes(o.orderStatus)
    );
  }, [ordersQuery.data]);

  const cartCount = getCartBadgeCount(cartSummariesWithRestaurantImages);
  const floatingSurface = floatingSurfaceForScreen(
    screen,
    Boolean(activeOrder),
    Boolean(restaurantCart && cartQuery.data)
  );

  if (!token) {
    return <AuthScreen onSuccess={setToken} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AmbientBackground>
        <StatusBar style="dark" />

      {/* Active Order Banner appears only on the Explore screen. */}
      {activeOrder && floatingSurface === "active-order" ? (
        <ActiveOrderBanner
          order={activeOrder}
          onPress={(o) => {
            setTrackingOrderId(o._id);
            setScreen("track");
          }}
        />
      ) : null}

      {/* Screen Router */}
      <View style={styles.content}>
        {screen === "home" && (
          <HomeScreen
            restaurants={nearbyRestaurants}
            loading={restaurantsQuery.isLoading}
            onRefresh={() => restaurantsQuery.refetch()}
            userProfile={profileQuery.data}
            onLocateGps={handleUseGps}
            locating={working}
            hasLocation={Boolean(customerLocation)}
            currentAddressText={address.address}
            onOpenAddressBook={() => setAddressPickerOpen(true)}
            onNavigateSearch={(keyword) => {
              setSearchInitialQuery(keyword || "");
              setScreen("search");
            }}
            onSelectRestaurant={(r) => {
              setSelectedRestaurant(r);
              setScreen("restaurant");
            }}
          />
        )}

        {screen === "search" && (
          <SearchScreen
            restaurants={nearbyRestaurants}
            initialQuery={searchInitialQuery}
            onBack={() => setScreen("home")}
            onSelectRestaurant={(r) => {
              setSelectedRestaurant(r);
              setScreen("restaurant");
            }}
            onSelectFood={(food, restaurant) => {
              if (restaurant) setSelectedRestaurant(restaurant);
              setSelectedFoodForModal(food);
            }}
          />
        )}

        {screen === "restaurant" && selectedRestaurant && (
          <RestaurantDetailScreen
            restaurant={selectedRestaurant}
            foods={foodsQuery.data || []}
            loading={foodsQuery.isLoading}
            onBack={() => setScreen("home")}
            onSelectFood={(food) => setSelectedFoodForModal(food)}
          />
        )}

        {screen === "cart" && (
          <CartIndexScreen
            carts={cartSummariesWithRestaurantImages}
            loading={cartsQuery.isLoading}
            onOpenCart={(cartId) => {
              setSelectedCartId(cartId);
              setScreen("cart-detail");
            }}
            onExploreFood={() => setScreen("home")}
          />
        )}

        {screen === "cart-detail" && (
          <CartScreen
            cart={cartWithRestaurantImage}
            loading={cartQuery.isLoading}
            onUpdateQuantity={handleUpdateCartQuantity}
            onClearCart={handleClearCart}
            onProceedCheckout={() => setScreen("checkout")}
            onExploreFood={() => setScreen("home")}
            onBack={() => setScreen("cart")}
          />
        )}

        {screen === "checkout" && (
          <CheckoutScreen
            cart={cartWithRestaurantImage}
            address={address}
            onAddressChange={(k, v) => {
              setSelectedAddressId(undefined);
              setAddress((prev) => ({ ...prev, [k]: v }));
            }}
            onUseGps={handleUseGps}
            onFindGeocode={handleFindGeocode}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            quotes={deliveryQuotes}
            quoting={quoting}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            onPlaceOrder={handlePlaceOrder}
            working={working}
            onBack={() => setScreen("cart-detail")}
            addressBook={addressBookQuery.data || []}
            selectedAddressId={selectedAddressId}
            onSelectSavedAddress={handleSelectAddressBookEntry}
            onSaveNewAddress={handleSaveAddressBookEntry}
            userProfile={profileQuery.data}
            voucherCodes={voucherCodes}
            onApplyVoucher={handleApplyVoucher}
            onRemoveVoucher={handleRemoveVoucher}
            onUpdateQuantity={handleUpdateCartQuantity}
            onCustomizeLine={handleCustomizeCartLine}
          />
        )}

        {screen === "orders" && (
          <OrdersScreen
            orders={ordersQuery.data || []}
            loading={ordersQuery.isLoading}
            onRefresh={() => ordersQuery.refetch()}
            onTrackOrder={(o) => {
              setTrackingOrderId(o._id);
              setScreen("track");
            }}
            onReviewFlowChanged={(orderId, updatedFlow) => {
              queryClient.setQueryData<Order[]>(["orders", token], (orders) =>
                orders?.map((order) => order._id === orderId ? { ...order, reviewFlow: updatedFlow } : order) || orders
              );
            }}
          />
        )}

        {screen === "track" && isCompletedOrder(trackingOrder) ? (
          <CompletedOrderDetailScreen
            order={trackingOrder}
            loading={ordersQuery.isLoading}
            onBack={() => setScreen("orders")}
          />
        ) : screen === "track" && isActiveShipperTrackingOrder(trackingOrder) ? (
          <ShipperTrackingScreen
            order={shipperTrackingDetailQuery.data ?? trackingOrder}
            loading={ordersQuery.isLoading || shipperTrackingDetailQuery.isLoading}
            onBack={() => setScreen("orders")}
          />
        ) : screen === "track" ? (
          <DroneTrackingScreen
            order={trackingOrder}
            loading={ordersQuery.isLoading}
            onBack={() => setScreen("orders")}
            onOpenCargo={handleOpenCargo}
            onConfirmDelivery={handleConfirmDelivery}
            onCancelOrder={handleCancelOrder}
            working={working}
          />
        ) : null}

        {screen === "profile" && (
          <ProfileScreen
            profile={profileQuery.data}
            loading={profileQuery.isLoading}
            savedAddress={address}
            addressBook={addressBookQuery.data || []}
            onSaveAddressEntry={handleSaveAddressBookEntry}
            onSetDefaultAddress={handleSetDefaultAddressEntry}
            onDeleteAddressEntry={handleDeleteAddressEntry}
            onUpdateProfile={async (name, phone) => {
              await userApi.updateProfile(name, phone);
              await profileQuery.refetch();
            }}
            onUpdateAvatar={async (asset) => {
              await userApi.updateAvatar(asset);
              await profileQuery.refetch();
            }}
            onChangePassword={async (currentPassword, newPassword) => {
              await userApi.changePassword(currentPassword, newPassword);
              await handleLogout();
            }}
            transactions={transactionsQuery.data?.transactions || []}
            transactionsLoading={transactionsQuery.isLoading}
            onRefreshTransactions={() => transactionsQuery.refetch()}
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Floating Cart Capsule */}
      {floatingSurface === "restaurant-cart" && restaurantCart && cartQuery.data ? (
        <FloatingCartBar
          cart={cartWithRestaurantImage}
          onPress={() => {
            setSelectedCartId(restaurantCart.cartId);
            setScreen("cart-detail");
          }}
        />
      ) : null}

      {/* Bottom Tab Bar */}
      {screen !== "search" ? (
        <TabBar
          currentTab={screen}
          onTabChange={(tab) => {
            if (tab === "home") setSelectedRestaurant(null);
            setScreen(tab);
          }}
          cartCount={cartCount}
        />
      ) : null}

      {/* Option Group Modal for custom food toppings/sizes */}
      <OptionGroupModal
        food={selectedFoodForModal}
        loading={working}
        onClose={() => {
          setSelectedFoodForModal(null);
          setEditingCartLine(null);
        }}
        onAddToCart={handleOptionModalSubmit}
        initial={editingCartLine ? { quantity: editingCartLine.quantity, selectedOptions: editingCartLine.selectedOptions } : undefined}
        submitLabel={editingCartLine ? "Lưu tùy chỉnh" : undefined}
      />

      {/* Quick Address Picker Modal for Home Screen */}
      <AddressBookModal
        visible={addressPickerOpen}
        onClose={() => setAddressPickerOpen(false)}
        entries={addressBookQuery.data || []}
        selectedId={
          (addressBookQuery.data || []).find(
            (e) => e.address.trim() === address.address.trim()
          )?.id
        }
        onSelectAddress={handleSelectAddressBookEntry}
        onSaveEntry={handleSaveAddressBookEntry}
        onSetDefault={handleSetDefaultAddressEntry}
        onDeleteEntry={handleDeleteAddressEntry}
        onUseGpsCurrent={handleUseGps}
        mode="select"
        userProfile={profileQuery.data}
      />
      </AmbientBackground>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CustomerApp />
      </ToastProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
  },
});
