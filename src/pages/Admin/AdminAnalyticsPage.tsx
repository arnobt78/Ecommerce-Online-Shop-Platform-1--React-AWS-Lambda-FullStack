/**
 * AdminAnalyticsPage Component
 *
 * Comprehensive analytics dashboard for admin users.
 * Displays revenue charts, sales trends, top products, user analytics, and product performance.
 * Includes export functionality (CSV/PDF).
 *
 * Features:
 * - Revenue charts (daily, weekly, monthly, yearly)
 * - Sales trends over time
 * - Top-selling products
 * - User registration trends
 * - Product performance metrics
 * - Export to CSV/PDF
 */

import { useState, useEffect, useMemo, Suspense, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, ShoppingCart, Package, Users, Download, Printer, Sparkles, RefreshCw, AlertCircle, TrendingUp, UserCheck, UserPlus } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { AdminMetricsCard } from "./components/AdminMetricsCard";
import { useRevenueByPeriod, useSalesTrends, useTopProducts, useProductPerformance, useUserAnalytics, useAnalyticsSummary } from "../../hooks/useAnalytics";
import { useAiInsights } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { PageHeader, Card, LoadingState, ErrorState, FormSelect, StatusBadge, ChartSkeleton } from "../../components/ui";
import { exportRevenueToCSV, exportTopProductsToCSV, exportUserAnalyticsToCSV, exportSalesTrendsToCSV, exportSummaryToCSV, printToPDF } from "../../utils/exportUtils";
import { formatPrice } from "../../utils/formatPrice";
import { buildAiInsightsSummary, type RevenuePeriod } from "../../services/analyticsService";
import type { RevenueChartProps, SalesTrendChartProps, TopProductsChartProps, UserAnalyticsChartProps } from "../../components/ui/analytics-charts";

// recharts/d3 is a large dependency (~370KB) used only on this one page. The
// React.lazy() boundaries live one level up in routes/AllRoutes.tsx (same
// nesting depth as the Admin page lazy() defs) and are passed down as props
// — defining lazy() here, nested two dynamic-import levels deep inside the
// already-lazy Admin chunk, gets hoisted into the always-loaded main bundle
// by this bundler instead of staying deferred. ChartSkeleton fills the exact
// chart footprint while the chunk fetches (no layout shift).
interface AdminAnalyticsPageProps {
  RevenueChart: ComponentType<RevenueChartProps>;
  SalesTrendChart: ComponentType<SalesTrendChartProps>;
  TopProductsChart: ComponentType<TopProductsChartProps>;
  UserAnalyticsChart: ComponentType<UserAnalyticsChartProps>;
}

const AdminAnalyticsContent = ({
  RevenueChart,
  SalesTrendChart,
  TopProductsChart,
  UserAnalyticsChart,
}: AdminAnalyticsPageProps) => {
  const { toggleSidebar } = useAdminLayout();

  // State for period selection
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("monthly");

  // Fetch all analytics data
  const { data: revenueData, isLoading: revenueLoading, error: revenueError } = useRevenueByPeriod(revenuePeriod);

  const { data: salesTrendsData, isLoading: salesTrendsLoading, error: salesTrendsError } = useSalesTrends(30);

  const { data: topProductsData, isLoading: topProductsLoading, error: topProductsError } = useTopProducts(10);

  const { data: productPerformance, isLoading: performanceLoading, error: performanceError } = useProductPerformance();

  const { data: userAnalytics, isLoading: userAnalyticsLoading, error: userAnalyticsError } = useUserAnalytics();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useAnalyticsSummary();

  // Loading state
  const isLoading = revenueLoading || salesTrendsLoading || topProductsLoading || performanceLoading || userAnalyticsLoading || summaryLoading;

  // Parent: REQ-1613 — AI Business Insights. Built once every underlying
  // analytics query has resolved so the AI call only fires with real data
  // and never duplicates the chart queries above (all data already cached).
  const aiInsightsSummary = useMemo(() => {
    if (isLoading || !summary || !productPerformance || !userAnalytics) return "";
    return buildAiInsightsSummary(summary, topProductsData || [], productPerformance, userAnalytics);
  }, [isLoading, summary, topProductsData, productPerformance, userAnalytics]);

  const { data: aiInsights, isLoading: aiInsightsLoading, isFetching: aiInsightsFetching, error: aiInsightsError, refetch: refetchAiInsights } = useAiInsights(aiInsightsSummary, !!aiInsightsSummary);

  // Check for errors
  useEffect(() => {
    const errors = [revenueError, salesTrendsError, topProductsError, performanceError, userAnalyticsError, summaryError].filter(Boolean);

    if (errors.length > 0) {
      toast.error("Failed to load some analytics data", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [revenueError, salesTrendsError, topProductsError, performanceError, userAnalyticsError, summaryError]);

  // Export handlers
  const handleExportRevenue = () => {
    if (!revenueData || revenueData.length === 0) {
      toast.error("No revenue data to export", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }
    exportRevenueToCSV(revenueData, revenuePeriod);
    toast.success("Revenue data exported successfully", {
      closeButton: true,
      position: "bottom-right",
    });
  };

  const handleExportTopProducts = () => {
    if (!topProductsData || topProductsData.length === 0) {
      toast.error("No product data to export", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }
    exportTopProductsToCSV(topProductsData);
    toast.success("Top products data exported successfully", {
      closeButton: true,
      position: "bottom-right",
    });
  };

  const handleExportUserAnalytics = () => {
    if (!userAnalytics?.registrationTrends || userAnalytics.registrationTrends.length === 0) {
      toast.error("No user analytics data to export", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }
    exportUserAnalyticsToCSV(userAnalytics.registrationTrends);
    toast.success("User analytics data exported successfully", {
      closeButton: true,
      position: "bottom-right",
    });
  };

  const handleExportSalesTrends = () => {
    if (!salesTrendsData || salesTrendsData.length === 0) {
      toast.error("No sales trends data to export", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }
    exportSalesTrendsToCSV(salesTrendsData);
    toast.success("Sales trends data exported successfully", {
      closeButton: true,
      position: "bottom-right",
    });
  };

  const handleExportSummary = () => {
    if (!summary) {
      toast.error("No summary data to export", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }
    exportSummaryToCSV(summary);
    toast.success("Analytics summary exported successfully", {
      closeButton: true,
      position: "bottom-right",
    });
  };

  const handlePrintPDF = () => {
    printToPDF();
  };

  // Period options for revenue chart
  const periodOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader title="Business Insights Dashboard" description="Comprehensive analytics and insights for your e-commerce platform" onToggleSidebar={toggleSidebar} showBackButton={false} />

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          <LoadingState message="Loading analytics data..." />
        </div>
      )}

      {/* Error State */}
      {!isLoading && (summaryError || revenueError) && <ErrorState message="Failed to load analytics data. Please try again later." />}

      {/* Analytics Content */}
      {!isLoading && !summaryError && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminMetricsCard title="Total Revenue" value={summary ? formatPrice(summary.totalRevenue) : "$0.00"} icon={DollarSign} color="emerald" subtitle="All-time sales" />
            <AdminMetricsCard
              title="Total Orders"
              value={summary?.totalOrders || 0}
              icon={ShoppingCart}
              color="blue"
              subtitle="All-time orders"
              breakdown={Object.entries(summary?.ordersByStatus || {}).map(([status, count]) => ({ label: status, value: count }))}
            />
            <AdminMetricsCard title="Total Products" value={summary?.totalProducts || 0} icon={Package} color="violet" subtitle="Catalog size" />
            <AdminMetricsCard title="Total Users" value={summary?.totalUsers || 0} icon={Users} color="amber" subtitle="Registered users" />
          </div>

          {/* AI Business Insights (REQ-1613) — multi-provider fallback chain, backend/src/lib/ai/ */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" strokeWidth={2} />
                AI Business Insights
              </h2>
              <button
                onClick={() => refetchAiInsights()}
                disabled={aiInsightsFetching || !aiInsightsSummary}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${aiInsightsFetching ? "animate-spin" : ""}`} strokeWidth={2} />
                Refresh
              </button>
            </div>

            {aiInsightsLoading && (
              <div className="space-y-2" aria-label="Generating AI insights">
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-11/12" />
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-10/12" />
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-9/12" />
              </div>
            )}

            {!aiInsightsLoading && aiInsightsError && (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span>{aiInsightsError.message || "AI insights are temporarily unavailable."}</span>
              </div>
            )}

            {!aiInsightsLoading && !aiInsightsError && aiInsights && (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {aiInsights.insights.map((insight, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-400" strokeWidth={2} />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Generated by {aiInsights.provider} ({aiInsights.model}) · {new Date(aiInsights.generatedAt).toLocaleString()}
                </p>
              </div>
            )}

            {!aiInsightsLoading && !aiInsightsError && !aiInsights && !aiInsightsSummary && <p className="text-sm text-gray-500 dark:text-gray-500">Waiting for analytics data to summarize...</p>}
          </Card>

          {/* Additional Metrics */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AdminMetricsCard title="Average Order Value" value={formatPrice(summary.averageOrderValue)} icon={TrendingUp} color="sky" subtitle="Per-order average" />

              {productPerformance && (
                <AdminMetricsCard
                  title="Products Sold"
                  value={`${productPerformance.productsSold} / ${productPerformance.totalProducts}`}
                  icon={Package}
                  color="violet"
                  subtitle="Of total catalog"
                />
              )}
            </div>
          )}

          {/* Revenue Chart with Period Selector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 w-full">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white flex-shrink min-w-0">Revenue Analysis</h2>
              <div className="flex items-center gap-3 flex-shrink-0">
                <FormSelect
                  id="revenue-period"
                  name="revenue-period"
                  value={revenuePeriod}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRevenuePeriod(e.target.value as RevenuePeriod)}
                  options={periodOptions}
                  className="w-32"
                />
                <button
                  onClick={handleExportRevenue}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                >
                  <Download className="h-4 w-4 mr-2" strokeWidth={2} />
                  Export CSV
                </button>
              </div>
            </div>
            <Suspense fallback={<ChartSkeleton />}>
              <RevenueChart data={revenueData} period={revenuePeriod} isLoading={revenueLoading} error={revenueError} />
            </Suspense>
          </div>

          {/* Sales Trends Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white">Sales Trends</h2>
              <button
                onClick={handleExportSalesTrends}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" strokeWidth={2} />
                Export CSV
              </button>
            </div>
            <Suspense fallback={<ChartSkeleton />}>
              <SalesTrendChart data={salesTrendsData} isLoading={salesTrendsLoading} error={salesTrendsError} />
            </Suspense>
          </div>

          {/* Top Products Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white">Top Selling Products</h2>
              <button
                onClick={handleExportTopProducts}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" strokeWidth={2} />
                Export CSV
              </button>
            </div>
            <Suspense fallback={<ChartSkeleton />}>
              <TopProductsChart data={topProductsData} limit={10} isLoading={topProductsLoading} error={topProductsError} />
            </Suspense>
          </div>

          {/* Product Performance */}
          {productPerformance && (
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white mb-6">Product Performance</h2>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <span className="flex-shrink-0 p-2 rounded-lg bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                    <Package className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total Products</h3>
                    <p className="text-2xl font-medium text-gray-700 dark:text-white">{productPerformance.totalProducts}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <span className="flex-shrink-0 p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-sky-700 dark:text-sky-300">
                    <ShoppingCart className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Products Sold</h3>
                    <p className="text-2xl font-medium text-gray-700 dark:text-white">{productPerformance.productsSold}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <span className="flex-shrink-0 p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    <DollarSign className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Average Price</h3>
                    <p className="text-2xl font-medium text-gray-700 dark:text-white">{formatPrice(productPerformance.averagePrice)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best Sellers (All Tied) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3 flex items-center gap-2">
                    Best Sellers
                    {productPerformance.bestSellers && productPerformance.bestSellers.length > 1 && <StatusBadge status="featured" customLabels={{ featured: "Tied" }} />}
                  </h3>
                  {productPerformance.bestSellers && productPerformance.bestSellers.length > 0 ? (
                    <div className="space-y-2">
                      {productPerformance.bestSellers.map((product) => (
                        <div key={product.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          <p className="text-sm font-medium text-gray-700 dark:text-white mb-1">{product.name}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <span>Revenue: {formatPrice(product.revenue)}</span>
                            <span>Qty: {product.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500">No best sellers yet</p>
                  )}
                </div>

                {/* Top 3 by Revenue */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3">Top 3 by Revenue</h3>
                  {productPerformance.topSellersByRevenue && productPerformance.topSellersByRevenue.length > 0 ? (
                    <div className="space-y-2">
                      {productPerformance.topSellersByRevenue.map((product, index) => (
                        <div key={product.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                              <p className="text-sm font-medium text-gray-700 dark:text-white">{product.name}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              <span>Revenue: {formatPrice(product.revenue)}</span>
                              <span>Qty: {product.quantity}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500">No sales data yet</p>
                  )}
                </div>

                {/* Top 3 by Quantity (Demand) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3">Top 3 by Demand (Quantity Sold)</h3>
                  {productPerformance.topSellersByQuantity && productPerformance.topSellersByQuantity.length > 0 ? (
                    <div className="space-y-2">
                      {productPerformance.topSellersByQuantity.map((product, index) => (
                        <div key={product.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                              <p className="text-sm font-medium text-gray-700 dark:text-white">{product.name}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Qty: {product.quantity}</span>
                              <span>Revenue: {formatPrice(product.revenue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500">No sales data yet</p>
                  )}
                </div>

                {/* Unsold Products */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-white mb-3">
                    Unsold Products
                    {productPerformance.unsoldProducts && productPerformance.unsoldProducts.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({productPerformance.unsoldProducts.length})</span>
                    )}
                  </h3>
                  {productPerformance.unsoldProducts && productPerformance.unsoldProducts.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {productPerformance.unsoldProducts.map((product) => (
                        <div key={product.id} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 dark:text-white mb-1">{product.name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Price: {formatPrice(product.price)}</p>
                          </div>
                          <StatusBadge status="unverified" customLabels={{ unverified: "No Sales" }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-500">All products have been sold</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* User Analytics Chart */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-gray-700 dark:text-white">User Analytics</h2>
              <button
                onClick={handleExportUserAnalytics}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" strokeWidth={2} />
                Export CSV
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AdminMetricsCard title="Total Users" value={userAnalytics?.totalUsers || 0} icon={Users} color="amber" subtitle="All registered accounts" />
              <AdminMetricsCard title="Active Users" value={userAnalytics?.activeUsers || 0} icon={UserCheck} color="emerald" subtitle="Placed at least one order" />
              <AdminMetricsCard title="New Users This Month" value={userAnalytics?.newUsersThisMonth || 0} icon={UserPlus} color="sky" subtitle="Recently registered" />
            </div>
            <Suspense fallback={<ChartSkeleton />}>
              <UserAnalyticsChart data={userAnalytics?.registrationTrends || []} isLoading={userAnalyticsLoading} error={userAnalyticsError} />
            </Suspense>
          </div>

          {/* Export All / Print PDF */}
          <Card className="p-4 sm:p-6">
            <h2 className="text-xl font-medium text-gray-700 dark:text-white mb-4">Export Reports</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportSummary}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" strokeWidth={2} />
                Export Summary (CSV)
              </button>
              <button
                onClick={handlePrintPDF}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Printer className="h-4 w-4 mr-2" strokeWidth={2} />
                Print / Save as PDF
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export const AdminAnalyticsPage = (props: AdminAnalyticsPageProps) => {
  useTitle("Business Insights - Admin");
  const navigate = useNavigate();

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
      <AdminAnalyticsContent {...props} />
    </AdminLayout>
  );
};
