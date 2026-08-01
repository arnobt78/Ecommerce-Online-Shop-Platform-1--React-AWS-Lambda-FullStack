/**
 * Analytics chart components (Revenue, Sales Trend, Top Products, User
 * Registration) — all 4 recharts-based charts live in one file so the
 * bundler treats them as a single, substantial React.lazy() target instead
 * of several thin re-export facades, which this project's build otherwise
 * ends up inlining into the always-loaded main bundle. Only used by
 * AdminAnalyticsPage; lazy() boundaries are defined in routes/AllRoutes.tsx
 * and passed down as props (see that file's comment for why).
 */

import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Payload } from "recharts/types/component/DefaultTooltipContent";
import type { RevenueByPeriodEntry, RevenuePeriod, SalesTrendEntry, TopProductEntry, UserAnalytics } from "../../services/analyticsService";
import { Card } from "./card";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";

function formatCurrency(value: number | string) {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(dateString?: string) {
  if (!dateString) return "";
  const [year, month] = dateString.split("-");
  return `${MONTH_NAMES[parseInt(month ?? "1") - 1]} ${year}`;
}

// ---------------------------------------------------------------------------
// RevenueChart
// ---------------------------------------------------------------------------

export interface RevenueChartProps {
  data?: RevenueByPeriodEntry[];
  period?: RevenuePeriod;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

export function RevenueChart({ data = [], period = "monthly", isLoading = false, error = null, className = "" }: RevenueChartProps) {
  if (isLoading) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <LoadingState message="Loading revenue data..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <ErrorState message={error.message || "Failed to load revenue data"} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <EmptyState message="No revenue data available" />
      </Card>
    );
  }

  const formatDateLabel = (dateString?: string) => {
    if (!dateString) return "";
    if (period === "yearly") return dateString;
    if (period === "monthly") return formatMonthLabel(dateString);
    if (period === "weekly" || period === "daily") {
      return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return dateString;
  };

  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">
        Revenue by {period.charAt(0).toUpperCase() + period.slice(1)}
      </h3>
      <div className="overflow-x-auto sm:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="date" tickFormatter={formatDateLabel} className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value ?? 0))}
                labelFormatter={(label) => formatDateLabel(typeof label === "string" ? label : undefined)}
                contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.95)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SalesTrendChart
// ---------------------------------------------------------------------------

export interface SalesTrendChartProps {
  data?: SalesTrendEntry[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

// Module-scope (not defined inside the parent component) so it isn't
// recreated on every render — Recharts invokes it with active/payload/label props.
function SalesTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload<number, string>>;
  label?: string | number;
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-700 dark:text-white mb-2">
        {new Date(label as string).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </p>
      {payload.map((entry, index) => {
        const isRevenue = entry.dataKey === "revenue";
        return (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {isRevenue ? "Revenue" : "Orders"}: {isRevenue ? formatCurrency(entry.value as number) : entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function SalesTrendChart({ data = [], isLoading = false, error = null, className = "" }: SalesTrendChartProps) {
  if (isLoading) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <LoadingState message="Loading sales trends..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <ErrorState message={error.message || "Failed to load sales trends"} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <EmptyState message="No sales trend data available" />
      </Card>
    );
  }

  const formatDateLabel = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Sales Trends (Last 30 Days)</h3>
      <div className="overflow-x-auto sm:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="date" tickFormatter={formatDateLabel} className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis yAxisId="left" tickFormatter={(value) => `$${value.toLocaleString()}`} className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis yAxisId="right" orientation="right" className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip content={<SalesTrendTooltip />} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} name="Orders" dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TopProductsChart
// ---------------------------------------------------------------------------

export interface TopProductsChartProps {
  data?: TopProductEntry[];
  limit?: number;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

function TopProductsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<Payload<number, string>>;
  label?: string | number;
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3">
      <p className="font-medium text-gray-700 dark:text-white mb-2">{label}</p>
      {payload.map((entry, index) => {
        const isRevenue = entry.dataKey === "revenue";
        return (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {isRevenue ? "Revenue" : "Quantity"}: {isRevenue ? formatCurrency(entry.value as number) : entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function TopProductsChart({ data = [], limit = 10, isLoading = false, error = null, className = "" }: TopProductsChartProps) {
  if (isLoading) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <LoadingState message="Loading top products..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <ErrorState message={error.message || "Failed to load top products"} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <EmptyState message="No product sales data available" />
      </Card>
    );
  }

  const chartData = data.slice(0, limit).map((item) => ({ ...item, name: item.productName }));

  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Top {limit} Selling Products</h3>
      <div className="overflow-x-auto sm:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={600}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="0%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                className="text-xs text-gray-600 dark:text-gray-400"
                angle={0}
                textAnchor="end"
                tickFormatter={(value) => (value.length > 40 ? `${value.substring(0, 40)}...` : value)}
              />
              <Tooltip content={<TopProductsTooltip />} />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[0, 8, 8, 0]} />
              <Bar dataKey="quantity" fill="#10b981" name="Quantity Sold" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// UserAnalyticsChart
// ---------------------------------------------------------------------------

export interface UserAnalyticsChartProps {
  data?: UserAnalytics["registrationTrends"];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

export function UserAnalyticsChart({ data = [], isLoading = false, error = null, className = "" }: UserAnalyticsChartProps) {
  if (isLoading) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <LoadingState message="Loading user analytics..." />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <ErrorState message={error.message || "Failed to load user analytics"} />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className={`p-4 sm:p-6 ${className}`}>
        <EmptyState message="No user registration data available" />
      </Card>
    );
  }

  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">User Registration Trends</h3>
      <div className="overflow-x-auto sm:overflow-x-visible -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[600px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
              <XAxis dataKey="date" tickFormatter={formatMonthLabel} className="text-xs text-gray-600 dark:text-gray-400" />
              <YAxis className="text-xs text-gray-600 dark:text-gray-400" />
              <Tooltip
                formatter={(value) => [value, "New Users"]}
                labelFormatter={(label) => formatMonthLabel(typeof label === "string" ? label : undefined)}
                contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.95)", border: "1px solid #e5e7eb", borderRadius: "8px" }}
              />
              <Legend />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" name="New Users" dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
