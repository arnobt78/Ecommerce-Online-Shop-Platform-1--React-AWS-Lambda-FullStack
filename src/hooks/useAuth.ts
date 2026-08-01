/**
 * React Query hooks for auth-adjacent, non-session data (currently just the
 * demo-account quick-login list). Login/register/logout stay as direct service
 * calls in Login.tsx/Register.tsx since they aren't cacheable server state.
 */

import { useQuery } from "@tanstack/react-query";
import { getDemoAccounts } from "../services";

export function useDemoAccounts() {
  return useQuery({
    queryKey: ["demo-accounts"],
    queryFn: getDemoAccounts,
    staleTime: Infinity, // Demo accounts don't change at runtime
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}
