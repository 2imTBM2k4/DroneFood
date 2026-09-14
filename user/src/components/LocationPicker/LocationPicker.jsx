import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import useGeolocation from "../../hooks/useGeolocation";
import { reverseGeocode } from "../../lib/trackasia";
import "./LocationPicker.css";

// Leaflet's default marker images 404 under bundlers; point them at a CDN, the
// same fix the drone-tracking map uses.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7008 }; // Ho Chi Minh City

// Keeps the Leaflet view following the picked point without remounting the map.
function Recenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

// Lets the user drop the pin by clicking the map.
function ClickToPlace({ onPick }) {
  useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });
  return null;
}

/**
 * Map-based location picker. The user can:
 *  - press "Use my current location" (browser prompt + high-accuracy fix), or
 *  - drag the pin / click the map to fine-tune the exact drop point.
 *
 * Every move reverse-geocodes through TrackAsia and reports the resolved
 * address plus coordinates via `onResolve`.
 */
export default function LocationPicker({ initial, onResolve }) {
  const [position, setPosition] = useState(initial || null);
  const [address, setAddress] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [locationNotice, setLocationNotice] = useState(null);
  const markerRef = useRef(null);
  const { loading: locating, locate } = useGeolocation();

  // Resolve a coordinate to an address and bubble it up.
  const resolve = async (coords) => {
    setPosition(coords);
    setResolving(true);
    setGeoError(null);
    setLocationNotice(null);
    try {
      const result = await reverseGeocode(coords.lat, coords.lng);
      if (result) {
        setAddress(result);
        onResolve?.({ ...result, lat: coords.lat, lng: coords.lng });
      } else {
        setGeoError("No address found for this point.");
      }
    } catch {
      setGeoError("Address lookup failed. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const handleLocate = async () => {
    setGeoError(null);
    const { coords, error, usedApproximateLocation } = await locate();
    if (error) {
      setGeoError(error);
      return;
    }
    await resolve(coords);
    if (usedApproximateLocation) {
      setLocationNotice("We found an approximate location. Drag the pin to your exact delivery point.");
    }
  };

  const handleDragEnd = () => {
    const marker = markerRef.current;
    if (!marker) return;
    const { lat, lng } = marker.getLatLng();
    resolve({ lat, lng });
  };

  const center = position || DEFAULT_CENTER;

  return (
    <div className="location-picker">
      <div className="location-picker-actions">
        <button
          type="button"
          className="location-locate-btn"
          onClick={handleLocate}
          disabled={locating || resolving}
        >
          {locating || resolving ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <LocateFixed size={16} />
          )}
          {locating ? "Locating…" : "Use my current location"}
        </button>
        <span className="location-hint">
          or drag the pin / tap the map to set the exact spot
        </span>
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={16}
        className="location-map"
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <Recenter position={position} />
        <ClickToPlace onPick={resolve} />
        {position && (
          <Marker
            position={[position.lat, position.lng]}
            draggable
            ref={markerRef}
            eventHandlers={{ dragend: handleDragEnd }}
          />
        )}
      </MapContainer>

      {address?.formatted && (
        <p className="location-resolved">
          <MapPin size={14} />
          <span>{address.formatted}</span>
        </p>
      )}
      {geoError && <p className="location-error">{geoError}</p>}
      {locationNotice && <p className="location-notice">{locationNotice}</p>}
    </div>
  );
}
