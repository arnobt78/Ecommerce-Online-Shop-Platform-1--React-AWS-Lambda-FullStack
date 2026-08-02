/**
 * Ticket Detail Page
 *
 * Page to view a single ticket with all messages and add replies.
 * Works for both customers and admins.
 * Uses reusable ShadCN UI components and React Query hooks.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import type { FormEvent } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useTicket, useReplyToTicket, useUpdateTicketStatus, useUpdateTicketPriority, useGenerateTicketReplyDraft } from "../../hooks/useTickets";
import { useUser } from "../../hooks/useUser";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { formatDateLong } from "../../utils/formatDate";
import { Card, StatusBadge, ErrorState, FormTextarea, FormLabel, FormError, FormSelect, PageHeader } from "../../components/ui";
import { TicketDetailSkeleton } from "./components/TicketDetailSkeleton";
import type { TicketStatus, TicketPriority } from "../../types";

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  technical: "Technical Issue",
  refund: "Refund Request",
  account: "Account",
  other: "Other",
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  medium: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// Inner content component that can be used with or without AdminLayout
const TicketDetailContent = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useUser();
  const isAdmin = user?.role === "admin";

  const isAdminRoute = location.pathname.startsWith("/admin/tickets");

  useTitle(isAdminRoute ? "Ticket Details - Admin" : isAdmin ? "Ticket Details" : "Support Ticket");

  const { data: ticket, isLoading, error, refetch } = useTicket(ticketId);

  const [replyMessage, setReplyMessage] = useState("");
  const [replyError, setReplyError] = useState("");

  // Status update state (admin only)
  const [newStatus, setNewStatus] = useState<TicketStatus | "">("");

  const replyMutation = useReplyToTicket();
  const updateStatusMutation = useUpdateTicketStatus();
  const updatePriorityMutation = useUpdateTicketPriority();
  const generateReplyDraftMutation = useGenerateTicketReplyDraft(); // REQ-1666

  const handlePriorityChange = useCallback(
    (priority: TicketPriority) => {
      if (!ticketId || priority === ticket?.priority) return;
      updatePriorityMutation.mutate({ ticketId, priority });
    },
    [ticketId, ticket?.priority, updatePriorityMutation],
  );

  // Set initial status when ticket loads. Necessarily an effect (not a pure
  // render-time derivation) because newStatus becomes independently editable
  // via the dropdown afterward and must not snap back on every re-render.
  useEffect(() => {
    if (ticket?.status) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding editable dropdown state from an async fetch, see comment above
      setNewStatus(ticket.status);
    } else if (ticket && !ticket.status) {
      // If ticket loaded but no status, default to "open"
      setNewStatus("open");
    }
  }, [ticket]);

  const getStatusColor = useCallback((status: TicketStatus) => {
    const colorMap: Record<TicketStatus, string> = {
      open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      in_progress: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200",
    };
    return colorMap[status] || "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200";
  }, []);

  const sortedMessages = useMemo(() => {
    if (!ticket?.messages) return [];
    return [...ticket.messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [ticket]);

  const handleReply = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!replyMessage.trim()) {
        setReplyError("Message is required");
        return;
      }

      if (replyMessage.trim().length < 10) {
        setReplyError("Message must be at least 10 characters");
        return;
      }

      setReplyError("");

      if (!ticketId) return;

      replyMutation.mutate(
        { ticketId, message: replyMessage.trim() },
        {
          onSuccess: () => {
            setReplyMessage("");
            setReplyError("");
            // React Query will automatically invalidate and refetch
          },
        },
      );
    },
    [replyMessage, replyMutation, ticketId],
  );

  const handleStatusUpdate = useCallback(() => {
    if (!newStatus || newStatus === ticket?.status || !ticketId) {
      return;
    }

    updateStatusMutation.mutate(
      { ticketId, status: newStatus },
      {
        onSuccess: () => {
          // Don't need to refetch - React Query will invalidate and refetch automatically
        },
      },
    );
  }, [newStatus, ticket?.status, updateStatusMutation, ticketId]);

  const statusOptions = useMemo(
    () => [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "resolved", label: "Resolved" },
      { value: "closed", label: "Closed" },
    ],
    [],
  );

  return (
    <div className={isAdminRoute ? "min-h-screen bg-gray-50 dark:bg-gray-900" : "min-h-screen bg-gray-50 dark:bg-gray-900 py-8"}>
      <div className={isAdminRoute ? "py-6" : ""}>
        {/* Back Button */}
        <button onClick={() => navigate(isAdminRoute ? "/admin/tickets" : "/tickets")} className="mb-6 text-sm text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to Tickets
        </button>

        {isLoading && <TicketDetailSkeleton />}

        {error && <ErrorState message={error.message || "Failed to load ticket"} onRetry={refetch} />}

        {ticket && !isLoading && (
          <>
            {/* Ticket Header */}
            <Card className="mb-6 p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Mobile: Status Badge and Dropdown */}
                  <div className="flex items-center gap-3 flex-wrap sm:hidden">
                    <StatusBadge
                      status={ticket.status}
                      className={getStatusColor(ticket.status)}
                      customLabels={{ open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }}
                    />
                    {isAdmin && (
                      <FormSelect
                        value={newStatus || ticket?.status || "open"}
                        onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                        disabled={updateStatusMutation.isPending}
                        className="w-full sm:w-40"
                        options={statusOptions}
                      />
                    )}
                  </div>

                  {/* Desktop: Title and Status Badge */}
                  <h1 className="hidden sm:block text-xl sm:text-2xl font-medium text-gray-700 dark:text-white sm:w-auto sm:flex-1">{ticket.subject}</h1>
                  <div className="hidden sm:flex items-center gap-3">
                    <StatusBadge
                      status={ticket.status}
                      className={getStatusColor(ticket.status)}
                      customLabels={{ open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }}
                    />
                  </div>
                </div>

                {/* Mobile: Title - Full width */}
                <h1 className="text-xl sm:text-2xl font-medium text-gray-700 dark:text-white w-full sm:hidden">{ticket.subject}</h1>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Created:</span> {ticket.createdAt ? formatDateLong(ticket.createdAt) : "N/A"}
                    </div>

                    {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Updated:</span> {formatDateLong(ticket.updatedAt)}
                      </div>
                    )}
                  </div>

                  {/* Desktop: Status Dropdown */}
                  {isAdmin && (
                    <div className="hidden sm:flex items-center gap-3">
                      <FormSelect
                        value={newStatus || ticket?.status || "open"}
                        onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                        disabled={updateStatusMutation.isPending}
                        className="w-40"
                        options={statusOptions}
                      />
                      {newStatus !== ticket.status && (
                        <button
                          onClick={handleStatusUpdate}
                          disabled={updateStatusMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile: Status Dropdown (if admin) */}
                {isAdmin && newStatus !== ticket.status && (
                  <div className="sm:hidden">
                    <button
                      onClick={handleStatusUpdate}
                      disabled={updateStatusMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium">Customer:</span> {ticket.customerName || ticket.customerEmail}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {ticket.customerEmail}
                  </div>
                </div>

                {/* Triage metadata — REQ-1619 */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Category:</span> {CATEGORY_LABELS[ticket.category] || ticket.category}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Priority:</span>
                    {isAdmin ? (
                      <FormSelect
                        value={ticket.priority}
                        onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                        disabled={updatePriorityMutation.isPending}
                        className="w-32"
                        options={PRIORITY_OPTIONS}
                      />
                    ) : (
                      <StatusBadge status={ticket.priority} className={PRIORITY_COLORS[ticket.priority]} customLabels={{ low: "Low", medium: "Medium", high: "High", urgent: "Urgent" }} />
                    )}
                  </div>
                  {ticket.orderId && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Related Order:</span>{" "}
                      <Link to={isAdminRoute ? `/admin/orders/${ticket.orderId}` : `/orders/${ticket.orderId}`} className="text-sky-600 dark:text-sky-400 hover:underline font-mono">
                        {ticket.orderId.slice(0, 8)}...
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Messages */}
            <Card className="mb-6 p-4 sm:p-6">
              <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Messages ({sortedMessages.length})</h2>
              <div className="space-y-4">
                {sortedMessages.map((message) => {
                  const isAdminMessage = message.senderRole === "admin";

                  return (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        isAdminMessage ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 order-1 sm:order-2">{formatDateLong(message.createdAt)}</span>
                        <div className="flex flex-row items-center gap-2 order-2 sm:order-1">
                          <span className="text-sm sm:text-base font-medium text-gray-700 dark:text-white">{message.senderName || (isAdminMessage ? "Admin" : "Customer")}</span>
                          {isAdminMessage && <StatusBadge status="admin" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs" customLabels={{ admin: "Admin" }} />}
                        </div>
                      </div>
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{message.message}</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Reply Form */}
            {ticket.status !== "closed" && ticket.status !== "resolved" && (
              <Card className="p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-700 dark:text-white">{isAdmin ? "Reply to Customer" : "Add Reply"}</h2>
                  {/* REQ-1666 — AI reply draft, admin only, never auto-sent */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        ticketId &&
                        generateReplyDraftMutation.mutate(ticketId, {
                          onSuccess: (result) => {
                            setReplyMessage(result.draft);
                            if (replyError) setReplyError("");
                          },
                        })
                      }
                      disabled={generateReplyDraftMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
                    >
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                      {generateReplyDraftMutation.isPending ? "Drafting..." : "Suggest Reply"}
                    </button>
                  )}
                </div>
                <form onSubmit={handleReply} className="space-y-4">
                  <div>
                    <FormLabel htmlFor="reply" required>
                      Your Message
                    </FormLabel>
                    <FormTextarea
                      id="reply"
                      name="reply"
                      value={replyMessage}
                      onChange={(e) => {
                        setReplyMessage(e.target.value);
                        if (replyError) setReplyError("");
                      }}
                      placeholder="Type your reply here..."
                      rows={6}
                      required
                      disabled={replyMutation.isPending}
                      className={replyError ? "border-red-500" : ""}
                    />
                    {replyError && <FormError message={replyError} />}
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={replyMutation.isPending || !replyMessage.trim()}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {replyMutation.isPending ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </form>
              </Card>
            )}

            {/* Closed/Resolved Notice */}
            {(ticket.status === "closed" || ticket.status === "resolved") && (
              <Card className="bg-gray-50 dark:bg-gray-800 p-4 sm:p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">This ticket is {ticket.status}. No further replies can be added.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Admin-specific content component that uses AdminLayout context
const AdminTicketDetailContent = () => {
  const { toggleSidebar } = useAdminLayout();

  return (
    <>
      <PageHeader title="Ticket Details" description="View and manage customer support ticket" onToggleSidebar={toggleSidebar} />
      <TicketDetailContent />
    </>
  );
};

// Main component that wraps with AdminLayout if on admin route
export const TicketDetailPage = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin/tickets");

  if (isAdminRoute) {
    return (
      <AdminLayout>
        <AdminTicketDetailContent />
      </AdminLayout>
    );
  }

  // Otherwise, render without AdminLayout (customer view)
  return <TicketDetailContent />;
};
