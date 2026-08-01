/**
 * AdminHeader Component
 *
 * Header for admin panel with user info, notifications, and sidebar toggle.
 * Displays current user email and provides quick actions.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, CircleUserRound, LogOut } from "lucide-react";
import { toast } from "../../../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../../../services";
import { useUser } from "../../../hooks/useUser";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export const AdminHeader = ({ onMenuClick }: AdminHeaderProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: userData } = useUser();

  // Load cached user email from sessionStorage (reactive to changes)
  const [cachedEmail, setCachedEmail] = useState(() => {
    try {
      return sessionStorage.getItem("userEmail") || "";
    } catch {
      return "";
    }
  });

  // Update cached email when sessionStorage changes or user data is fetched
  useEffect(() => {
    const checkEmail = () => {
      const email = sessionStorage.getItem("userEmail") || "";
      setCachedEmail(email);
    };

    checkEmail();
    window.addEventListener("storage", checkEmail);
    window.addEventListener("sessionStorageChange", checkEmail);
    const interval = setInterval(checkEmail, 100);

    return () => {
      window.removeEventListener("storage", checkEmail);
      window.removeEventListener("sessionStorageChange", checkEmail);
      clearInterval(interval);
    };
  }, [userData]);

  useEffect(() => {
    if (userData?.email) {
      sessionStorage.setItem("userEmail", userData.email);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs React Query's fetched email into the sessionStorage-backed cache used before the query resolves
      setCachedEmail(userData.email);
    }
  }, [userData]);

  const userEmail = userData?.email || cachedEmail;

  // Handle logout
  const handleLogout = () => {
    logout();
    setCachedEmail("");
    queryClient.clear();
    toast.success("Logged out successfully", {
      closeButton: true,
      position: "bottom-right",
    });
    navigate("/");
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 py-4">
        {/* Left: Menu Toggle - Only visible on mobile */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="md:hidden text-gray-700 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-medium text-gray-700 dark:text-white hidden sm:block">
            Admin Dashboard
          </h1>
        </div>

        {/* Right: User Info & Actions */}
        <div className="flex items-center gap-4">
          {/* User Email */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <CircleUserRound className="h-5 w-5 text-gray-700 dark:text-gray-300" strokeWidth={2} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
              {userEmail || "Loading..."}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
