/**
 * Admin Returns Page (REQ-1663)
 *
 * Return/RMA triage — approve (issues a real Stripe refund via the shared
 * refundOrderPayment flow) or reject a customer's return request.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { createColumnHelper } from "@tanstack/react-table";
import { Check, X, Undo2 } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useAdminReturns, useApproveReturn, useRejectReturn } from "../../hooks/useReturns";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import {
  Card,
  PageHeader,
  StatusBadge,
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
  FormTextarea,
} from "../../components/ui";
import type { ReturnRequest } from "../../services/returnService";

const columnHelper = createColumnHelper<ReturnRequest>();

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
  refunded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const AdminReturnsContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { data: returns = [], isLoading, error, refetch } = useAdminReturns();
  const approveMutation = useApproveReturn();
  const rejectMutation = useRejectReturn();

  const [pendingAction, setPendingAction] = useState<{ id: string; type: "approve" | "reject" } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const handleConfirm = () => {
    if (!pendingAction) return;
    const mutation = pendingAction.type === "approve" ? approveMutation : rejectMutation;
    mutation.mutate(
      { id: pendingAction.id, adminNote: adminNote.trim() || undefined },
      {
        onSuccess: () => {
          setPendingAction(null);
          setAdminNote("");
        },
      },
    );
  };

  const tableColumns = [
    columnHelper.accessor((r) => r.id.slice(0, 8), {
      id: "id",
      header: "Return ID",
      cell: (info) => <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{info.getValue()}</span>,
    }),
    columnHelper.accessor("orderId", {
      header: "Order",
      cell: (info) => (
        <Link to={`/admin/orders/${info.getValue()}`} className="text-sm text-sky-600 hover:underline dark:text-sky-400 font-mono">
          {info.getValue().slice(0, 8)}...
        </Link>
      ),
    }),
    columnHelper.accessor("reason", {
      header: "Reason",
      cell: (info) => <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 max-w-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => <StatusBadge status={info.getValue()} className={STATUS_COLORS[info.getValue()]} />,
    }),
    columnHelper.accessor((r) => new Date(r.createdAt).toLocaleDateString(), {
      id: "createdAt",
      header: "Requested",
      cell: (info) => info.getValue(),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const r = info.row.original;
        if (r.status !== "requested") return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPendingAction({ id: r.id, type: "approve" })}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              Approve
            </button>
            <button
              onClick={() => setPendingAction({ id: r.id, type: "reject" })}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Reject
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="Return Requests" description="Review and process customer return/RMA requests" onToggleSidebar={toggleSidebar} />

      {isLoading && <LoadingState message="Loading return requests..." />}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load return requests"} onRetry={refetch} />}

      {!isLoading && !error && (
        <Card className="p-0">
          {returns.length === 0 ? (
            <EmptyState message="No return requests yet" />
          ) : (
            <DataTable data={returns} columns={tableColumns} defaultSorting={[{ id: "createdAt", desc: true }]} />
          )}
        </Card>
      )}

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4" strokeWidth={2} />
              {pendingAction?.type === "approve" ? "Approve Return & Refund" : "Reject Return Request"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "approve"
                ? "This will issue a real Stripe refund for the full order amount and restore stock. This cannot be undone."
                : "The customer will be notified that this return request was rejected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <FormTextarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Optional note (visible to the customer)" rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending || rejectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className={pendingAction?.type === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600"}
            >
              {approveMutation.isPending || rejectMutation.isPending ? "Processing..." : pendingAction?.type === "approve" ? "Approve & Refund" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const AdminReturnsPage = () => {
  useTitle("Return Requests - Admin");
  return (
    <AdminLayout>
      <AdminReturnsContent />
    </AdminLayout>
  );
};
