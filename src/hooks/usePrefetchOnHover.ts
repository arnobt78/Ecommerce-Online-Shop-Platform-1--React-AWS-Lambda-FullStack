/**
 * usePrefetchOnHover — generic TanStack Query prefetch-on-hover helper.
 *
 * This is a Vite SPA (no server-rendering layer, no route-level data preload),
 * so the closest equivalent to "the destination is already painted with data"
 * is warming the query cache before the click/navigation actually happens —
 * by the time the click lands, the detail page's query is already resolved
 * (or resolving), so it renders from cache instantly instead of showing a
 * loading state. Debounced per query key so rapid re-hovers (e.g. dragging
 * the cursor across a table) don't fire duplicate requests.
 */
import { useRef, useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

const recentlyPrefetched = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;

export function usePrefetchOnHover() {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    <T>(queryKey: QueryKey, queryFn: () => Promise<T>, staleTime = 60_000) => {
      const cacheKey = JSON.stringify(queryKey);
      const last = recentlyPrefetched.get(cacheKey);
      if (last && Date.now() - last < DEDUPE_WINDOW_MS) return;

      // Small delay so a cursor merely passing over a row doesn't trigger a
      // fetch — only a genuine hover-and-pause does.
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        recentlyPrefetched.set(cacheKey, Date.now());
        queryClient.prefetchQuery({ queryKey, queryFn, staleTime });
      }, 100);
    },
    [queryClient],
  );
}
