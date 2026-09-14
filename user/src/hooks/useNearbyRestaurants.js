import { useContext, useMemo } from "react";
import { StoreContext } from "../context/StoreContext";
import {
  haversineKm,
  estimateEtaMinutes,
  isMajorCityAddress,
  NEARBY_RADIUS_KM,
} from "../lib/distance";

/**
 * Restaurants that can deliver to the customer right now: within range,
 * annotated with distance/ETA and sorted nearest first. Each one also carries
 * the cuisines it serves, so the browse page can filter by category without a
 * second pass over the menu.
 *
 * Without a saved location we fall back to the major cities.
 */
export default function useNearbyRestaurants() {
  const { restaurant_list, food_list, user, liveLocation, fees } =
    useContext(StoreContext);

  const customer = useMemo(() => {
    if (
      typeof liveLocation?.lat === "number" &&
      typeof liveLocation?.lng === "number"
    ) {
      return { lat: liveLocation.lat, lng: liveLocation.lng };
    }

    const a = user?.address;
    return a && typeof a.lat === "number" && typeof a.lng === "number"
      ? { lat: a.lat, lng: a.lng }
      : null;
  }, [liveLocation, user]);

  // restaurantId -> the categories that restaurant actually serves.
  const categoriesByRestaurant = useMemo(() => {
    const map = new Map();
    food_list.forEach((food) => {
      if (!food.category) return;
      const key = String(food.restaurantId);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(food.category);
    });
    return map;
  }, [food_list]);

  const restaurants = useMemo(() => {
    const annotated = restaurant_list
      .map((r) => {
        const distanceKm =
          customer && typeof r.lat === "number" && typeof r.lng === "number"
            ? haversineKm(customer, { lat: r.lat, lng: r.lng })
            : null;
        const configuredDroneRate = fees?.rates?.droneRatePerKm;
        const estimatedDeliveryFee =
          typeof distanceKm === "number" &&
          typeof configuredDroneRate === "number"
            ? Math.ceil(distanceKm * configuredDroneRate)
            : null;
        const rawRating = Number(r.averageRating ?? r.rating);
        const rating =
          Number.isFinite(rawRating) && rawRating >= 0 && rawRating <= 5
            ? rawRating
            : null;
        return {
          ...r,
          distanceKm,
          etaMin: estimateEtaMinutes(distanceKm),
          estimatedDeliveryFee,
          rating,
          categories: [...(categoriesByRestaurant.get(String(r._id)) || [])],
        };
      })
      // A restaurant the owner has switched to "closed" is not on offer.
      .filter((r) => r.isOpen !== false)
      .filter((r) =>
        customer
          ? r.distanceKm !== null && r.distanceKm <= NEARBY_RADIUS_KM
          : isMajorCityAddress(r.address)
      );

    if (customer) annotated.sort((a, b) => a.distanceKm - b.distanceKm);
    return annotated;
  }, [restaurant_list, categoriesByRestaurant, customer, fees]);

  // Cuisines offered by the restaurants on show, nearest-first order.
  const categories = useMemo(() => {
    const seen = [];
    restaurants.forEach((r) =>
      r.categories.forEach((c) => {
        if (!seen.includes(c)) seen.push(c);
      })
    );
    return seen;
  }, [restaurants]);

  return { restaurants, categories, customer };
}
