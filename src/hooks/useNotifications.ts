/**
 * React Query hooks for notifications
 * Provides automatic caching, polling, and loading states for notification operations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from "@tanstack/react-query";
import { getNotificationCount, markNotificationsRead, type NotificationCount } from "../services/notificationService";
import { toast } from "../lib/toast";

// Polls every 30s to keep the unread badge updated without a websocket/SSE layer.
export function useNotificationCount(enabled = true): UseQueryResult<NotificationCount, Error> {
  const hasToken = typeof window !== "undefined" && sessionStorage.getItem("token");

  return useQuery({
    queryKey: ["notification-count"],
    queryFn: getNotificationCount,
    enabled: enabled && !!hasToken,
    staleTime: 0, // Always consider stale to get fresh count
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

interface MarkReadContext {
  previousData: NotificationCount | undefined;
}

export function useMarkNotificationsRead(): UseMutationResult<{ notificationsReadAt: string; message: string }, Error, void, MarkReadContext> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationsRead,
    onMutate: async () => {
      // Optimistically zero the badge immediately so it disappears on click.
      await queryClient.cancelQueries({ queryKey: ["notification-count"] });

      const previousData = queryClient.getQueryData<NotificationCount>(["notification-count"]);

      queryClient.setQueryData<NotificationCount>(["notification-count"], (old) => ({
        ...old,
        count: 0,
        orderCount: 0,
        ticketCount: 0,
        notificationsReadAt: new Date().toISOString(),
      }));

      return { previousData };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<NotificationCount>(["notification-count"], {
        count: 0,
        orderCount: 0,
        ticketCount: 0,
        notificationsReadAt: data.notificationsReadAt || new Date().toISOString(),
      });

      // Also invalidate the user query so notificationsReadAt reflects everywhere.
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["notification-count"], context.previousData);
      }

      console.error("Mark notifications read error:", error);
      toast.error(error.message || "Failed to mark notifications as read", {
        closeButton: true,
        position: "bottom-right",
      });
    },
  });
}
