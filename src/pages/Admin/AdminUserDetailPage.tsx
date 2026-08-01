/**
 * AdminUserDetailPage Component
 *
 * User detail page for admin panel.
 * Displays full user information including orders and account details.
 * Uses React Query for efficient data fetching and caching.
 */

import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, Package, Star, Home } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useUser } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { PageHeader, StatusBadge, LoadingState, ErrorState, Card, AddressLines } from "../../components/ui";
import { formatDateLong } from "../../utils/formatDate";
import { formatPrice } from "../../utils/formatPrice";
import { isDemoAccount } from "../../utils/demoAccount";

// Inner component that uses the AdminLayout context
const AdminUserDetailContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useUser(userId);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load user details", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  // Check if this is a demo account (protected from edit/delete)
  const demoAccount = user ? isDemoAccount(user.email) : false;

  // Defensive fallback: a persisted query-cache entry from before REQ-1618
  // shipped won't have `orders`/`addresses` on it yet (see REQ-1616's
  // product.tags bug for the same class of issue).
  const addresses = user?.addresses || [];
  const orders = user?.orders || [];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="User Details" description="View user account information" onToggleSidebar={toggleSidebar} showBackButton={true} onBack={() => navigate("/admin/users")} />

      {isLoading && <LoadingState message="Loading user details..." />}

      {error && !isLoading && <ErrorState message={error.message || "Failed to load user details"} />}

      {!isLoading && !error && user && (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Account Information</h2>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</dt>
                    <dd className="text-sm text-gray-700 dark:text-white font-mono">{user.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{user.name || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{user.email || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                    <dd className="mt-1">
                      <StatusBadge status={user.role || "user"} />
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Account Status</h2>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Registered</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{formatDateLong(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Verified</dt>
                    <dd className="mt-1">
                      <StatusBadge status={user.emailVerified ? "verified" : "unverified"} customLabels={{ verified: "Yes", unverified: "No" }} />
                    </dd>
                  </div>
                  {demoAccount && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Type</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Demo Account (Protected)</span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </Card>

          {/* Address Book — REQ-1618: read-only view of this customer's saved addresses */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-400" strokeWidth={2} />
              <h2 className="text-lg font-medium text-gray-700 dark:text-white">
                Address Book {addresses.length > 0 && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({addresses.length})</span>}
              </h2>
            </div>
            {addresses.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No saved addresses.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((address) => (
                  <div key={address.id} className="p-4 rounded-lg border border-gray-200 dark:border-slate-700">
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
                    <AddressLines address={address} className="text-sm text-gray-600 dark:text-gray-300 space-y-0.5" />
                    {address.phone && <p className="text-sm text-gray-600 dark:text-gray-300">{address.phone}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Order History — REQ-1618: this customer's orders, clickable through to the admin order detail page */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
              <h2 className="text-lg font-medium text-gray-700 dark:text-white">
                Order History {orders.length > 0 && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({orders.length})</span>}
              </h2>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No orders placed yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/admin/orders/${order.id}`}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{order.id}</span>
                      <StatusBadge status={order.status || "pending"} />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{formatDateLong(order.createdAt)}</span>
                      <span className="font-medium text-gray-700 dark:text-white">${formatPrice(order.amount_paid)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/admin/users/${user.id}/edit`)}
              disabled={demoAccount}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                demoAccount ? "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed" : "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
              }`}
              title={demoAccount ? "Demo accounts cannot be edited" : "Edit user"}
            >
              Edit User
            </button>
            <button onClick={() => navigate("/admin/users")} className="px-4 py-2 rounded-lg font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              Back to Users
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminUserDetailPage = () => {
  useTitle("Admin User Details");
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
      <AdminUserDetailContent />
    </AdminLayout>
  );
};
