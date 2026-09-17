import { useCallback, useContext, useEffect, useState } from "react";
import { StoreContext } from "../../context/StoreContext";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import AddressFormModal from "../AddressFormModal/AddressFormModal";
import { emptyDeliveryAddress } from "../AddressFormModal/addressFormModel";
import "./AddressBookManager.css";

const toForm = (entry) => ({ ...emptyDeliveryAddress, ...entry });

const AddressBookManager = ({ fullName, onChange }) => {
  const { customerApi, token } = useContext(StoreContext);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyDeliveryAddress);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const refresh = useCallback(async () => {
    const response = await customerApi.get("/api/address-book");
    const next = response.data.data || [];
    setEntries(next);
    onChange?.(next);
    return next;
  }, [customerApi, onChange]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    refresh().catch((error) => {
      if (active) toast.error(error.response?.data?.message || "Could not load saved addresses");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, token]);

  const startNew = () => { setEditingId(null); setForm(emptyDeliveryAddress); setFormOpen(true); };
  const edit = (entry) => { setEditingId(entry.id); setForm(toForm(entry)); setFormOpen(true); };
  const save = async (nextForm) => {
    setSaving(true);
    try {
      const addressFields = Object.fromEntries(Object.entries(nextForm).filter(([key]) => key !== "recipient"));
      const payload = { ...addressFields, lat: Number(addressFields.lat), lng: Number(addressFields.lng) };
      if (editingId) await customerApi.patch(`/api/address-book/${editingId}`, payload);
      else await customerApi.post("/api/address-book", payload);
      await refresh();
      setFormOpen(false);
      setEditingId(null);
      toast.success(editingId ? "Address updated" : "Address saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save address");
    } finally { setSaving(false); }
  };
  const makeDefault = async (entry) => {
    try { await customerApi.put(`/api/address-book/${entry.id}/default`, {}); await refresh(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not change default address"); }
  };
  const remove = async (entry) => {
    if (!window.confirm(`Delete “${entry.label}”?`)) return;
    try { await customerApi.delete(`/api/address-book/${entry.id}`); await refresh(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not delete address"); }
  };

  return <div className="address-book-manager">
    <div className="address-book-heading"><div><h3>Saved delivery addresses</h3><p>Your fullname comes from your profile. Orders keep their own delivery snapshot.</p></div><button type="button" className="address-book-new" onClick={startNew}><Plus size={16} aria-hidden="true" />Add address</button></div>
    {loading ? <div className="address-book-loading">Loading addresses…</div> : <div className="address-book-list" aria-live="polite">
      {entries.length === 0 && <p className="address-book-empty">No saved address yet. Add one to use it in checkout.</p>}
      {entries.map((entry) => <article className={`address-book-card ${entry.isDefault ? "is-default" : ""}`} key={entry.id}>
        <div><div className="address-book-card-title"><strong>{entry.label}</strong>{entry.isDefault && <span><Star size={13} fill="currentColor" aria-hidden="true" />Default</span>}</div><p>{fullName || entry.recipient} · {entry.phone}</p><p>{entry.address}, {entry.city}, {entry.state}, {entry.country}</p></div>
        <div className="address-book-actions"><button type="button" onClick={() => edit(entry)} aria-label={`Edit ${entry.label}`}><Pencil size={16} aria-hidden="true" />Edit</button>{!entry.isDefault && <button type="button" onClick={() => makeDefault(entry)} aria-label={`Set ${entry.label} as default`}><Star size={16} aria-hidden="true" />Set default</button>}{!entry.isDefault && <button type="button" className="address-book-delete" onClick={() => remove(entry)} aria-label={`Delete ${entry.label}`}><Trash2 size={16} aria-hidden="true" />Delete</button>}</div>
      </article>)}
    </div>}
    <AddressFormModal open={formOpen} title={editingId ? "Edit saved address" : "Add a saved address"} description="This address will be available from your address book and navbar." initial={form} fullName={fullName} submitLabel="Save address" saving={saving} onClose={() => { if (!saving) { setFormOpen(false); setEditingId(null); } }} onSubmit={save} />
  </div>;
};

export default AddressBookManager;
