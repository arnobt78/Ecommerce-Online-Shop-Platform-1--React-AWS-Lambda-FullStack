import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "../../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../../services";
import { useUser } from "../../hooks/useUser";
import { useCart } from "../../context";
import {
  useNotificationCount,
  useMarkNotificationsRead,
} from "../../hooks/useNotifications";

interface DropdownLoggedInProps {
  setDropdown: (value: boolean) => void;
}

export const DropdownLoggedIn = ({ setDropdown }: DropdownLoggedInProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { clearCart } = useCart(); // Access cart clear function

  // Load cached user email from sessionStorage (reactive to changes)
  const [cachedEmail, setCachedEmail] = useState(() => {
    try {
      return sessionStorage.getItem("userEmail") || "";
    } catch {
      return "";
    }
  });

  // Use React Query hook - automatically handles caching, deduplication, and loading states
  const { data: userData, error } = useUser();

  // Get notification count (includes breakdown of orders and tickets)
  const { data: notificationData } = useNotificationCount();
  const notificationCount = notificationData?.count || 0;
  const orderNotificationCount = notificationData?.orderCount || 0;
  const ticketNotificationCount = notificationData?.ticketCount || 0;
  const markReadMutation = useMarkNotificationsRead();

  // Update cached email when sessionStorage changes or user data is fetched
  useEffect(() => {
    // Check sessionStorage immediately
    const checkEmail = () => {
      const email = sessionStorage.getItem("userEmail") || "";
      setCachedEmail(email);
    };

    // Check on mount
    checkEmail();

    // Listen for custom storage change events (for same-tab updates)
    const handleStorageChange = () => {
      checkEmail();
    };

    // Listen for storage events (cross-tab updates)
    window.addEventListener("storage", handleStorageChange);

    // Listen for custom event (same-tab updates from login/logout)
    window.addEventListener("sessionStorageChange", handleStorageChange);

    // Also check periodically to catch any missed updates
    const interval = setInterval(checkEmail, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sessionStorageChange", handleStorageChange);
      clearInterval(interval);
    };
  }, [userData]);

  // Cache email when user data is fetched
  useEffect(() => {
    if (userData?.email) {
      sessionStorage.setItem("userEmail", userData.email);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs React Query's fetched email into the sessionStorage-backed cache used before the query resolves
      setCachedEmail(userData.email);
    }
  }, [userData]);

  // Use fetched user data if available, otherwise use cached email
  const user = userData?.email ? userData : { email: cachedEmail };

  // Check if user is admin - ALWAYS use actual user data role (more secure)
  // Fallback to sessionStorage only if user data is not yet loaded
  // This prevents stale role data from showing admin panel to non-admin users
  const userRole = useMemo(
    () => userData?.role || sessionStorage.getItem("userRole") || "user",
    [userData?.role],
  );
  const isAdmin = userRole === "admin";

  // Handle notification click - memoized to prevent unnecessary re-renders
  // Smart redirect logic:
  // - If BOTH ticket and order notifications exist: Prioritize tickets (more urgent customer service)
  // - If only ticket notifications: Go to tickets page
  // - If only order notifications: Go to orders/dashboard page
  // - If neither: Fallback to default page
  const handleNotificationClick = useCallback(() => {
    // Mark notifications as read (this will optimistically clear the badge immediately)
    markReadMutation.mutate();

    // Determine redirect destination based on notification types
    // Priority: Tickets > Orders (tickets are more urgent customer service items)
    if (ticketNotificationCount > 0) {
      // Redirect to tickets page if there are ticket notifications
      // This handles both cases: tickets only, or tickets + orders (tickets prioritized)
      if (isAdmin) {
        navigate("/admin/tickets");
      } else {
        navigate("/tickets");
      }
    } else if (orderNotificationCount > 0) {
      // Redirect to orders/dashboard if there are only order notifications (no tickets)
      if (isAdmin) {
        navigate("/admin/orders");
      } else {
        navigate("/dashboard");
      }
    } else {
      // Fallback: no specific notifications, go to default page
      if (isAdmin) {
        navigate("/admin/orders");
      } else {
        navigate("/dashboard");
      }
    }

    // Close dropdown
    setDropdown(false);
  }, [
    markReadMutation,
    isAdmin,
    navigate,
    setDropdown,
    ticketNotificationCount,
    orderNotificationCount,
  ]);

  // Handle logout if user data fetch fails and no cached email
  useEffect(() => {
    if (error && !cachedEmail) {
      toast.error(error.message, {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error, cachedEmail]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the dropdown
      const target = event.target as HTMLElement | null;
      if (dropdownRef.current && target && !dropdownRef.current.contains(target)) {
        // Don't close if clicking on the user icon/avatar button (which toggles the dropdown) —
        // both the logged-in UserAvatar and logged-out CircleUserRound button carry this
        // data attribute (see Header.tsx).
        const isUserIcon = target.closest("[data-user-avatar-trigger]");

        if (!isUserIcon) {
          // Close dropdown when clicking anywhere outside (except user icon)
          setDropdown(false);
        }
      }
    };

    // Add event listener when dropdown is mounted
    // Use a small delay to avoid closing immediately when opening via user icon click
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      // Cleanup: remove event listener and clear timeout when dropdown is unmounted
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setDropdown]);

  function handleLogout() {
    logout();
    // Clear cart on logout to prevent cart persisting across users
    clearCart();
    // Clear cached email on logout
    setCachedEmail("");
    // Clear all React Query cache to prevent cross-user data
    queryClient.clear();
    setDropdown(false);
    navigate("/");
  }

  return (
    <div
      ref={dropdownRef}
      id="dropdownAvatar"
      className="select-none	absolute top-10 right-0 z-[100] w-44 bg-white rounded divide-y divide-gray-100 shadow dark:bg-gray-700 dark:divide-gray-600"
    >
      <div className="py-3 px-4 text-sm text-gray-700 dark:text-white">
        <div className="font-medium truncate">{user.email || "Loading..."}</div>
      </div>
      <ul
        className="py-1 text-sm text-gray-700 dark:text-gray-200"
        aria-labelledby="dropdownUserAvatarButton"
      >
        <li>
          <Link
            onClick={() => setDropdown(false)}
            to="/products"
            className="block py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
          >
            All eBooks
          </Link>
        </li>
        <li>
          <Link
            onClick={() => setDropdown(false)}
            to="/dashboard"
            className="block py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
          >
            Dashboard
          </Link>
        </li>
        <li>
          <Link
            onClick={() => setDropdown(false)}
            to="/tickets"
            className="block py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
          >
            Support Tickets
          </Link>
        </li>
        <li>
          <button
            onClick={handleNotificationClick}
            className="w-full text-left block py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white relative"
          >
            <span className="flex items-center justify-between">
              <span>Notifications</span>
              {notificationCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium leading-none text-white bg-red-600 rounded-full">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              )}
            </span>
          </button>
        </li>
        {isAdmin && (
          <li>
            <Link
              onClick={() => setDropdown(false)}
              to="/admin"
              className="block py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              Admin Panel
            </Link>
          </li>
        )}
      </ul>
      <div className="py-1">
        <span
          onClick={handleLogout}
          className="cursor-pointer block py-2 px-4 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-200 dark:hover:text-white"
        >
          Log out
        </span>
      </div>
    </div>
  );
};
