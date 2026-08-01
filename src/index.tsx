import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import { Toaster } from "sonner";

import { FilterProvider, CartProvider } from "./context";
import { ScrollToTop, ErrorBoundary } from "./components";
import { initSentry } from "./lib/sentry";
import "./index.css";
import App from "./App";

// As early as possible, before anything renders — see src/lib/sentry.ts.
initSentry();

// Create a QueryClient instance with default options
// Optimized for fast page loads and minimal network requests
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh (no refetch)
      staleTime: 10 * 60 * 1000, // 10 minutes - longer cache = faster loads
      // Garbage collection time: how long unused data stays in cache
      gcTime: 60 * 60 * 1000, // 1 hour - keep data longer for instant loads
      // Retry failed requests once (faster failure = faster error display)
      retry: 1,
      // Don't refetch on window focus (prevents unnecessary requests)
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect (prevents unnecessary requests)
      refetchOnReconnect: false,
      // Don't refetch on mount if data is fresh (faster initial render)
      refetchOnMount: false,
      // Use cached data as placeholder while refetching in background
      placeholderData: (previousData: unknown) => previousData,
      // Network mode: prefer cache first, then network (faster perceived load)
      networkMode: "online",
    },
  },
});

// Persist the query cache to localStorage so a reload/reopened tab paints
// instantly from the last-known-good server data instead of a blank
// loading state, then revalidates in the background (stale-while-revalidate).
// `buster` invalidates old persisted shapes automatically on app version bumps.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "codebook-query-cache",
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 60 * 60 * 1000, // matches gcTime above
          buster: __APP_VERSION__,
          // Default shouldDehydrateQuery (persist only successful queries) is enough here:
          // this app has no session/user query in TanStack Query (auth lives in sessionStorage,
          // see authService.ts), and every logout call site already runs queryClient.clear()
          // (DropdownLoggedIn.tsx / AdminHeader.tsx / AdminSidebar.tsx), which also wipes the
          // persisted localStorage snapshot so no per-user admin/order data survives a logout.
        }}
      >
        <Router>
          <CartProvider>
            <FilterProvider>
              <ScrollToTop />
              <Toaster closeButton richColors position="bottom-right" />
              <App />
            </FilterProvider>
          </CartProvider>
        </Router>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
