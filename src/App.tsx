import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AllRoutes } from "./routes/AllRoutes";
import { Footer, Header } from "./components";
import { useTokenRefresh } from "./hooks/useTokenRefresh";

function App() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  // REQ-1667 — silent access-token renewal, mounted once at the app root.
  useTokenRefresh();

  // Check if current route is an admin route
  const isAdminRoute = location.pathname.startsWith("/admin");

  // The admin console is a lazy-loaded chunk (routes/AllRoutes.tsx) so
  // regular customers never download it. For admins, warm that chunk in the
  // background as soon as the shell mounts so their first click into /admin
  // still feels instant instead of waiting on a fresh network fetch.
  useEffect(() => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin" || isAdminRoute) return;

    const prefetchAdminChunk = () => {
      void import("./pages/Admin");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchAdminChunk);
      return () => window.cancelIdleCallback(id);
    }
    const timeoutId = window.setTimeout(prefetchAdminChunk, 1000);
    return () => window.clearTimeout(timeoutId);
  }, [isAdminRoute]);

  return (
    <div className="App dark:bg-dark flex min-h-screen flex-col">
      {/* Hide Header and Footer on admin routes */}
      {!isAdminRoute && <Header />}
      {/* Simple per-route enter animation, keyed by pathname so it replays on
          every navigation. Enter-only (no exit) to avoid React Router v6/v7's
          AnimatePresence-needs-explicit-`location`-prop complexity. flex-1 +
          the parent's flex-col replaces the old global `main { min-height:
          90vh }` rule — short-content pages (Login, 404, etc.) still push
          Footer to the bottom, without every page needing a `<main>` tag. */}
      <motion.div
        key={location.pathname}
        className="flex-1"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Centralized page-content width: admin routes render their own
            sidebar-aware AdminLayout wrapper (no cap), everything else gets
            one shared wide cap here instead of each page repeating its own
            max-w/mx-auto/px classes. */}
        {isAdminRoute ? (
          <AllRoutes />
        ) : (
          <div className="mx-auto max-w-9xl px-2 sm:px-4 xl:px-8 py-4">
            <AllRoutes />
          </div>
        )}
      </motion.div>
      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default App;
