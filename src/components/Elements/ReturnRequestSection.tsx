/**
 * ReturnRequestSection Component (REQ-1663, REQ-1671)
 *
 * Shared "Request Return" card used by both the authenticated OrderDetailPage
 * and the no-auth GuestOrderLookupPage — same UI, same state machine, only
 * the submit handler (and how ownership is verified server-side) differs.
 */
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Card, FormTextarea } from "../ui";
import { RETURN_STATUS_LABELS, type ReturnRequest } from "../../services/returnService";

interface ReturnRequestSectionProps {
  orderStatus: string;
  existingReturn?: Pick<ReturnRequest, "status" | "adminNote"> | null;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
}

export function ReturnRequestSection({ orderStatus, existingReturn, onSubmit, isSubmitting }: ReturnRequestSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");

  if (orderStatus !== "delivered") return null;

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-white">
        <Undo2 className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
        Return This Order
      </h2>
      {existingReturn ? (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300">
          {RETURN_STATUS_LABELS[existingReturn.status] || existingReturn.status}
          {existingReturn.adminNote && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Note: {existingReturn.adminNote}</p>}
        </div>
      ) : showForm ? (
        <div className="space-y-3">
          <FormTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tell us why you'd like to return this order (min 10 characters)..."
            rows={4}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSubmit(reason.trim())}
              disabled={isSubmitting || reason.trim().length < 10}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Return Request"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Request Return
        </button>
      )}
    </Card>
  );
}
