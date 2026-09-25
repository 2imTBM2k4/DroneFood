/**
 * Utility functions for checking restaurant opening hours.
 * Default schedule: 07:00 to 22:00 in Asia/Ho_Chi_Minh timezone.
 */

export function getVietnamCurrentTime(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date); // Returns "HH:mm"
}

export function isRestaurantOpenNow(restaurant, date = new Date()) {
  if (!restaurant) return false;
  if (restaurant.isOpen === false || restaurant.isLocked === true) {
    return false;
  }

  const openingHours = restaurant.openingHours || {};
  const openTime = openingHours.openTime || "07:00";
  const closeTime = openingHours.closeTime || "22:00";

  const currentTime = getVietnamCurrentTime(date);

  // If openTime and closeTime are equal, consider it open 24/7
  if (openTime === closeTime) {
    return true;
  }

  if (openTime < closeTime) {
    // Normal daytime schedule (e.g., 07:00 to 22:00)
    return currentTime >= openTime && currentTime < closeTime;
  } else {
    // Overnight schedule (e.g., 18:00 to 02:00)
    return currentTime >= openTime || currentTime < closeTime;
  }
}
