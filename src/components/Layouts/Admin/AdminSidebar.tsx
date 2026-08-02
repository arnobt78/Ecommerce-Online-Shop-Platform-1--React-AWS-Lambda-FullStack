/**
 * AdminSidebar Component
 *
 * Collapsible sidebar navigation for admin panel.
 * Provides navigation links to all admin sections.
 * Includes logo, back to store link, and user info at bottom.
 *
 * @param {boolean} isOpen - Whether sidebar is open/expanded
 * @param {Function} setIsOpen - Function to toggle sidebar state
 * @param {Function} onMenuClick - Function to toggle sidebar (for mobile menu button)
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  History,
  Ticket,
  Star,
  Settings,
  Tag,
  Undo2,
  ArrowLeft,
  CircleUserRound,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { toast } from "../../../lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "../../../services";
import { useUser } from "../../../hooks/useUser";
const Logo = "/logo.png";

interface AdminSidebarProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  onMenuClick: () => void;
}

export const AdminSidebar = ({ isOpen, setIsOpen, onMenuClick: _onMenuClick }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: userData } = useUser();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Load cached user email from sessionStorage (reactive to changes)
  const [cachedEmail, setCachedEmail] = useState(() => {
    try {
      return sessionStorage.getItem("userEmail") || "";
    } catch {
      return "";
    }
  });

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Navigation items configuration
  const navItems: Array<{ path: string; label: string; icon: LucideIcon }> = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { path: "/admin/products", label: "Products", icon: Package },
    { path: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { path: "/admin/users", label: "Users", icon: Users },
    { path: "/admin/business-insights", label: "Analytics", icon: TrendingUp },
    { path: "/admin/management-history", label: "History", icon: History },
    { path: "/admin/tickets", label: "Support Tickets", icon: Ticket },
    { path: "/admin/reviews", label: "Product Reviews", icon: Star },
    { path: "/admin/coupons", label: "Coupons", icon: Tag },
    { path: "/admin/returns", label: "Returns", icon: Undo2 },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  // Check if a nav item is active
  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay - closes sidebar when clicked */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out
          bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:z-40
          w-64 flex-shrink-0
          h-screen
          flex flex-col
        `}
      >
        {/* Top Section: Logo + CodeBook (clickable to home) */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/"
            className="flex items-center hover:opacity-80 transition-opacity"
            onClick={() => {
              if (isMobile) {
                setIsOpen(false);
              }
            }}
          >
            <img src={Logo} className="mr-3 h-10" alt="CodeBook Logo" />
            <span className="self-center text-2xl font-medium whitespace-nowrap dark:text-white">
              CodeBook
            </span>
          </Link>
        </div>

        {/* Back to Store Link - Close gap below logo */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-4 py-2 transition-colors"
            onClick={() => {
              if (isMobile) {
                setIsOpen(false);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
            <span className="text-sm font-medium">Back to Store</span>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 flex flex-col min-h-0">
          <ul className="space-y-2 flex-1 flex flex-col justify-start min-h-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path} className="flex-shrink-0">
                  <Link
                    to={item.path}
                    onClick={() => {
                      // Close sidebar on mobile when navigating
                      if (isMobile) {
                        setIsOpen(false);
                      }
                    }}
                    className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm
                    ${
                      isActive(item.path)
                        ? "bg-blue-100 dark:bg-blue-900 text-sky-700 dark:text-sky-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }
                  `}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Section: User Email and Logout Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {/* User Email */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <CircleUserRound className="h-5 w-5 text-gray-700 dark:text-gray-300" strokeWidth={2} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {userEmail || "Loading..."}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
