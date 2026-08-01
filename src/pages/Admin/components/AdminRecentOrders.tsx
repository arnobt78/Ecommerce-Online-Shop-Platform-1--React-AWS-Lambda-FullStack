/**
 * AdminRecentOrders Component
 *
 * Displays recent orders in a table format with search and expand/collapse functionality.
 * Shows order ID, customer email, amount, and date.
 */

import { useState, useMemo } from "react";
import { SearchInput, EmptyState, Card } from "../../../components/ui";
import { formatDateLong } from "../../../utils/formatDate";
import type { Order } from "../../../types";

interface AdminRecentOrdersProps {
  orders?: Order[];
}

// Helper function to format date for two-line display on mobile
const formatDateTwoLines = (dateString: string | null | undefined): { date: string; time: string } => {
  if (!dateString) return { date: "N/A", time: "" };
  try {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { date: datePart, time: timePart };
  } catch {
    return { date: "N/A", time: "" };
  }
};

export const AdminRecentOrders = ({ orders = [] }: AdminRecentOrdersProps) => {
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter orders based on search query (order ID or customer email)
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) {
      return orders;
    }

    const query = searchQuery.toLowerCase().trim();
    return orders.filter((order) => {
      const orderId = (order.id || "").toLowerCase();
      const customerEmail = (order.user?.email || "").toLowerCase();
      return orderId.includes(query) || customerEmail.includes(query);
    });
  }, [orders, searchQuery]);

  // Determine which orders to display (5 or all, after filtering)
  const displayedOrders = useMemo(() => {
    if (showAll) {
      return filteredOrders;
    }
    return filteredOrders.slice(0, 5);
  }, [filteredOrders, showAll]);

  // Check if there are more orders to show
  const hasMoreOrders = filteredOrders.length > 5;
  const totalFilteredCount = filteredOrders.length;

  return (
    <Card className="p-0">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-gray-700 dark:text-white">Recent Orders</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {showAll ? `All orders (${totalFilteredCount})` : `Latest ${Math.min(5, totalFilteredCount)} orders`}
            </p>
          </div>
          {/* Search Bar - Responsive */}
          <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[350px]">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search by order ID or customer..." className="w-full sm:w-auto" />
          </div>
        </div>
      </div>
      {displayedOrders.length === 0 ? (
        <EmptyState message={searchQuery ? "No orders found matching your search" : "No recent orders"} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[200px] sm:min-w-[250px]">Order ID</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayedOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 sm:px-6 py-4 min-w-[200px] sm:min-w-[250px]">
                    <span className="text-sm font-medium text-gray-700 dark:text-white break-words">{order.id || "N/A"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{order.user?.email || "N/A"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-700 dark:text-white">${order.amount_paid?.toLocaleString() || "0.00"}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{order.quantity || order.cartList?.length || 0}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex flex-col sm:flex-row sm:whitespace-nowrap">
                      <div className="flex flex-col sm:hidden">
                        {(() => {
                          const { date, time } = formatDateTwoLines(order.createdAt);
                          return (
                            <>
                              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{date}</span>
                              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">at {time}</span>
                            </>
                          );
                        })()}
                      </div>
                      <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">{formatDateLong(order.createdAt)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMoreOrders && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-sky-600 dark:text-sky-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 rounded px-2 py-1"
          >
            {showAll ? "Show less" : "View all orders →"}
          </button>
        </div>
      )}
    </Card>
  );
};
