/**
 * AdminDashboardPage Component
 *
 * Main admin dashboard overview page displaying key metrics and recent orders.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Total orders, revenue, products, users metrics
 * - Recent orders widget
 * - Order status distribution
 * - Real-time data updates
 */

import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, DollarSign, Package, Users, TrendingUp, ListChecks } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useAdminStats } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { AdminMetricsCard } from "./components/AdminMetricsCard";
import { AdminRecentOrders } from "./components/AdminRecentOrders";
import { AdminStatsSkeleton } from "./components/AdminStatsSkeleton";
import { AdminCatalogInsights } from "./components/AdminCatalogInsights";
import { PageHeader, ErrorState, Card, ScrollReveal, StaggerContainer, StaggerItem } from "../../components/ui";
import type { Order } from "../../types";

interface DashboardMetrics {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalUsers: number;
  averageOrderValue: string | number;
  recentOrders: Order[];
  allOrders: Order[];
  ordersByStatus: Record<string, number>;
}

// Inner component that uses the AdminLayout context
const AdminDashboardContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { data: stats, isLoading, error } = useAdminStats();

  // Show error toast if API call fails (use useEffect to avoid render-time side effects)
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load admin statistics", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Calculate additional metrics from stats
  const metrics = useMemo<DashboardMetrics | null>(() => {
    if (!stats) return null;

    return {
      totalOrders: stats.totalOrders || 0,
      totalRevenue: stats.totalRevenue || 0,
      totalProducts: stats.totalProducts || 0,
      totalUsers: stats.totalUsers || 0,
      averageOrderValue: stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : 0,
      recentOrders: stats.recentOrders || [],
      allOrders: stats.allOrders || [],
      ordersByStatus: stats.ordersByStatus || {},
    };
  }, [stats]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader title="Dashboard Overview" description="Key metrics and recent activity" onToggleSidebar={toggleSidebar} />

      {/* Loading State */}
      {isLoading && <AdminStatsSkeleton />}

      {/* Error State */}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load dashboard data"} />}

      {/* Metrics Cards */}
      {!isLoading && !error && metrics && (
        <>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem>
              <AdminMetricsCard
                title="Total Orders"
                value={metrics.totalOrders}
                icon={ShoppingCart}
                color="blue"
                subtitle="All time orders"
                breakdown={Object.entries(metrics.ordersByStatus).map(([status, count]) => ({
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                  value: count,
                }))}
              />
            </StaggerItem>
            <StaggerItem>
              <AdminMetricsCard title="Total Revenue" value={`$${metrics.totalRevenue.toLocaleString()}`} icon={DollarSign} color="emerald" subtitle="Total sales" />
            </StaggerItem>
            <StaggerItem>
              <AdminMetricsCard title="Total Products" value={metrics.totalProducts} icon={Package} color="violet" subtitle="Active products" />
            </StaggerItem>
            <StaggerItem>
              <AdminMetricsCard title="Total Users" value={metrics.totalUsers} icon={Users} color="amber" subtitle="Registered users" />
            </StaggerItem>
          </StaggerContainer>

          {/* Additional Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ScrollReveal direction="left">
              <AdminMetricsCard title="Average Order Value" value={`$${metrics.averageOrderValue}`} icon={TrendingUp} color="sky" subtitle="Per order average" />
            </ScrollReveal>
            <ScrollReveal direction="right">
              <Card className="p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  <ListChecks className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Orders by Status
                </h3>
                <div className="space-y-2">
                  {Object.keys(metrics.ordersByStatus).length > 0 ? (
                    Object.entries(metrics.ordersByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-white">{count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No status data available</p>
                  )}
                </div>
              </Card>
            </ScrollReveal>
          </div>

          {/* Recent Orders */}
          <ScrollReveal direction="bottom">
            <AdminRecentOrders orders={metrics.allOrders || []} />
          </ScrollReveal>

          {/* Catalog Insights — category/year/language breakdowns, top rated, health */}
          {stats && (
            <ScrollReveal direction="bottom">
              <AdminCatalogInsights
                categoryStats={stats.categoryStats || []}
                productsByYear={stats.productsByYear || []}
                productsByLanguage={stats.productsByLanguage || []}
                topRatedProducts={stats.topRatedProducts || []}
                catalogHealth={
                  stats.catalogHealth || {
                    productsWithIsbn: 0,
                    productsWithPublisher: 0,
                    averagePages: 0,
                    inStockProducts: 0,
                    outOfStockProducts: 0,
                  }
                }
                totalProducts={metrics.totalProducts}
              />
            </ScrollReveal>
          )}
        </>
      )}
    </div>
  );
};

export const AdminDashboardPage = () => {
  useTitle("Admin Dashboard");
  const navigate = useNavigate();

  // Check if user is admin before fetching data
  useEffect(() => {
    const userRole = sessionStorage.getItem("userRole");
    if (userRole !== "admin") {
      toast.error("Admin access required", {
        closeButton: true,
        position: "bottom-right",
      });
      navigate("/products");
    }
  }, [navigate]);

  return (
    <AdminLayout>
      <AdminDashboardContent />
    </AdminLayout>
  );
};
