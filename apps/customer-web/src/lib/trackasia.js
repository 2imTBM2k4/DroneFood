// TrackAsia geocoding client — turns coordinates into Vietnamese addresses and
// suggests addresses as the user types. v2 responses are Google-Maps-shaped.
//
// The `key` is required. `public_key` works for development but is rate-limited;
// set VITE_TRACKASIA_KEY to your own key for production.
const KEY = import.meta.env.VITE_TRACKASIA_KEY || "public_key";
const BASE = "https://maps.track-asia.com/api/v2";

// Pull the pieces the checkout form needs out of a v2 result. Vietnam's admin
// levels map as: level_1 = province/city, level_2 = district, level_3 = ward.
const parseResult = (result) => {
  const components = result.address_components || [];
  const pick = (type) =>
    components.find((c) => c.types?.includes(type))?.long_name || "";

  const streetNumber = pick("street_number");
  const route = pick("route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();

  return {
    formatted: result.formatted_address || "",
    street: street || result.name || "",
    ward: pick("administrative_area_level_3"),
    state: pick("administrative_area_level_2"), // district
    city: pick("administrative_area_level_1"), // province / city
    country: pick("country") || "Vietnam",
    zipcode: pick("postal_code"),
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
  };
};

// Coordinates -> nearest address. Returns null when nothing is found.
export async function reverseGeocode(lat, lng) {
  const url =
    `${BASE}/geocode/json?latlng=${lat},${lng}` +
    `&key=${KEY}&new_admin=true&size=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reverse geocode failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;
  return parseResult(data.results[0]);
}

// Typed text -> address suggestions. `near` biases results toward a location.
export async function autocomplete(input, near) {
  if (!input?.trim()) return [];
  let url = `${BASE}/place/autocomplete/json?input=${encodeURIComponent(
    input
  )}&key=${KEY}&new_admin=true&size=6`;
  if (near?.lat && near?.lng) url += `&location=${near.lat},${near.lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Autocomplete failed: ${res.status}`);
  const data = await res.json();
  return data.predictions || data.results || [];
}
