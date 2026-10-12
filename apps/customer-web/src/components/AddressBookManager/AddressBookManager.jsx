import { useCallback, useContext, useEffect, useState } from "react";
import { StoreContext } from "../../context/StoreContext";
import { notificationService } from "@drone-food/web-ui/utils/toast";
import AddressFormModal from "../AddressFormModal/AddressFormModal";
import { emptyDeliveryAddress } from "../AddressFormModal/addressFormModel";
import ConfirmModal from "@drone-food/web-ui/components/ConfirmModal";
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
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      if (active) {
        notificationService.error(
          "Không thể tải sổ địa chỉ",
          error.response?.data?.message || "Vui lòng kiểm tra kết nối mạng và thử lại.",
          {
            audience: "user",
            priority: "high",
            key: "address-book-load",
            actions: [{ label: "Thử lại", onClick: refresh }],
          }
        );
      }
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
      notificationService.success(editingId ? "Đã cập nhật địa chỉ" : "Đã lưu địa chỉ", undefined, { audience: "user" });
    } catch (error) {
      notificationService.error(
        "Không thể lưu địa chỉ",
        error.response?.data?.message || "Vui lòng kiểm tra lại thông tin và thử lại.",
        {
          audience: "user",
          priority: "high",
          key: "address-book-save",
          actions: [{ label: "Thử lại", onClick: () => save(nextForm) }],
        }
      );
    } finally { setSaving(false); }
  };
  const makeDefault = async (entry) => {
    try { await customerApi.put(`/api/address-book/${entry.id}/default`, {}); await refresh(); }
    catch (error) {
      notificationService.error(
        "Không thể đổi địa chỉ mặc định",
        error.response?.data?.message || "Vui lòng thử lại sau.",
        {
          audience: "user",
          priority: "high",
          key: `address-default-${entry.id}`,
          actions: [{ label: "Thử lại", onClick: () => makeDefault(entry) }],
        }
      );
    }
  };
  const confirmDelete = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      await customerApi.delete(`/api/address-book/${deletingEntry.id}`);
      await refresh();
      notificationService.success("Đã xóa địa chỉ thành công", undefined, { audience: "user" });
      setDeletingEntry(null);
    } catch (error) {
      notificationService.error(
        "Không thể xóa địa chỉ",
        error.response?.data?.message || "Vui lòng thử lại sau.",
        {
          audience: "user",
          priority: "high",
          key: `address-delete-${deletingEntry.id}`,
          actions: [{ label: "Thử lại", onClick: confirmDelete }],
        }
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return <div className="address-book-manager">
    <div className="address-book-heading"><div><h3>Saved delivery addresses</h3><p>Your fullname comes from your profile. Orders keep their own delivery snapshot.</p></div><button type="button" className="address-book-new" onClick={startNew}>Add address</button></div>
    {loading ? <div className="address-book-loading">Loading addresses…</div> : <div className="address-book-list" aria-live="polite">
      {entries.length === 0 && <p className="address-book-empty">No saved address yet. Add one to use it in checkout.</p>}
      {entries.map((entry) => <article className={`address-book-card ${entry.isDefault ? "is-default" : ""}`} key={entry.id}>
        <div><div className="address-book-card-title"><strong>{entry.label}</strong>{entry.isDefault && <span>Default</span>}</div><p>{fullName || entry.recipient} · {entry.phone}</p><p>{entry.address}, {entry.city}, {entry.state}, {entry.country}</p></div>
        <div className="address-book-actions"><button type="button" onClick={() => edit(entry)} aria-label={`Edit ${entry.label}`}>Edit</button>{!entry.isDefault && <button type="button" onClick={() => makeDefault(entry)} aria-label={`Set ${entry.label} as default`}>Set default</button>}{!entry.isDefault && <button type="button" className="address-book-delete" onClick={() => setDeletingEntry(entry)} aria-label={`Delete ${entry.label}`}>Delete</button>}</div>
      </article>)}
    </div>}
    <AddressFormModal open={formOpen} title={editingId ? "Edit saved address" : "Add a saved address"} description="This address will be available from your address book and navbar." initial={form} fullName={fullName} submitLabel="Save address" saving={saving} onClose={() => { if (!saving) { setFormOpen(false); setEditingId(null); } }} onSubmit={save} />
    <ConfirmModal
      open={Boolean(deletingEntry)}
      title="Xóa địa chỉ"
      message={deletingEntry ? `Bạn có chắc muốn xóa địa chỉ “${deletingEntry.label}”?` : ""}
      confirmText="Xóa địa chỉ"
      cancelText="Giữ lại"
      danger
      isLoading={isDeleting}
      onClose={() => setDeletingEntry(null)}
      onConfirm={confirmDelete}
    />
  </div>;
};

export default AddressBookManager;
