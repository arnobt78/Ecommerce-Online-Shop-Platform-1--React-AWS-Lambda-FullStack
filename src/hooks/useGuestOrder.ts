/**
 * React Query hook for guest order lookup (REQ-1659) — no auth, id + email.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getGuestOrder, type GuestOrderResult } from "../services/guestOrderService";

export function useGuestOrder(orderId: string, email: string, enabled: boolean): UseQueryResult<GuestOrderResult, Error> {
  return useQuery({
    queryKey: ["guest-order", orderId, email],
    queryFn: () => getGuestOrder(orderId, email),
    enabled: enabled && !!orderId && !!email,
    staleTime: Infinity,
    retry: 1,
  });
}
