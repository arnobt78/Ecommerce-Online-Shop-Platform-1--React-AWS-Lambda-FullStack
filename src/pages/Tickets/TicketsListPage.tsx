/**
 * Tickets List Page
 *
 * Customer-facing page to view all their support tickets.
 * Uses reusable ShadCN UI components and React Query hooks.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";
import { useTickets } from "../../hooks/useTickets";
import { useUser } from "../../hooks/useUser";
import { formatDateLong } from "../../utils/formatDate";
import { Card, StatusBadge, ErrorState, EmptyState, SearchInput, FilterSelect, ResultsCount } from "../../components/ui";
import { TicketListSkeleton } from "./components/TicketCardSkeleton";
import { toast } from "../../lib/toast";
import type { TicketStatus, TicketPriority } from "../../types";

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  medium: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const TicketsListPage = () => {
  useTitle("My Support Tickets");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");

  const { data: tickets = [], isLoading, error, refetch } = useTickets();
  const { data: user } = useUser();

  // Filter tickets to only show tickets created by the current user
  // This ensures that even admins only see their own tickets on the customer page
  const userTickets = useMemo(() => {
    if (!user?.email) return tickets;
    return tickets.filter((ticket) => ticket.customerEmail?.toLowerCase() === user.email?.toLowerCase());
  }, [tickets, user]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterStatus !== "all") params.set("status", filterStatus);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterStatus, setSearchParams]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load tickets", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  const filteredTickets = useMemo(() => {
    let filtered = [...userTickets];

    if (filterStatus !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((ticket) => ticket.subject?.toLowerCase().includes(query) || ticket.messages?.[0]?.message?.toLowerCase().includes(query));
    }

    return filtered;
  }, [userTickets, filterStatus, searchQuery]);

  const getStatusColor = useCallback((status: TicketStatus) => {
    const colorMap: Record<TicketStatus, string> = {
      open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      in_progress: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200",
    };
    return colorMap[status] || "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200";
  }, []);

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 overflow-x-auto">
      <div className="min-w-0">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium text-gray-700 dark:text-white">My Support Tickets</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">View and manage your support tickets</p>
          </div>
          <button
            onClick={() => navigate("/tickets/create")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors self-start sm:self-auto"
          >
            Create Ticket
          </button>
        </div>

        <Card className="mb-3 p-4 sm:p-6 overflow-x-auto">
          <div className="flex flex-col sm:flex-row gap-4 min-w-0">
            <div className="flex-1 min-w-0">
              <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search tickets by subject or message..." />
            </div>
            <div className="w-full sm:w-48 flex-shrink-0">
              <FilterSelect value={filterStatus} onChange={setFilterStatus} options={statusOptions} />
            </div>
          </div>
        </Card>

        <div className="mb-3">
          <ResultsCount filteredCount={filteredTickets.length} totalCount={userTickets.length} entityName={filteredTickets.length === 1 ? "ticket" : "tickets"} />
        </div>

        {isLoading ? (
          <TicketListSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error.message || "Failed to load tickets"} onRetry={refetch} />
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            message="No tickets found"
            description={searchQuery || filterStatus !== "all" ? "Try adjusting your search or filters" : "You haven't created any support tickets yet"}
            action={!searchQuery && filterStatus === "all" ? { label: "Create Your First Ticket", onClick: () => navigate("/tickets/create") } : undefined}
          />
        ) : (
          <div className="space-y-4 overflow-x-auto">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow p-4 sm:p-6" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                <div className="flex items-start justify-between min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-medium text-gray-700 dark:text-white">{ticket.subject}</h3>
                      <StatusBadge
                        status={ticket.status}
                        className={getStatusColor(ticket.status)}
                        customLabels={{ open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }}
                      />
                      {ticket.priority && ticket.priority !== "medium" && (
                        <StatusBadge status={ticket.priority} className={PRIORITY_COLORS[ticket.priority]} customLabels={{ low: "Low", medium: "Medium", high: "High", urgent: "Urgent" }} />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">{ticket.messages?.[0]?.message || "No message"}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span>Created: {ticket.createdAt ? formatDateLong(ticket.createdAt) : "N/A"}</span>
                      {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && <span>Updated: {formatDateLong(ticket.updatedAt)}</span>}
                      <span>
                        {ticket.messages?.length || 0} {ticket.messages?.length === 1 ? "message" : "messages"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
