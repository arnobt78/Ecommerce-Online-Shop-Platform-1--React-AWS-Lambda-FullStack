/**
 * Export Utilities
 *
 * Functions for exporting analytics data to CSV and PDF formats.
 * All exports are done client-side without server calls.
 */

interface ExportColumn {
  key: string;
  label: string;
}

// data is typed `object` (not `Record<string, unknown>`) so that any domain
// interface (RevenueByPeriodEntry, TopProductEntry, ...) can be passed
// directly — interfaces without an index signature aren't assignable to
// Record<string, unknown> even when every property matches structurally.
export function exportToCSV(data: Array<object> | null | undefined, filename = "export", columns: ExportColumn[] | null = null): void {
  if (!data || data.length === 0) {
    // Silently return - error handling is done in the component
    return;
  }

  const records = data as Array<Record<string, unknown>>;

  // If columns not provided, use all keys from first object
  const headers = columns ? columns.map((col) => col.label) : Object.keys(records[0]!);

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  // Create CSV rows
  const rows = records.map((item) => {
    if (columns) {
      return columns.map((col) => formatValue(item[col.key]));
    }
    return Object.values(item).map(formatValue);
  });

  // Combine headers and rows
  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportRevenueToCSV(revenueData: Array<object>, period = "monthly"): void {
  exportToCSV(revenueData, `revenue-${period}`, [
    { key: "date", label: "Date" },
    { key: "revenue", label: "Revenue ($)" },
  ]);
}

export function exportTopProductsToCSV(topProducts: Array<object>): void {
  exportToCSV(topProducts, "top-products", [
    { key: "productName", label: "Product Name" },
    { key: "quantity", label: "Quantity Sold" },
    { key: "revenue", label: "Revenue ($)" },
  ]);
}

export function exportUserAnalyticsToCSV(registrationTrends: Array<object>): void {
  exportToCSV(registrationTrends, "user-registration-trends", [
    { key: "date", label: "Month" },
    { key: "count", label: "New Users" },
  ]);
}

export function exportSalesTrendsToCSV(trendsData: Array<object>): void {
  exportToCSV(trendsData, "sales-trends", [
    { key: "date", label: "Date" },
    { key: "revenue", label: "Revenue ($)" },
    { key: "orders", label: "Orders" },
  ]);
}

interface AnalyticsSummary {
  totalRevenue?: number;
  totalOrders?: number;
  totalProducts?: number;
  totalUsers?: number;
  averageOrderValue?: number;
}

export function exportSummaryToCSV(summary: AnalyticsSummary): void {
  const summaryArray = [
    { Metric: "Total Revenue", Value: `$${summary.totalRevenue?.toLocaleString() || 0}` },
    { Metric: "Total Orders", Value: summary.totalOrders || 0 },
    { Metric: "Total Products", Value: summary.totalProducts || 0 },
    { Metric: "Total Users", Value: summary.totalUsers || 0 },
    { Metric: "Average Order Value", Value: `$${summary.averageOrderValue?.toLocaleString() || 0}` },
  ];

  exportToCSV(summaryArray, "analytics-summary", [
    { key: "Metric", label: "Metric" },
    { key: "Value", label: "Value" },
  ]);
}

// Print analytics page to PDF (using browser print). Triggers the browser's
// print dialog; users can save as PDF from there.
export function printToPDF(): void {
  window.print();
}
