/**
 * Address Book Component (REQ-1618)
 *
 * Customer-facing address book on the Dashboard: list saved addresses,
 * add/edit inline (no modal, no extra route), delete with confirmation,
 * and mark one address as default.
 */

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { MapPin, Plus, Pencil, Trash2, Star, Home } from "lucide-react";
import { useAddresses, useCreateAddress, useUpdateAddress, useDeleteAddress } from "../../../hooks/useUser";
import {
  Card,
  FormInput,
  FormLabel,
  FormCheckbox,
  FormError,
  LoadingState,
  AddressLines,
  RippleButton,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui";
import type { Address } from "../../../types";
import type { AddressInput } from "../../../services";

const EMPTY_FORM: AddressInput = {
  label: "",
  fullName: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  phone: "",
  isDefault: false,
};

type FormErrors = Partial<Record<keyof AddressInput, string>>;

function validate(form: AddressInput): FormErrors {
  const errors: FormErrors = {};
  if (!form.fullName.trim()) errors.fullName = "Full name is required";
  if (!form.street1.trim()) errors.street1 = "Street address is required";
  if (!form.city.trim()) errors.city = "City is required";
  if (!form.state.trim()) errors.state = "State is required";
  if (!form.zip.trim()) errors.zip = "ZIP/postal code is required";
  return errors;
}

export const AddressBook = () => {
  const { data: addresses = [], isLoading } = useAddresses();
  const createMutation = useCreateAddress();
  const updateMutation = useUpdateAddress();
  const deleteMutation = useDeleteAddress();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEditForm = (address: Address) => {
    setEditingId(address.id);
    setForm({
      label: address.label || "",
      fullName: address.fullName,
      street1: address.street1,
      street2: address.street2 || "",
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone || "",
      isDefault: address.isDefault,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (errors[name as keyof AddressInput]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors = validate(form);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (editingId) {
      updateMutation.mutate({ addressId: editingId, input: form }, { onSuccess: closeForm });
    } else {
      createMutation.mutate(form, { onSuccess: closeForm });
    }
  };

  const handleDeleteConfirm = () => {
    if (!addressToDelete) return;
    deleteMutation.mutate(addressToDelete.id, { onSuccess: () => setAddressToDelete(null) });
  };

  return (
    <Card className="mb-6">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" strokeWidth={2} />
            <h2 className="text-lg font-medium text-gray-700 dark:text-white">Address Book</h2>
          </div>
          {!formOpen && (
            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Add Address
            </button>
          )}
        </div>

        {isLoading && <LoadingState message="Loading addresses..." />}

        {!isLoading && formOpen && (
          <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="label">Label</FormLabel>
                <FormInput id="label" name="label" value={form.label} onChange={handleChange} placeholder="Home, Work, etc." />
              </div>
              <div>
                <FormLabel htmlFor="fullName" required>Full Name</FormLabel>
                <FormInput id="fullName" name="fullName" value={form.fullName} onChange={handleChange} error={errors.fullName} />
                {errors.fullName && <FormError message={errors.fullName} />}
              </div>
            </div>

            <div>
              <FormLabel htmlFor="street1" required>Street Address</FormLabel>
              <FormInput id="street1" name="street1" value={form.street1} onChange={handleChange} error={errors.street1} />
              {errors.street1 && <FormError message={errors.street1} />}
            </div>

            <div>
              <FormLabel htmlFor="street2">Apt / Suite (optional)</FormLabel>
              <FormInput id="street2" name="street2" value={form.street2} onChange={handleChange} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel htmlFor="city" required>City</FormLabel>
                <FormInput id="city" name="city" value={form.city} onChange={handleChange} error={errors.city} />
                {errors.city && <FormError message={errors.city} />}
              </div>
              <div>
                <FormLabel htmlFor="state" required>State</FormLabel>
                <FormInput id="state" name="state" value={form.state} onChange={handleChange} error={errors.state} />
                {errors.state && <FormError message={errors.state} />}
              </div>
              <div>
                <FormLabel htmlFor="zip" required>ZIP</FormLabel>
                <FormInput id="zip" name="zip" value={form.zip} onChange={handleChange} error={errors.zip} />
                {errors.zip && <FormError message={errors.zip} />}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="country">Country</FormLabel>
                <FormInput id="country" name="country" value={form.country} onChange={handleChange} maxLength={2} />
              </div>
              <div>
                <FormLabel htmlFor="phone">Phone (optional)</FormLabel>
                <FormInput id="phone" name="phone" value={form.phone} onChange={handleChange} />
              </div>
            </div>

            <FormCheckbox id="isDefault" name="isDefault" checked={form.isDefault} onChange={handleChange} label="Set as default address" />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <RippleButton
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-lg font-medium bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : editingId ? "Save Changes" : "Add Address"}
              </RippleButton>
            </div>
          </form>
        )}

        {!isLoading && addresses.length === 0 && !formOpen && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No saved addresses yet. Add one to speed up future orders.</p>
        )}

        {!isLoading && addresses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((address) => (
              <div key={address.id} className="p-4 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Home className="h-4 w-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
                    <span className="text-sm font-medium text-gray-700 dark:text-white truncate">{address.label || "Address"}</span>
                  </div>
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
                      <Star className="h-3 w-3" strokeWidth={2} fill="currentColor" />
                      Default
                    </span>
                  )}
                </div>
                <AddressLines address={address} className="text-sm text-gray-600 dark:text-gray-300 space-y-0.5 mb-3" />
                {address.phone && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{address.phone}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => openEditForm(address)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressToDelete(address)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!addressToDelete} onOpenChange={(open) => !open && setAddressToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              {addressToDelete ? `Are you sure you want to delete "${addressToDelete.label || addressToDelete.fullName}"? This action cannot be undone.` : "Are you sure you want to delete this address?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteMutation.isPending} className="bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
