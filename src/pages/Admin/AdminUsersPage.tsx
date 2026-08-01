/**
 * AdminUsersPage Component
 *
 * Users management page for admin panel.
 * Displays all users in a table with search, filters, and CRUD operations.
 * Uses React Query for efficient data fetching and caching.
 */

import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { Eye, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAllUsers, useDeleteUser } from "../../hooks/useAdmin";
import { usePrefetchOnHover } from "../../hooks/usePrefetchOnHover";
import { getUserById } from "../../services/adminService";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { formatDateShort } from "../../utils/formatDate";
import { isDemoAccount } from "../../utils/demoAccount";
import {
  DataTable,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  PageHeader,
  SearchFilterBar,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  Card,
  ResultsCount,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui";
import type { User } from "../../types";

const columnHelper = createColumnHelper<User>();

interface UserToDelete {
  id: string;
  name: string | null;
  email: string;
}

// Inner component that uses the AdminLayout context
const AdminUsersContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const prefetchOnHover = usePrefetchOnHover();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: users, isLoading, error } = useAllUsers();
  const deleteUserMutation = useDeleteUser();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterRole, setFilterRole] = useState(searchParams.get("role") || "all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserToDelete | null>(null);

  // Sync search params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterRole !== "all") params.set("role", filterRole);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterRole, setSearchParams]);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load users", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  // Filter users based on search query and role filter
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    let filtered = [...users];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((user) => user.id?.toLowerCase().includes(query) || user.name?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query));
    }

    if (filterRole !== "all") {
      filtered = filtered.filter((user) => (user.role || "user") === filterRole);
    }

    return filtered;
  }, [users, searchQuery, filterRole]);

  const handleDeleteClick = (userId: string, userName: string | null, userEmail: string) => {
    setUserToDelete({ id: userId, name: userName, email: userEmail });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    // Prevent deleting demo accounts
    if (isDemoAccount(userToDelete.email)) {
      toast.error("Demo accounts cannot be deleted", { closeButton: true, position: "bottom-right" });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userToDelete.id);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Delete error:", error);
      // Keep dialog open on error so user can try again
    }
  };

  // Table column definitions (@tanstack/react-table, REQ-1611)
  const tableColumns = [
    columnHelper.accessor("name", {
      header: "Name",
      cell: (info) => <div className="text-sm font-medium text-gray-700 dark:text-white">{info.getValue() || "N/A"}</div>,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => <div className="text-sm text-gray-700 dark:text-white">{info.getValue() || "N/A"}</div>,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((user) => (user.role || "user").toLowerCase(), {
      id: "role",
      header: "Role",
      cell: (info) => <StatusBadge status={info.row.original.role || "user"} />,
      meta: { cellClassName: "whitespace-nowrap" },
    }),
    columnHelper.accessor((user) => (user.createdAt ? new Date(user.createdAt).getTime() : 0), {
      id: "createdAt",
      header: "Registered",
      cell: (info) => formatDateShort(info.row.original.createdAt),
      meta: { cellClassName: "whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const user = info.row.original;
        const demoAccount = isDemoAccount(user.email);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger />
            <DropdownMenuContent>
              <DropdownMenuItem icon={Eye} onClick={() => navigate(`/admin/users/${user.id}`)}>
                View
              </DropdownMenuItem>
              <DropdownMenuItem icon={Pencil} disabled={demoAccount} onClick={() => navigate(`/admin/users/${user.id}/edit`)}>
                {demoAccount ? "Edit (demo-locked)" : "Edit"}
              </DropdownMenuItem>
              <DropdownMenuItem icon={Trash2} variant="danger" disabled={deleteUserMutation.isPending || demoAccount} onClick={() => handleDeleteClick(user.id, user.name, user.email)}>
                {demoAccount ? "Delete (demo-locked)" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: { cellClassName: "whitespace-nowrap text-sm font-medium" },
    }),
  ];

  const filterRoleOptions = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="Users Management" description="Manage all users in your store" onToggleSidebar={toggleSidebar} />

      {isLoading && <LoadingState message="Loading users..." />}

      {error && !isLoading && <ErrorState message={error.message || "Failed to load users"} />}

      {!isLoading && !error && (
        <>
          {/* Admin Role Note */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">Admin Role Assignment Notice</h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                  Currently, you can change other users&apos; roles from <strong>User</strong> to <strong>Admin</strong> via this page. However, please note that in this project, the admin account is
                  integrated with <strong className="font-mono">test@admin.com</strong> via environment variables in the code/account configuration. Therefore, other users assigned the admin role
                  might not have full privileges to perform all real admin role activities and may have limited access to certain administrative functions.
                </p>
              </div>
            </div>
          </div>

          <Card className="p-0">
            <SearchFilterBar searchValue={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search by name or email..." filterValue={filterRole} onFilterChange={setFilterRole} filterOptions={filterRoleOptions}>
              <ResultsCount filteredCount={filteredUsers.length} totalCount={users?.length || 0} entityName="users" />
            </SearchFilterBar>

            {filteredUsers.length === 0 ? (
              <EmptyState message={searchQuery || filterRole !== "all" ? "No users found matching your filters" : "No users available"} />
            ) : (
              <DataTable
                data={filteredUsers}
                columns={tableColumns}
                defaultSorting={[{ id: "name", desc: false }]}
                onRowHover={(user) => prefetchOnHover(["admin-user", user.id], () => getUserById(user.id))}
              />
            )}
          </Card>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete ? `Are you sure you want to delete user "${userToDelete.name || userToDelete.email}"? This action cannot be undone.` : "Are you sure you want to delete this user? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUserMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteUserMutation.isPending} className="bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600">
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const AdminUsersPage = () => {
  useTitle("Admin Users");
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
      <AdminUsersContent />
    </AdminLayout>
  );
};
