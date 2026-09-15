import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import LocationPicker from "../LocationPicker/LocationPicker";
import "./AddressBookManager.css";

const emptyEntry = {
  label: "", recipient: "", phone: "", address: "", city: "", state: "", country: "Việt Nam", zipCode: "", lat: null, lng: null,
};

const toForm = (entry) => ({ ...emptyEntry, ...entry });

const AddressBookManager = ({ url, token, onChange }) => {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyEntry);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const config = useMemo(() => ({ headers: { token } }), [token]);
  const refresh = useCallback(async () => {
    const response = await axios.get(`${url}/api/address-book`, config);
    const next = response.data.data || [];
    setEntries(next);
    onChange?.(next);
    return next;
  }, [config, onChange, url]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    refresh().catch((error) => {
      if (active) toast.error(error.response?.data?.message || "Could not load saved addresses");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, token]);

  const edit = (entry) => { setEditingId(entry.id); setForm(toForm(entry)); };
  const startNew = () => { setEditingId(null); setForm(emptyEntry); };
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

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
      if (editingId) await axios.patch(`${url}/api/address-book/${editingId}`, payload, config);
      else await axios.post(`${url}/api/address-book`, payload, config);
      await refresh();
      startNew();
      toast.success(editingId ? "Address updated" : "Address saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save address");
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (entry) => {
    try { await axios.put(`${url}/api/address-book/${entry.id}/default`, {}, config); await refresh(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not change default address"); }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete “${entry.label}”?`)) return;
    try { await axios.delete(`${url}/api/address-book/${entry.id}`, config); await refresh(); if (editingId === entry.id) startNew(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not delete address"); }
  };

  return (
    <div className="address-book-manager">
      <div className="address-book-heading"><div><h3>Saved delivery addresses</h3><p>Choose one default for faster checkout. Orders keep their own delivery snapshot.</p></div><button type="button" className="address-book-new" onClick={startNew}><Plus size={16} aria-hidden="true" />Add address</button></div>
      {loading ? <div className="address-book-loading">Loading addresses…</div> : (
        <div className="address-book-list" aria-live="polite">
          {entries.length === 0 && <p className="address-book-empty">No saved address yet. Add one below.</p>}
          {entries.map((entry) => <article className={`address-book-card ${entry.isDefault ? "is-default" : ""}`} key={entry.id}>
            <div><div className="address-book-card-title"><strong>{entry.label}</strong>{entry.isDefault && <span><Star size={13} fill="currentColor" aria-hidden="true" />Default</span>}</div><p>{entry.recipient} · {entry.phone}</p><p>{entry.address}, {entry.city}, {entry.state}, {entry.country}</p></div>
            <div className="address-book-actions"><button type="button" onClick={() => edit(entry)} aria-label={`Edit ${entry.label}`}><Pencil size={16} aria-hidden="true" />Edit</button>{!entry.isDefault && <button type="button" onClick={() => makeDefault(entry)} aria-label={`Set ${entry.label} as default`}><Star size={16} aria-hidden="true" />Set default</button>}{!entry.isDefault && <button type="button" className="address-book-delete" onClick={() => remove(entry)} aria-label={`Delete ${entry.label}`}><Trash2 size={16} aria-hidden="true" />Delete</button>}</div>
          </article>)}
        </div>
      )}
      <form className="address-book-form" onSubmit={save}>
        <h3>{editingId ? "Edit address" : "Add a delivery address"}</h3>
        <LocationPicker initial={Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) ? { lat: Number(form.lat), lng: Number(form.lng) } : null} onResolve={resolveLocation} />
        <div className="address-book-fields">
          <label>Label<input required name="label" value={form.label} onChange={change} placeholder="Home, office…" /></label>
          <label>Recipient<input required name="recipient" value={form.recipient} onChange={change} /></label>
          <label>Phone<input required type="tel" name="phone" value={form.phone} onChange={change} /></label>
          <label className="span-2">Street address<input required name="address" value={form.address} onChange={change} /></label>
          <label>City<input required name="city" value={form.city} onChange={change} /></label>
          <label>Province / state<input required name="state" value={form.state} onChange={change} /></label>
          <label>Country<input required name="country" value={form.country} onChange={change} /></label>
          <label>Postal code<input name="zipCode" value={form.zipCode} onChange={change} /></label>
          <label>Latitude<input required type="number" step="any" name="lat" value={form.lat ?? ""} onChange={change} /></label>
          <label>Longitude<input required type="number" step="any" name="lng" value={form.lng ?? ""} onChange={change} /></label>
        </div>
        <div className="address-book-form-actions"><button type="submit" className="profile-save" disabled={saving}>{saving ? "Saving…" : editingId ? "Save address" : "Add address"}</button>{editingId && <button type="button" className="address-book-cancel" onClick={startNew}>Cancel</button>}</div>
      </form>
    </div>
  );
};

export default AddressBookManager;
