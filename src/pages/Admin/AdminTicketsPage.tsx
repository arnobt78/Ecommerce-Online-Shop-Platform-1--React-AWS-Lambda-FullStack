/**
 * Admin Tickets Page
 *
 * Admin-facing page to manage all support tickets.
 * Displays all tickets in a table with search, filters, and status management.
 * Uses reusable ShadCN UI components and React Query hooks.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useTickets, useUpdateTicketStatus } from "../../hooks/useTickets";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { DataTable, PageHeader, SearchFilterBar, StatusBadge, LoadingState, ErrorState, EmptyState, Card, ResultsCount, FilterSelect } from "../../components/ui";
import type { Ticket, TicketStatus, TicketPriority } from "../../types";

const columnHelper = createColumnHelper<Ticket>();

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  medium: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

// Inner component that uses the AdminLayout context
const AdminTicketsContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
  const [filterPriority, setFilterPriority] = useState(searchParams.get("priority") || "all");

  // Fetch tickets (admin gets all tickets)
  const { data: tickets = [], isLoading, error, refetch } = useTickets();
  const updateStatusMutation = useUpdateTicketStatus();

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPriority !== "all") params.set("priority", filterPriority);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filterStatus, filterPriority, setSearchParams]);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load tickets", { closeButton: true, position: "bottom-right" });
    }
  }, [error]);

  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    if (filterStatus !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === filterStatus);
    }

    if (filterPriority !== "all") {
      filtered = filtered.filter((ticket) => ticket.priority === filterPriority);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.subject?.toLowerCase().includes(query) ||
          ticket.customerEmail?.toLowerCase().includes(query) ||
          ticket.customerName?.toLowerCase().includes(query) ||
          ticket.messages?.[0]?.message?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [tickets, filterStatus, filterPriority, searchQuery]);

  const getStatusColor = useCallback((status: TicketStatus) => {
    const colorMap: Record<TicketStatus, string> = {
      open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      in_progress: "bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200",
      resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    return colorMap[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }, []);

  const handleStatusUpdate = useCallback(
    (ticketId: string, newStatus: string) => {
      updateStatusMutation.mutate({ ticketId, status: newStatus as TicketStatus });
    },
    [updateStatusMutation],
  );

  const formatDateTwoLines = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return { datePart: "N/A", timePart: "" };
    try {
      const date = new Date(dateString);
      const datePart = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const timePart = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      return { datePart, timePart };
    } catch {
      return { datePart: "N/A", timePart: "" };
    }
  }, []);

  // Table column definitions (@tanstack/react-table, REQ-1611)
  const tableColumns = useMemo(
    () => [
      columnHelper.accessor((ticket) => (ticket.createdAt ? new Date(ticket.createdAt).getTime() : 0), {
        id: "createdAt",
        header: "Created",
        cell: (info) => {
          const createdDate = formatDateTwoLines(info.row.original.createdAt);
          return info.row.original.createdAt ? (
            <div>
              <div className="text-sm">{createdDate.datePart}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">at {createdDate.timePart}</div>
            </div>
          ) : (
            "N/A"
          );
        },
        meta: { cellClassName: "min-w-[140px] whitespace-nowrap text-sm text-gray-700 dark:text-gray-100" },
      }),
      columnHelper.accessor("subject", {
        header: "Subject",
        cell: (info) => {
          const ticket = info.row.original;
          return (
            <>
              <div className="text-sm text-gray-700 dark:text-white">{ticket.subject}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">{ticket.messages?.[0]?.message || "No message"}</div>
            </>
          );
        },
        meta: { cellClassName: "min-w-[200px]" },
      }),
      columnHelper.accessor((ticket) => (ticket.customerName || ticket.customerEmail || "").toLowerCase(), {
        id: "customer",
        header: "Customer",
        cell: (info) => {
          const ticket = info.row.original;
          return (
            <div className="text-sm">
              <div className="text-sm text-gray-700 dark:text-white">{ticket.customerName || "Customer"}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.customerEmail}</div>
            </div>
          );
        },
        meta: { cellClassName: "min-w-[150px] whitespace-nowrap" },
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const ticket = info.row.original;
          return (
            // Row is clickable (navigates to ticket detail) — stop propagation
            // so opening/using this status <select> doesn't also navigate away.
            <div onClick={(e) => e.stopPropagation()}>
              <StatusBadge
                status={ticket.status}
                className={getStatusColor(ticket.status)}
                asSelect={true}
                onChange={(newStatus) => {
                  handleStatusUpdate(ticket.id, newStatus);
                }}
                options={[
                  { value: "open", label: "Open" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "resolved", label: "Resolved" },
                  { value: "closed", label: "Closed" },
                ]}
                customLabels={{ open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }}
              />
            </div>
          );
        },
        meta: { cellClassName: "min-w-[80px] whitespace-nowrap" },
      }),
      columnHelper.accessor((ticket) => ticket.priority || "medium", {
        id: "priority",
        header: "Priority",
        cell: (info) => {
          const priority = info.getValue() as TicketPriority;
          return <StatusBadge status={priority} className={PRIORITY_COLORS[priority]} customLabels={PRIORITY_LABELS} />;
        },
        meta: { cellClassName: "min-w-[100px] whitespace-nowrap" },
      }),
      columnHelper.accessor((ticket) => ticket.messages?.length || 0, {
        id: "messages",
        header: "Messages",
        cell: (info) => info.getValue(),
        meta: { cellClassName: "min-w-[60px] whitespace-nowrap text-sm text-gray-700 dark:text-gray-100" },
      }),
      columnHelper.accessor((ticket) => (ticket.updatedAt ? new Date(ticket.updatedAt).getTime() : 0), {
        id: "updatedAt",
        header: "Last Updated",
        cell: (info) => {
          const updatedDate = formatDateTwoLines(info.row.original.updatedAt);
          return info.row.original.updatedAt ? (
            <div>
              <div className="text-sm">{updatedDate.datePart}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">at {updatedDate.timePart}</div>
            </div>
          ) : (
            "N/A"
          );
        },
        meta: { cellClassName: "min-w-[140px] whitespace-nowrap text-sm text-gray-700 dark:text-gray-100" },
      }),
    ],
    [getStatusColor, handleStatusUpdate, formatDateTwoLines],
  );

  const filterStatusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" },
    { value: "closed", label: "Closed" },
  ];

  const filterPriorityOptions = [
    { value: "all", label: "All Priorities" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader title="Support Tickets" description="Manage all customer support tickets" onToggleSidebar={toggleSidebar} />

      <div className="py-6">
        {isLoading && <LoadingState message="Loading tickets..." />}

        {error && !isLoading && <ErrorState message={error.message || "Failed to load tickets"} onRetry={refetch} />}

        {!isLoading && !error && (
          <Card className="p-0">
            <SearchFilterBar searchValue={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search by subject, customer name, or email..." filterValue={filterStatus} onFilterChange={setFilterStatus} filterOptions={filterStatusOptions}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <FilterSelect value={filterPriority} onChange={setFilterPriority} options={filterPriorityOptions} className="w-full sm:w-48" />
                <ResultsCount filteredCount={filteredTickets.length} totalCount={tickets.length} entityName="tickets" />
              </div>
            </SearchFilterBar>

            {filteredTickets.length === 0 ? (
              <EmptyState message={searchQuery || filterStatus !== "all" ? "No tickets found matching your filters" : "No tickets available"} />
            ) : (
              <DataTable
                columns={tableColumns}
                data={filteredTickets}
                defaultSorting={[{ id: "createdAt", desc: true }]}
                onRowClick={(ticket) => navigate(`/admin/tickets/${ticket.id}`)}
                onRowHover={(ticket) => queryClient.setQueryData(["ticket", ticket.id], ticket)}
              />
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export const AdminTicketsPage = () => {
  useTitle("Support Tickets - Admin");
  return (
    <AdminLayout>
      <AdminTicketsContent />
    </AdminLayout>
  );
};
