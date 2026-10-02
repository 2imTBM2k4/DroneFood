const hasCoordinates = (location) =>
  typeof location?.lat === "number" && typeof location?.lng === "number";

const coordinatesOf = (location) =>
  hasCoordinates(location) ? { lat: location.lat, lng: location.lng } : null;

export const CURRENT_LOCATION_ID = "__current_location__";

/**
 * Resolve the coordinates used for restaurant discovery and delivery metadata.
 * An explicit navbar address choice takes precedence over the browser's live
 * location so changing the dropdown immediately recalculates nearby results.
 */
export const resolveDeliveryCoordinates = ({ user, restaurantLocationId, liveLocation }) => {
  if (restaurantLocationId === CURRENT_LOCATION_ID) {
    return coordinatesOf(liveLocation) || coordinatesOf(user?.address);
  }

  const selectedAddress = (user?.addressBook || []).find(
    (entry) => String(entry.id || entry._id) === String(restaurantLocationId)
  );

  return coordinatesOf(selectedAddress)
    || coordinatesOf(liveLocation)
    || coordinatesOf(user?.address);
};
