/**
 * Admin Service - Direct backend API Calls for Admin Operations
 *
 * Admin-specific API calls for dashboard metrics and management.
 * All endpoints require admin authentication.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { ActivityLog, AdminUserDetail, Order, OrderWithTimeline, Product, User } from "../types";

interface Session {
  token: string | null;
  cbid: string | null;
}

function getSession(): Session {
  try {
    const token = JSON.parse(sessionStorage.getItem("token") || "null");
    const cbid = JSON.parse(sessionStorage.getItem("cbid") || "null");
    return { token, cbid };
  } catch {
    return { token: null, cbid: null };
  }
}

function requireAdminSession(): Session {
  const browserData = getSession();

  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const userRole = sessionStorage.getItem("userRole");
  if (userRole !== "admin") {
    throw new ApiError("Admin access required", 403);
  }

  return browserData;
}

async function extractErrorMessage(response: Response): Promise<string> {
  let errorMessage = response.statusText;
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || response.statusText;
  } catch {
    errorMessage = response.statusText;
  }
  return errorMessage;
}

function authHeaders(token: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Use dedicated admin endpoint to get all orders (admin panel) — returns all
// orders regardless of user. The user dashboard uses /orders (user-specific).
export async function getAllOrders(): Promise<Order[]> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders`, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function getAllUsers(): Promise<User[]> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function getAllProducts(): Promise<Product[]> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Priority for QR code base URL: 1. VITE_BASE_URL (production), 2. window.location.origin (localhost).
// Ensures QR codes are generated with the correct URL in all environments.
function resolveBaseUrl(): string {
  return (import.meta.env as Record<string, string | undefined>).VITE_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");
}

export async function createProduct(productData: Record<string, unknown>): Promise<Product> {
  const browserData = requireAdminSession();

  const baseUrl = resolveBaseUrl();
  const requestBody = {
    ...productData,
    ...(baseUrl && { baseUrl }),
  };

  const response = await fetch(`${API_BASE_URL}/admin/products`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateProduct(productId: string, updates: Record<string, unknown>): Promise<Product> {
  const browserData = requireAdminSession();

  const baseUrl = resolveBaseUrl();
  const requestBody = {
    ...updates,
    ...(baseUrl && { baseUrl }),
  };

  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
    method: "PUT",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function deleteProduct(productId: string): Promise<{ message: string; id: string }> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/products/${productId}`, {
    method: "DELETE",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateOrderStatus(orderId: string, status: string, reason?: string): Promise<Order> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
    method: "PUT",
    headers: authHeaders(browserData.token),
    // reason (REQ-1643) is an audit-log note only — the backend never forwards
    // it to Stripe's own reason enum (see orders.routes.ts toStripeRefundReason).
    body: JSON.stringify({ status, reason }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

interface RefundInput {
  amount?: number;
  reason?: string;
}

export async function refundOrder(orderId: string, refundData: RefundInput = {}): Promise<Order> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/refund`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(refundData),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export interface GenerateLabelOptions {
  carrier?: string;
  service?: string;
  fromAddress?: Record<string, string>;
  toAddress?: Record<string, string>;
  length?: string;
  width?: string;
  height?: string;
}

export interface OrderTrackingResult extends Order {
  trackingUrl?: string | null;
}

// Creates a shipping label automatically via Shippo API. Flow: create shipment
// → get rates → purchase label → update order. Automatically updates order
// status to "shipped"; customer receives a shipping notification email.
export async function generateShippingLabel(orderId: string, options: GenerateLabelOptions = {}): Promise<OrderTrackingResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/generate-label`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// Fallback for manual tracking entry when Shippo is unavailable. Automatically
// updates order status to "shipped" (or the passed status) and triggers a
// shipping notification email.
export async function addTrackingNumber(
  orderId: string,
  trackingNumber: string,
  trackingCarrier = "usps",
  status = "shipped",
): Promise<OrderTrackingResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/tracking`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify({ trackingNumber, trackingCarrier, status }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getOrderById(orderId: string): Promise<OrderWithTimeline> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function updateUser(userId: string, updates: Record<string, unknown>): Promise<User> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "PUT",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function deleteUser(userId: string): Promise<{ message: string; id: string }> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getUserById(userId: string): Promise<AdminUserDetail> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

export interface CategoryStat {
  category: string;
  count: number;
  avgRating: number;
}

export interface TopRatedProduct {
  id: string;
  name: string;
  author: string | null;
  rating: number;
}

export interface CatalogHealth {
  productsWithIsbn: number;
  productsWithPublisher: number;
  averagePages: number;
  inStockProducts: number;
  outOfStockProducts: number;
}

// REQ-1648 — deterministic restock-velocity projection (days until stockout
// from recent order velocity), not an LLM call: a numeric projection like this
// is more reliable and explainable as plain math than as a model guess.
export interface RestockForecastEntry {
  productId: string;
  productName: string;
  stock: number;
  dailyVelocity: number;
  daysUntilStockout: number;
}

export interface AdminStats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalUsers: number;
  recentOrders: Order[];
  allOrders: Order[];
  ordersByStatus: Record<string, number>;
  // Catalog insights (REQ: university-library-style admin dashboard enrichment) —
  // all derived client-side from the products already fetched above, so no
  // extra network round trip and always in sync with product CRUD invalidation.
  categoryStats: CategoryStat[];
  productsByYear: Array<[string, number]>;
  productsByLanguage: Array<[string, number]>;
  topRatedProducts: TopRatedProduct[];
  catalogHealth: CatalogHealth;
  restockForecast: RestockForecastEntry[];
}

export async function getAdminStats(): Promise<AdminStats> {
  requireAdminSession();

  try {
    // Fetch all orders, products, and users in parallel for faster loading
    const [orders, products, users] = await Promise.all([getAllOrders(), getAllProducts(), getAllUsers()]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
    const totalProducts = products.length;
    // Count total registered users from database (not just users who placed orders).
    const totalUsers = users.length;

    // All orders sorted by date (newest first)
    const allOrders = [...orders].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    // Recent orders (last 5, sorted by date)
    const recentOrders = allOrders.slice(0, 5);

    // Orders by status
    const ordersByStatus = orders.reduce<Record<string, number>>((acc, order) => {
      const status = order.status || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Category breakdown — count + average rating per catalog category.
    const categoryMap = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();
    for (const product of products) {
      const category = product.category || "Uncategorized";
      const entry = categoryMap.get(category) || { count: 0, ratingSum: 0, ratingCount: 0 };
      entry.count += 1;
      if (typeof product.rating === "number") {
        entry.ratingSum += product.rating;
        entry.ratingCount += 1;
      }
      categoryMap.set(category, entry);
    }
    const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
      .map(([category, entry]) => ({
        category,
        count: entry.count,
        avgRating: entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Publication year distribution — most recent years first.
    const yearMap = new Map<string, number>();
    for (const product of products) {
      if (!product.publishedYear) continue;
      const year = String(product.publishedYear);
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    }
    const productsByYear: Array<[string, number]> = Array.from(yearMap.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));

    // Language distribution.
    const languageMap = new Map<string, number>();
    for (const product of products) {
      const language = product.language || "Unspecified";
      languageMap.set(language, (languageMap.get(language) || 0) + 1);
    }
    const productsByLanguage: Array<[string, number]> = Array.from(languageMap.entries()).sort((a, b) => b[1] - a[1]);

    // Top rated products (highest rating first, capped at 5).
    const topRatedProducts: TopRatedProduct[] = [...products]
      .filter((product) => typeof product.rating === "number")
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)
      .map((product) => ({ id: product.id, name: product.name, author: product.author || null, rating: product.rating || 0 }));

    // Catalog completeness/health metrics.
    const productsWithIsbn = products.filter((product) => !!product.isbn).length;
    const productsWithPublisher = products.filter((product) => !!product.publisher).length;
    const pagesValues = products.map((product) => product.pages).filter((pages): pages is number => typeof pages === "number");
    const averagePages = pagesValues.length > 0 ? pagesValues.reduce((sum, pages) => sum + pages, 0) / pagesValues.length : 0;
    const inStockProducts = products.filter((product) => product.in_stock).length;
    const outOfStockProducts = totalProducts - inStockProducts;

    // Restock forecast (REQ-1648) — units sold per product in the last 30 days
    // (from the same orders already fetched above) projected against current
    // stock. Only surfaces products actually selling AND running low soon —
    // an unsold product with 5 left isn't at risk, so it's excluded.
    const RESTOCK_WINDOW_DAYS = 30;
    const RESTOCK_ALERT_THRESHOLD_DAYS = 60;
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - RESTOCK_WINDOW_DAYS);
    const unitsSoldByProduct = new Map<string, number>();
    for (const order of orders) {
      if (!order.createdAt || new Date(order.createdAt) < windowStart) continue;
      if (!Array.isArray(order.cartList)) continue;
      for (const item of order.cartList) {
        if (!item.id) continue;
        unitsSoldByProduct.set(item.id, (unitsSoldByProduct.get(item.id) || 0) + (item.quantity || 1));
      }
    }
    const restockForecast: RestockForecastEntry[] = products
      .filter((product) => product.stock != null)
      .map((product) => {
        const unitsSold = unitsSoldByProduct.get(product.id) || 0;
        const dailyVelocity = unitsSold / RESTOCK_WINDOW_DAYS;
        const daysUntilStockout = dailyVelocity > 0 ? (product.stock as number) / dailyVelocity : Infinity;
        return { productId: product.id, productName: product.name, stock: product.stock as number, dailyVelocity, daysUntilStockout };
      })
      .filter((entry) => Number.isFinite(entry.daysUntilStockout) && entry.daysUntilStockout <= RESTOCK_ALERT_THRESHOLD_DAYS)
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
      .slice(0, 10);

    return {
      totalOrders,
      totalRevenue,
      totalProducts,
      totalUsers,
      recentOrders,
      allOrders,
      ordersByStatus,
      categoryStats,
      productsByYear,
      productsByLanguage,
      topRatedProducts,
      catalogHealth: {
        productsWithIsbn,
        productsWithPublisher,
        averagePages,
        inStockProducts,
        outOfStockProducts,
      },
      restockForecast,
    };
  } catch (error) {
    // Re-throw ApiError as-is, wrap others
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error instanceof Error ? error.message : "Failed to fetch admin statistics", 500);
  }
}

export interface ActivityLogQueryOptions {
  entityType?: string;
  action?: string;
  limit?: number;
}

export async function getActivityLogs(options: ActivityLogQueryOptions = {}): Promise<ActivityLog[]> {
  const browserData = requireAdminSession();

  // Build query string
  const queryParams = new URLSearchParams();
  if (options.entityType) queryParams.set("entityType", options.entityType);
  if (options.action) queryParams.set("action", options.action);
  if (options.limit) queryParams.set("limit", options.limit.toString());

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/admin/activity-logs${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// Parent: REQ-1613 — multi-provider AI business insights (backend/src/lib/ai/).
export interface AiInsightsResult {
  insights: string[];
  provider: string;
  model: string;
  generatedAt: string;
  cached: boolean;
}

export async function getAiInsights(summary: string): Promise<AiInsightsResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/ai-insights`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify({ summary }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// REQ-1654 — on-demand consolidated stock digest (rollup instead of a ping
// per order). A real scheduled version of this same digest also now runs
// daily via node-cron (REQ-1661, opt-in via SCHEDULE_JOBS_ENABLED) — this
// button remains for an on-demand check outside that schedule.
export interface LowStockDigestResult {
  message: string;
  lowStockCount: number;
  outOfStockCount: number;
  messageId: string;
}

export async function sendLowStockDigest(): Promise<LowStockDigestResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/notifications/low-stock-digest`, {
    method: "POST",
    headers: authHeaders(browserData.token),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// REQ-1664 — on-demand AI product-description draft. Never auto-applied;
// the admin reviews/edits in ProductForm and must still explicitly save.
export interface ProductDescriptionInput {
  name: string;
  author?: string;
  category?: string;
  level?: string;
  tags?: string[];
}

export interface ProductDescriptionResult {
  overview: string;
  long_description: string;
  provider: string;
}

export async function generateProductDescription(input: ProductDescriptionInput): Promise<ProductDescriptionResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/products/generate-description`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}

// REQ-1662 — CSV import/export. Downloads trigger a real browser save (blob
// + object URL), same pattern as downloadOrderInvoice (dataService.ts).
async function downloadCsv(path: string, filenamePrefix: string): Promise<void> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${browserData.token}` },
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportProductsCsv(): Promise<void> {
  return downloadCsv("/admin/products/export", "products-export");
}

export function exportOrdersCsv(): Promise<void> {
  return downloadCsv("/admin/orders/export", "orders-export");
}

export interface ProductCsvImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
}

// `csv` is the raw file text (read client-side via File.text()) — no
// multipart/file-upload infra exists in this backend (images upload
// client-side directly to Cloudinary), and a CSV is plain text anyway.
export async function importProductsCsv(csv: string): Promise<ProductCsvImportResult> {
  const browserData = requireAdminSession();

  const response = await fetch(`${API_BASE_URL}/admin/products/import`, {
    method: "POST",
    headers: authHeaders(browserData.token),
    body: JSON.stringify({ csv }),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  return response.json();
}
