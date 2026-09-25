import axios from "axios";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { clearCustomerAuthStorage, createCustomerClient } from "../api/customerClient";
import { reverseGeocode } from "../lib/trackasia";
import { haversineKm } from "../lib/distance";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  // The cart is a list of LINES, not a map of foodId -> quantity: the same
  // dish with different options is two lines. Each line is
  // { lineKey, foodId, name, image, basePrice, unitPrice, quantity,
  //   selectedOptions, note, restaurantId } and comes priced by the server.
  const [cartLines, setCartLines] = useState([]);
  const [cartRestaurantId, setCartRestaurantId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  // This is the explicit saved delivery choice used by navbar and checkout.
  // It must never be overwritten by browser GPS updates.
  const [activeAddressId, setActiveAddressIdState] = useState(() => localStorage.getItem("activeAddressId") || "");
  // This is intentionally separate from the saved delivery address. It is
  // only used to keep nearby-restaurant results current while the customer
  // moves, and must not silently change where an order will be delivered.
  const [liveLocation, setLiveLocation] = useState(null);
  const [liveAddress, setLiveAddress] = useState(null);
  const lastGeocodedLocation = useRef(null);
  const geocodeRequestId = useRef(0);
  const url = import.meta.env.VITE_API_URL;
  const [token, setToken] = useState("");
  const customerClient = useMemo(() => createCustomerClient(url), [url]);
  const customerApi = customerClient.api;
  const resetCustomerSessionExpiry = useCallback(() => customerClient.resetSessionExpiryNotification(), [customerClient]);
  const [food_list, setFoodList] = useState([]);
  const [restaurant_list, setRestaurantList] = useState([]);
  const [isLoadingFoods, setIsLoadingFoods] = useState(true);
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(true);
  const [restaurantError, setRestaurantError] = useState(null);
  const [fees, setFees] = useState({ deliveryFee: null, serviceFee: 0, rates: null });
  // False until the saved token has been read AND the cart fetched. Guards
  // that redirect on "no token" or "empty cart" must wait for this, or a
  // direct hit on /checkout bounces before the session is restored.
  const [isHydrated, setIsHydrated] = useState(false);

  const setActiveAddressId = useCallback((id) => {
    const next = id || "";
    setActiveAddressIdState(next);
    if (next) localStorage.setItem("activeAddressId", next);
    else localStorage.removeItem("activeAddressId");
  }, []);

  const fetchFoodList = useCallback(async () => {
    try {
      setIsLoadingFoods(true);
      const res = await axios.get(`${url}/api/food/list`);
      if (res.data.success) {
        setFoodList(res.data.data || []);
      } else {
        throw new Error(res.data.message || "Failed to load foods");
      }
    } catch (err) {
      setFoodList([]);
    } finally {
      setIsLoadingFoods(false);
    }
  }, [url]);

  const fetchRestaurantList = useCallback(async () => {
    try {
      setIsLoadingRestaurants(true);
      setRestaurantError(null);
      const res = await axios.get(`${url}/api/restaurant/list`);
      if (res.data.success) {
        setRestaurantList(res.data.data || []);
      } else {
        throw new Error(res.data.message || "Failed to load restaurants");
      }
    } catch (err) {
      console.error("Fetch restaurant error:", err);
      setRestaurantError(err.message || "Failed to load restaurants");
    } finally {
      setIsLoadingRestaurants(false);
    }
  }, [url]);

  // The rate card comes from the server. A delivery price is intentionally not
  // known until checkout has both delivery coordinates and a chosen method.
  const fetchFees = useCallback(async () => {
    try {
      const res = await axios.get(`${url}/api/config/fees`);
      if (res.data.success) {
        setFees({
          deliveryFee: null,
          serviceFee: res.data.serviceFee ?? 0,
          rates: {
            shipperRatePerKm: res.data.shipperRatePerKm,
            droneRatePerKm: res.data.droneRatePerKm,
          },
        });
      }
    } catch (err) {
      console.error("Fetch fees error:", err);
    }
  }, [url]);

  const fetchSingleFood = async (itemId) => {
    const res = await axios.get(`${url}/api/food/${itemId}`);
    if (res.data.success) {
      return res.data.data;
    }
    throw new Error(res.data.message || "Food not found");
  };

  /** Every cart endpoint returns the whole cart; this is the single sink. */
  const applyCartResponse = useCallback((data) => {
    setCartLines(data?.items || []);
    setCartRestaurantId(data?.restaurantId || null);
  }, []);

  const clearLocalCart = useCallback(() => {
    setCartLines([]);
    setCartRestaurantId(null);
  }, []);

  const loadCartData = useCallback(async () => {
    try {
      const res = await customerApi.get("/api/cart/get");
      if (res.data.success) {
        applyCartResponse(res.data);
      } else {
        clearLocalCart();
      }
    } catch (err) {
      console.error("Load cart error:", err);
      clearLocalCart();
    }
  }, [applyCartResponse, clearLocalCart, customerApi]);

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await customerApi.get("/api/user/me");
      if (res.data.success) setUser(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, [customerApi]);

  /**
   * Add a dish, optionally with option picks and a kitchen note. The server
   * validates the picks against the dish and prices them, then returns the
   * updated cart.
   */
  const addToCart = async (
    itemId,
    quantity = 1,
    selectedOptions = [],
    note = ""
  ) => {
    if (!token) {
      toast.warning("Please sign in to continue!");
      setShowLogin(true);
      return false;
    }

    try {
      const res = await customerApi.post("/api/cart/add", { itemId, quantity, selectedOptions, note });
      if (!res.data.success) throw new Error(res.data.message || "Add failed");
      applyCartResponse(res.data);
      return true;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "";
      if (msg.toLowerCase().includes("one restaurant")) {
        toast.warning("You can only add items from one restaurant!");
      } else {
        toast.error(msg || "Failed to add to cart");
      }
      return false;
    }
  };

  /** Set a line's quantity outright. Quantity 0 removes it. */
  const updateLine = async (lineKey, quantity) => {
    if (!token) return false;
    try {
      const res = await customerApi.post("/api/cart/update-line", { lineKey, quantity });
      if (!res.data.success) throw new Error(res.data.message);
      applyCartResponse(res.data);
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update cart");
      return false;
    }
  };

  /** Remove a whole line in one request, whatever its quantity. */
  const removeLine = async (lineKey) => {
    if (!token) return false;
    try {
      const res = await customerApi.post("/api/cart/remove-line", { lineKey });
      if (!res.data.success) throw new Error(res.data.message);
      applyCartResponse(res.data);
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to remove item");
      return false;
    }
  };

  const clearCart = async () => {
    if (!token) {
      clearLocalCart();
      return;
    }
    try {
      const res = await customerApi.post("/api/cart/clear", {});
      if (res.data.success) clearLocalCart();
    } catch (err) {
      console.error("Clear cart error:", err);
    }
  };

  const getTotalCartAmount = useCallback(
    () =>
      cartLines.reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0
      ),
    [cartLines]
  );

  const getCartItemCount = useCallback(
    () => cartLines.reduce((count, line) => count + line.quantity, 0),
    [cartLines]
  );

  useEffect(() => {
    async function init() {
      await fetchFoodList();
      await fetchRestaurantList();
      await fetchFees();
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        setToken(savedToken);
      } else {
        // No session to restore, so hydration ends here.
        setIsHydrated(true);
      }
    }
    init();
  }, [fetchFees, fetchFoodList, fetchRestaurantList]);

  // `watchPosition` continues to report movement after the initial browser
  // permission prompt. Starting it at app level means both the home page and
  // the restaurant browse page receive the same up-to-date location.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return undefined;
    }

    let isMounted = true;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMounted) return;

        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLiveLocation(nextLocation);

        // GPS may report many tiny accuracy adjustments while stationary.
        // Refresh the readable address on the first fix and after moving 100m
        // so the UI stays current without flooding the geocoding service.
        if (
          lastGeocodedLocation.current &&
          haversineKm(lastGeocodedLocation.current, nextLocation) < 0.1
        ) {
          return;
        }

        lastGeocodedLocation.current = nextLocation;
        setLiveAddress(null);
        const requestId = ++geocodeRequestId.current;
        reverseGeocode(nextLocation.lat, nextLocation.lng)
          .then((address) => {
            if (isMounted && requestId === geocodeRequestId.current && address) {
              setLiveAddress(address);
            }
          })
          .catch(() => {
            // Keep the last resolved address if a transient lookup fails.
            if (requestId === geocodeRequestId.current) {
              lastGeocodedLocation.current = null;
            }
          });
      },
      () => {
        // Keep the saved address as the fallback if location permission is
        // denied or a later GPS update is unavailable.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const logoutCustomer = useCallback(() => {
    clearCustomerAuthStorage();
    setToken("");
    setUser(null);
    clearLocalCart();
    localStorage.removeItem("cartItems");
    localStorage.removeItem("cartRestaurantId");
  }, [clearLocalCart]);

  useEffect(() => {
    let notified = false;
    customerClient.setSessionExpiredHandler(() => {
      if (notified) return;
      notified = true;
      logoutCustomer();
      setShowLogin(true);
      toast.info("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    });
    return () => customerClient.setSessionExpiredHandler(null);
  }, [customerClient, logoutCustomer]);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
      loadCartData().finally(() => setIsHydrated(true));
    } else {
      clearLocalCart();
      setUser(null);
      localStorage.removeItem("cartItems");
      localStorage.removeItem("cartRestaurantId");
    }
  }, [clearLocalCart, fetchUserInfo, loadCartData, token]);

  useEffect(() => {
    if (!user?.addressBook?.length) return;
    const stillExists = user.addressBook.some((entry) => String(entry.id || entry._id) === activeAddressId);
    if (!stillExists) {
      const fallback = user.addressBook.find((entry) => entry.isDefault) || user.addressBook[0];
      setActiveAddressId(String(fallback.id || fallback._id));
    }
  }, [activeAddressId, setActiveAddressId, user?.addressBook]);

  const contextValue = {
    food_list,
    restaurant_list,
    cartLines,
    addToCart,
    updateLine,
    removeLine,
    clearCart,
    getTotalCartAmount,
    getCartItemCount,
    fetchSingleFood,
    fees,
    url,
    token,
    setToken,
    customerApi,
    logoutCustomer,
    resetCustomerSessionExpiry,
    showLogin,
    setShowLogin,
    cartRestaurantId,
    user,
    setUser,
    activeAddressId,
    setActiveAddressId,
    liveLocation,
    liveAddress,
    isLoadingFoods,
    isLoadingRestaurants,
    restaurantError,
    fetchRestaurantList,
    isHydrated,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreContextProvider;
