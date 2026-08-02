/**
 * Admin Coupons Page (REQ-1658)
 *
 * Discount-code CRUD for admins — inline add/edit form (same pattern as the
 * customer-facing AddressBook, no generic modal component exists in this
 * codebase) + a list table with delete confirmation.
 */

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { useTitle } from "../../hooks/useTitle";
import { useAdminCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon } from "../../hooks/useCoupon";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import {
  Card,
  PageHeader,
  FormInput,
  FormLabel,
  FormSelect,
  FormCheckbox,
  FormError,
  LoadingState,
  ErrorState,
  EmptyState,
  DataTable,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui";
import type { Coupon, CreateCouponInput } from "../../services/couponService";

const columnHelper = createColumnHelper<Coupon>();

const EMPTY_FORM: CreateCouponInput = {
  code: "",
  type: "percent",
  value: 0,
  minOrderAmount: null,
  maxUses: null,
  expiresAt: null,
  active: true,
};

type FormErrors = Partial<Record<keyof CreateCouponInput, string>>;

function validate(form: CreateCouponInput): FormErrors {
  const errors: FormErrors = {};
  if (!form.code.trim()) errors.code = "Code is required";
  if (!form.value || form.value <= 0) errors.value = "A positive value is required";
  if (form.type === "percent" && form.value > 100) errors.value = "Percent discount cannot exceed 100";
  return errors;
}

const AdminCouponsContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { data: coupons = [], isLoading, error, refetch } = useAdminCoupons();
  const createMutation = useCreateCoupon();
  const updateMutation = useUpdateCoupon();
  const deleteMutation = useDeleteCoupon();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCouponInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  };

  const openEditForm = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
      maxUses: coupon.maxUses,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : null,
      active: coupon.active,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "value" || name === "minOrderAmount" || name === "maxUses" ? (value === "" ? null : Number(value)) : value,
    }));
    if (errors[name as keyof CreateCouponInput]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors = validate(form);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payload: CreateCouponInput = {
      ...form,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, input: payload }, { onSuccess: closeForm });
    } else {
      createMutation.mutate(payload, { onSuccess: closeForm });
    }
  };

  const handleDeleteConfirm = () => {
    if (!couponToDelete) return;
    deleteMutation.mutate(couponToDelete.id, { onSuccess: () => setCouponToDelete(null) });
  };

  const tableColumns = [
    columnHelper.accessor("code", {
      header: "Code",
      cell: (info) => <span className="font-mono text-sm font-medium text-gray-700 dark:text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor(
      (coupon) => (coupon.type === "percent" ? `${coupon.value}% off` : `$${coupon.value.toFixed(2)} off`),
      { id: "discount", header: "Discount", cell: (info) => info.getValue() },
    ),
    columnHelper.accessor((coupon) => `${coupon.timesUsed}${coupon.maxUses ? ` / ${coupon.maxUses}` : ""}`, {
      id: "usage",
      header: "Usage",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((coupon) => (coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "Never"), {
      id: "expiresAt",
      header: "Expires",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("active", {
      header: "Status",
      cell: (info) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            info.getValue() ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {info.getValue() ? "Active" : "Inactive"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const coupon = info.row.original;
        return (
          <div className="flex items-center gap-2">
            <button onClick={() => openEditForm(coupon)} className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" aria-label="Edit coupon">
              <Pencil className="h-4 w-4" strokeWidth={2} />
            </button>
            <button onClick={() => setCouponToDelete(coupon)} className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" aria-label="Delete coupon">
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader
        title="Coupons"
        description="Manage checkout discount codes"
        onToggleSidebar={toggleSidebar}
        actions={
          !formOpen && (
            <button
              onClick={openAddForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Create Coupon</span>
            </button>
          )
        }
      />

      {formOpen && (
        <Card className="p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white">
            <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
            {editingId ? "Edit Coupon" : "New Coupon"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="code" required>Code</FormLabel>
                <FormInput id="code" name="code" value={form.code} onChange={handleChange} placeholder="e.g. WELCOME10" error={errors.code} />
                <FormError message={errors.code} />
              </div>
              <div>
                <FormLabel htmlFor="type" required>Discount Type</FormLabel>
                <FormSelect
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  options={[
                    { value: "percent", label: "Percent off" },
                    { value: "fixed", label: "Fixed amount off" },
                  ]}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FormLabel htmlFor="value" required>
                  Value {form.type === "percent" ? "(%)" : "($)"}
                </FormLabel>
                <FormInput id="value" name="value" type="number" step="0.01" min="0" value={form.value} onChange={handleChange} error={errors.value} />
                <FormError message={errors.value} />
              </div>
              <div>
                <FormLabel htmlFor="minOrderAmount">Min Order ($)</FormLabel>
                <FormInput id="minOrderAmount" name="minOrderAmount" type="number" step="0.01" min="0" value={form.minOrderAmount ?? ""} onChange={handleChange} placeholder="No minimum" />
              </div>
              <div>
                <FormLabel htmlFor="maxUses">Max Uses</FormLabel>
                <FormInput id="maxUses" name="maxUses" type="number" step="1" min="1" value={form.maxUses ?? ""} onChange={handleChange} placeholder="Unlimited" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <FormLabel htmlFor="expiresAt">Expires On</FormLabel>
                <FormInput id="expiresAt" name="expiresAt" type="date" value={form.expiresAt ?? ""} onChange={handleChange} />
              </div>
              <FormCheckbox id="active" name="active" checked={form.active ?? true} onChange={handleChange} label="Active" />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={closeForm} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50">
                {isSaving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {isLoading && <LoadingState message="Loading coupons..." />}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load coupons"} onRetry={refetch} />}

      {!isLoading && !error && (
        <Card className="p-0">
          {coupons.length === 0 ? (
            <EmptyState message="No coupons yet" />
          ) : (
            <DataTable data={coupons} columns={tableColumns} defaultSorting={[{ id: "code", desc: false }]} />
          )}
        </Card>
      )}

      <AlertDialog open={!!couponToDelete} onOpenChange={(open) => !open && setCouponToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              {couponToDelete ? `Are you sure you want to delete "${couponToDelete.code}"? This action cannot be undone.` : "Are you sure?"}
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
    </div>
  );
};

export const AdminCouponsPage = () => {
  useTitle("Coupons - Admin");
  return (
    <AdminLayout>
      <AdminCouponsContent />
    </AdminLayout>
  );
};
