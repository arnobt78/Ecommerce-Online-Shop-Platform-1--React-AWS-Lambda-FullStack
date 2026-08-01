/**
 * AdminUserEditPage Component
 *
 * Page for editing an existing user.
 * Allows updating user name, email, and role.
 * Uses React Query for efficient data fetching and caching.
 */

import { useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useUser, useUpdateUser } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { PageHeader, StatusBadge, LoadingState, ErrorState, Card, FormInput, FormSelect, FormLabel } from "../../components/ui";
import { formatDateShort } from "../../utils/formatDate";
import { isDemoAccount } from "../../utils/demoAccount";

interface UserEditFormData {
  name: string;
  email: string;
  role: string;
}

// Inner component that uses the AdminLayout context
const AdminUserEditContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useUser(userId);
  const updateUserMutation = useUpdateUser();

  const [formData, setFormData] = useState<UserEditFormData>({ name: "", email: "", role: "user" });

  // Initialize form data when user data loads. Necessarily an effect (not a
  // pure render-time derivation) because formData becomes independently
  // editable afterward and must not be reset on every re-render.
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable form state from an async fetch, see comment above
      setFormData({
        name: user.name || "",
        email: user.email || "",
        role: user.role || "user",
      });
    }
  }, [user]);

  // Check if this is a demo account (protected from edit)
  const demoAccount = user ? isDemoAccount(user.email) : false;

  // Redirect if demo account
  useEffect(() => {
    if (user && demoAccount) {
      toast.error("Demo accounts cannot be edited", { closeButton: true, position: "bottom-right" });
      navigate(`/admin/users/${userId}`);
    }
  }, [user, demoAccount, navigate, userId]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load user details", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required", { closeButton: true, position: "bottom-right" });
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Email is required", { closeButton: true, position: "bottom-right" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address", { closeButton: true, position: "bottom-right" });
      return;
    }

    if (demoAccount) {
      toast.error("Demo accounts cannot be edited", { closeButton: true, position: "bottom-right" });
      return;
    }

    if (!userId) return;

    try {
      await updateUserMutation.mutateAsync({
        userId,
        updates: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
        },
      });
      navigate(`/admin/users/${userId}`);
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Update user error:", error);
    }
  };

  const roleOptions = [
    { value: "user", label: "User" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="Edit User" description="Update user information" onToggleSidebar={toggleSidebar} showBackButton={true} onBack={() => navigate(`/admin/users/${userId}`)} />

      {isLoading && <LoadingState message="Loading user details..." />}

      {error && !isLoading && <ErrorState message={error.message || "Failed to load user details"} />}

      {!isLoading && !error && user && !demoAccount && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <FormLabel htmlFor="name" required>
                Name
              </FormLabel>
              <FormInput id="name" name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="Enter user name" />
            </div>

            <div>
              <FormLabel htmlFor="email" required>
                Email
              </FormLabel>
              <FormInput id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="Enter user email" />
            </div>

            <div>
              <FormLabel htmlFor="role" required>
                Role
              </FormLabel>
              <FormSelect id="role" name="role" value={formData.role} onChange={handleChange} required options={roleOptions} />
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Information:</div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={user.role || "user"} />
                <span className="text-sm text-gray-500 dark:text-gray-400">Registered: {formatDateShort(user.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateUserMutation.isPending ? "Updating..." : "Update User"}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/users/${userId}`)}
                disabled={updateUserMutation.isPending}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

export const AdminUserEditPage = () => {
  useTitle("Edit User - Admin");
  const navigate = useNavigate();

  useEffect(() => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin") {
      toast.error("Admin access required", { closeButton: true, position: "bottom-right" });
      navigate("/products");
    }
  }, [navigate]);

  return (
    <AdminLayout>
      <AdminUserEditContent />
    </AdminLayout>
  );
};
