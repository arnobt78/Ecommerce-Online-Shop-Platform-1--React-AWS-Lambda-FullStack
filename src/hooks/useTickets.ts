/**
 * React Query hooks for ticket operations
 *
 * Caching Strategy:
 * - staleTime: Infinity = Data never becomes stale automatically
 * - refetchOnMount: true = Refetch ONLY when data is stale (invalidated)
 * - Result: Cache forever until manually invalidated, then refetch once
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { createTicket, getTickets, getTicket, replyToTicket, updateTicketStatus, updateTicketPriority, type CreateTicketInput } from "../services/ticketService";
import { toast } from "../lib/toast";
import type { Ticket, TicketStatus, TicketPriority } from "../types";

// Admin: gets all tickets. Customer: gets only their own tickets (backend-scoped).
export function useTickets(enabled = true): UseQueryResult<Ticket[], Error> {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const data = await getTickets();
      return data.tickets || [];
    },
    enabled: enabled && !!hasToken,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useTicket(ticketId: string | undefined, enabled = true): UseQueryResult<Ticket, Error> {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId as string),
    enabled: enabled && !!hasToken && !!ticketId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useCreateTicket(): UseMutationResult<Ticket, Error, CreateTicketInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      // New ticket creates a notification for admin
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Ticket created successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create ticket", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface ReplyToTicketVariables {
  ticketId: string;
  message: string;
}

export function useReplyToTicket(): UseMutationResult<Ticket, Error, ReplyToTicketVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, message }: ReplyToTicketVariables) => replyToTicket(ticketId, message),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      // Reply creates a notification for the customer/admin on the other side
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Reply sent successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send reply", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateTicketStatusVariables {
  ticketId: string;
  status: TicketStatus;
}

export function useUpdateTicketStatus(): UseMutationResult<Ticket, Error, UpdateTicketStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, status }: UpdateTicketStatusVariables) => updateTicketStatus(ticketId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      // Status change creates a notification for the customer
      queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Ticket status updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update ticket status", { closeButton: true, position: "bottom-right" });
    },
  });
}

interface UpdateTicketPriorityVariables {
  ticketId: string;
  priority: TicketPriority;
}

export function useUpdateTicketPriority(): UseMutationResult<Ticket, Error, UpdateTicketPriorityVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, priority }: UpdateTicketPriorityVariables) => updateTicketPriority(ticketId, priority),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });

      toast.success("Ticket priority updated successfully!", { closeButton: true, position: "bottom-right" });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update ticket priority", { closeButton: true, position: "bottom-right" });
    },
  });
}
