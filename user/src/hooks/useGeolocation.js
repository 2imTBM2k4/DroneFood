import { useCallback, useState } from "react";

// Wraps the browser Geolocation API. Calling `locate()` triggers the native
// permission prompt (the same popup GrabFood shows on first visit) and, on
// success, returns high-accuracy coordinates.
//
// High accuracy asks the browser to use GPS / Wi-Fi / cell data instead of a
// coarse IP lookup. Requires a secure context (HTTPS or localhost).
const messageForError = (error) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Enable it in your browser to auto-fill your address.";
    case error.POSITION_UNAVAILABLE:
      return "Your location is currently unavailable. Try again or pick a point on the map.";
    case error.TIMEOUT:
      return "Locating you took too long. Try again.";
    default:
      return "Could not get your location.";
  }
};

/** Request one browser location fix with the supplied accuracy preference. */
const requestPosition = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

export default function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  const locate = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      const message = "Geolocation is not supported by this browser.";
      setError(message);
      return { error: message };
    }

    setLoading(true);
    setError(null);

    try {
      let position;
      let usedApproximateLocation = false;

      try {
        // GPS can take a long time indoors. Give it a short opportunity first
        // so a precise delivery pin remains the preferred result.
        position = await requestPosition({
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 0,
        });
      } catch (highAccuracyError) {
        if (
          highAccuracyError.code !== highAccuracyError.TIMEOUT &&
          highAccuracyError.code !== highAccuracyError.POSITION_UNAVAILABLE
        ) {
          throw highAccuracyError;
        }

        // A network-based fix is normally much quicker. The map still lets
        // customers refine its pin before they submit the delivery address.
        position = await requestPosition({
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000,
        });
        usedApproximateLocation = true;
      }

      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setCoords(next);
      return { coords: next, usedApproximateLocation };
    } catch (geoError) {
      const message = messageForError(geoError);
      setError(message);
      return { error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, coords, error, locate };
}
