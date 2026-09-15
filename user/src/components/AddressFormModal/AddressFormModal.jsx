import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import LocationPicker from "../LocationPicker/LocationPicker";
import { emptyDeliveryAddress } from "./addressFormModel";
import "./AddressFormModal.css";

const AddressFormModal = ({ open, title, description, initial, fullName, submitLabel, saving = false, onClose, onSubmit }) => {
  const [form, setForm] = useState(emptyDeliveryAddress);
  const closeRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyDeliveryAddress, ...initial });
      requestAnimationFrame(() => closeRef.current?.focus());
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, saving]);

  if (!open) return null;

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resolveLocation = (location) => setForm((current) => ({
    ...current,
    address: location.street || current.address,
    city: location.city || current.city,
    state: location.state || current.state,
    country: location.country || current.country,
    zipCode: location.zipcode || current.zipCode,
    lat: location.lat,
    lng: location.lng,
  }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit({ ...form, lat: Number(form.lat), lng: Number(form.lng) });
  };

  return <div className="address-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
      <header><div><p className="address-modal-kicker"><MapPin size={14} aria-hidden="true" /> Delivery address</p><h2 id="address-modal-title">{title}</h2>{description && <p>{description}</p>}</div><button ref={closeRef} type="button" className="address-modal-close" onClick={onClose} disabled={saving} aria-label="Close address form"><X size={18} /></button></header>
      <form onSubmit={submit}>
        {submitLabel.toLowerCase().includes("save") && <label>Address label<input required name="label" value={form.label} onChange={change} placeholder="Home, office…" /></label>}
        <label>Fullname<input value={fullName || ""} readOnly aria-readonly="true" /></label>
        <label>Phone<input required type="tel" name="phone" value={form.phone} onChange={change} autoComplete="tel" /></label>
        <div className="address-modal-map"><LocationPicker initial={Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) ? { lat: Number(form.lat), lng: Number(form.lng) } : null} onResolve={resolveLocation} /></div>
        <label className="address-modal-wide">Street address<input required name="address" value={form.address} onChange={change} autoComplete="street-address" /></label>
        <label>City<input required name="city" value={form.city} onChange={change} autoComplete="address-level2" /></label>
        <label>Province / state<input required name="state" value={form.state} onChange={change} autoComplete="address-level1" /></label>
        <label>Country<input required name="country" value={form.country} onChange={change} autoComplete="country-name" /></label>
        <label>Postal code<input name="zipCode" value={form.zipCode} onChange={change} autoComplete="postal-code" /></label>
        <label>Latitude<input required type="number" step="any" name="lat" value={form.lat ?? ""} onChange={change} /></label>
        <label>Longitude<input required type="number" step="any" name="lng" value={form.lng ?? ""} onChange={change} /></label>
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</button></footer>
      </form>
    </section>
  </div>;
};

export default AddressFormModal;
