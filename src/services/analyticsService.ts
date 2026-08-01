/**
 * Analytics Service - Client-Side Analytics Calculations
 *
 * Calculates analytics data from existing orders, products, and users data.
 * All calculations are done client-side to minimize backend costs and API calls.
 * Uses existing data fetched via React Query hooks.
 */

import type { Order, Product, User } from "../types";

export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RevenueByPeriodEntry {
  date: string;
  revenue: number;
}

export function calculateRevenueByPeriod(orders: Order[], period: RevenuePeriod = "monthly"): RevenueByPeriodEntry[] {
  if (!orders || orders.length === 0) return [];

  const revenueMap = new Map<string, number>();

  orders.forEach((order) => {
    if (!order.createdAt || !order.amount_paid) return;

    const date = new Date(order.createdAt);
    let key: string;

    switch (period) {
      case "daily":
        key = date.toISOString().split("T")[0]!; // YYYY-MM-DD
        break;
      case "weekly": {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        key = weekStart.toISOString().split("T")[0]!;
        break;
      }
      case "monthly":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
        break;
      case "yearly":
        key = String(date.getFullYear()); // YYYY
        break;
      default:
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    const currentRevenue = revenueMap.get(key) || 0;
    revenueMap.set(key, currentRevenue + (order.amount_paid || 0));
  });

  // Convert to array and sort by date
  return Array.from(revenueMap.entries())
    .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SalesTrendEntry {
  date: string;
  revenue: number;
  orders: number;
}

export function calculateSalesTrends(orders: Order[], days = 30): SalesTrendEntry[] {
  if (!orders || orders.length === 0) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const trendsMap = new Map<string, SalesTrendEntry>();

  // Initialize all dates in range with 0
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split("T")[0]!;
    trendsMap.set(dateKey, { date: dateKey, revenue: 0, orders: 0 });
  }

  // Calculate actual data
  orders.forEach((order) => {
    if (!order.createdAt) return;

    const orderDate = new Date(order.createdAt);
    if (orderDate < startDate || orderDate > endDate) return;

    const dateKey = orderDate.toISOString().split("T")[0]!;
    const existing = trendsMap.get(dateKey) || { date: dateKey, revenue: 0, orders: 0 };

    trendsMap.set(dateKey, {
      date: dateKey,
      revenue: existing.revenue + (order.amount_paid || 0),
      orders: existing.orders + 1,
    });
  });

  return Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface TopProductEntry {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

export function calculateTopProducts(orders: Order[], products: Product[], limit = 10): TopProductEntry[] {
  if (!orders || orders.length === 0) return [];

  const productMap = new Map<string, TopProductEntry>();

  // Create product lookup map
  const productLookup = new Map<string, Product>();
  if (products) {
    products.forEach((product) => {
      productLookup.set(product.id, product);
    });
  }

  // Calculate sales per product
  orders.forEach((order) => {
    if (!order.cartList || !Array.isArray(order.cartList)) return;

    order.cartList.forEach((item) => {
      if (!item.id) return;

      const product = productLookup.get(item.id);
      const productName = product?.name || item.name || "Unknown Product";
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const revenue = quantity * price;

      const existing = productMap.get(item.id) || {
        productId: item.id,
        productName,
        quantity: 0,
        revenue: 0,
      };

      productMap.set(item.id, {
        ...existing,
        quantity: existing.quantity + quantity,
        revenue: existing.revenue + revenue,
      });
    });
  });

  // Sort by revenue (descending) and limit
  return Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      revenue: Number(item.revenue.toFixed(2)),
    }));
}

export interface ProductSalesEntry {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
  price: number;
}

export interface ProductPerformance {
  totalProducts: number;
  productsSold: number;
  averagePrice: number;
  totalRevenue: number;
  bestSeller: ProductSalesEntry | null;
  bestSellers: ProductSalesEntry[];
  topSellersByRevenue: ProductSalesEntry[];
  topSellersByQuantity: ProductSalesEntry[];
  unsoldProducts: ProductSalesEntry[];
}

export function calculateProductPerformance(orders: Order[], products: Product[]): ProductPerformance {
  if (!orders || !products) {
    return {
      totalProducts: 0,
      productsSold: 0,
      averagePrice: 0,
      totalRevenue: 0,
      bestSeller: null,
      bestSellers: [],
      topSellersByRevenue: [],
      topSellersByQuantity: [],
      unsoldProducts: [],
    };
  }

  const productSales = new Map<string, { productId: string; quantity: number; revenue: number }>();
  let totalRevenue = 0;

  // Initialize all products in sales map with zero sales
  products.forEach((product) => {
    productSales.set(product.id, { productId: product.id, quantity: 0, revenue: 0 });
  });

  // Calculate sales per product
  orders.forEach((order) => {
    if (!order.cartList || !Array.isArray(order.cartList)) return;

    order.cartList.forEach((item) => {
      if (!item.id) return;

      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const revenue = quantity * price;

      totalRevenue += revenue;

      const existing = productSales.get(item.id) || { productId: item.id, quantity: 0, revenue: 0 };

      productSales.set(item.id, {
        ...existing,
        quantity: existing.quantity + quantity,
        revenue: existing.revenue + revenue,
      });
    });
  });

  // Build product sales array with product details
  const productSalesArray: ProductSalesEntry[] = Array.from(productSales.entries())
    .map(([productId, sales]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return null;

      return {
        id: product.id,
        name: product.name,
        revenue: Number(sales.revenue.toFixed(2)),
        quantity: sales.quantity,
        price: product.price || 0,
      };
    })
    .filter((item): item is ProductSalesEntry => item !== null);

  // Find all products tied for highest revenue (best sellers)
  const maxRevenue = productSalesArray.length > 0 ? Math.max(...productSalesArray.map((p) => p.revenue)) : 0;
  const bestSellers = productSalesArray.filter((p) => p.revenue === maxRevenue && p.revenue > 0);

  // Get top 3 by revenue
  const topSellersByRevenue = [...productSalesArray]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3)
    .filter((p) => p.revenue > 0);

  // Get top 3 by quantity sold (demand-based)
  const topSellersByQuantity = [...productSalesArray]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3)
    .filter((p) => p.quantity > 0);

  // Find unsold products (zero sales)
  const unsoldProducts = productSalesArray.filter((p) => p.revenue === 0 && p.quantity === 0).sort((a, b) => a.name.localeCompare(b.name));

  // Calculate average price
  const averagePrice = products.length > 0 ? products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length : 0;

  // Backward compatibility: keep bestSeller as first best seller
  const bestSeller = bestSellers.length > 0 ? bestSellers[0]! : null;

  return {
    totalProducts: products.length,
    productsSold: productSalesArray.filter((p) => p.revenue > 0 || p.quantity > 0).length,
    averagePrice: Number(averagePrice.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    bestSeller, // Backward compatibility
    bestSellers, // All products tied for highest revenue
    topSellersByRevenue, // Top 3 by revenue
    topSellersByQuantity, // Top 3 by quantity (demand)
    unsoldProducts, // Products with zero sales
  };
}

export interface SingleProductOrderEntry {
  orderId: string;
  orderDate: string;
  quantity: number;
  price: number;
  revenue: number;
  orderTotal: number;
}

export interface SingleProductAnalytics {
  productId: string | null;
  productName: string;
  purchaseCount: number;
  totalQuantity: number;
  totalRevenue: number;
  averageOrderValue: number;
  orders: SingleProductOrderEntry[];
}

export function calculateSingleProductAnalytics(
  productId: string | null,
  orders: Order[],
  product: Product | null | undefined
): SingleProductAnalytics {
  if (!orders || !product) {
    return {
      productId: productId || null,
      productName: product?.name || "Unknown",
      purchaseCount: 0,
      totalQuantity: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      orders: [],
    };
  }

  let totalQuantity = 0;
  let totalRevenue = 0;
  const ordersContainingProduct: SingleProductOrderEntry[] = [];

  // Calculate sales for this specific product
  orders.forEach((order) => {
    if (!order.cartList || !Array.isArray(order.cartList)) return;

    const productItem = order.cartList.find((item) => item.id === productId);
    if (productItem) {
      const quantity = productItem.quantity || 1;
      const price = productItem.price || product.price || 0;
      const revenue = quantity * price;

      totalQuantity += quantity;
      totalRevenue += revenue;
      ordersContainingProduct.push({
        orderId: order.id,
        orderDate: order.createdAt,
        quantity,
        price,
        revenue,
        orderTotal: order.amount_paid || 0,
      });
    }
  });

  const purchaseCount = ordersContainingProduct.length;
  const averageOrderValue = purchaseCount > 0 ? totalRevenue / purchaseCount : 0;

  return {
    productId: productId || null,
    productName: product?.name || "Unknown",
    purchaseCount,
    totalQuantity,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
    orders: ordersContainingProduct.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
  };
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  registrationTrends: Array<{ date: string; count: number }>;
}

export function calculateUserAnalytics(users: User[], orders: Order[]): UserAnalytics {
  if (!users || !orders) {
    return { totalUsers: 0, activeUsers: 0, newUsersThisMonth: 0, registrationTrends: [] };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Calculate active users (users who have placed at least one order)
  const usersWithOrders = new Set<string>();
  orders.forEach((order) => {
    if (order.user?.id) {
      usersWithOrders.add(order.user.id);
    }
  });

  // Calculate new users this month
  const newUsersThisMonth = users.filter((user) => {
    if (!user.createdAt) return false;
    const userDate = new Date(user.createdAt);
    return userDate >= startOfMonth;
  }).length;

  // Calculate registration trends (monthly)
  const registrationMap = new Map<string, number>();
  users.forEach((user) => {
    if (!user.createdAt) return;

    const date = new Date(user.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const current = registrationMap.get(key) || 0;
    registrationMap.set(key, current + 1);
  });

  const registrationTrends = Array.from(registrationMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalUsers: users.length,
    activeUsers: usersWithOrders.size,
    newUsersThisMonth,
    registrationTrends,
  };
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  averageOrderValue: number;
}

export function calculateAnalyticsSummary(orders: Order[], products: Product[], users: User[]): AnalyticsSummary {
  if (!orders || !products || !users) {
    return { totalRevenue: 0, totalOrders: 0, totalProducts: 0, totalUsers: 0, averageOrderValue: 0 };
  }

  const totalRevenue = orders.reduce((sum, order) => sum + (order.amount_paid || 0), 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalOrders,
    totalProducts: products.length,
    totalUsers: users.length,
    averageOrderValue: Number(averageOrderValue.toFixed(2)),
  };
}

// Parent: REQ-1613 — condenses already-computed analytics (no extra DB/API
// calls) into a short plain-text summary for the AI insights backend route.
export function buildAiInsightsSummary(
  summary: AnalyticsSummary,
  topProducts: TopProductEntry[],
  performance: ProductPerformance,
  userAnalytics: UserAnalytics
): string {
  const parts: string[] = [
    `Revenue: $${summary.totalRevenue.toFixed(2)} across ${summary.totalOrders} orders (avg order $${summary.averageOrderValue.toFixed(2)}).`,
    `Catalog: ${summary.totalProducts} products, ${performance.productsSold} sold.`,
  ];

  if (topProducts.length > 0) {
    const top = topProducts.slice(0, 5).map((p) => `${p.productName} (${p.quantity} sold, $${p.revenue.toFixed(2)})`);
    parts.push(`Top sellers: ${top.join("; ")}.`);
  }

  if (performance.unsoldProducts.length > 0) {
    const unsold = performance.unsoldProducts.slice(0, 5).map((p) => p.name);
    parts.push(`Never-sold products (${performance.unsoldProducts.length} total): ${unsold.join(", ")}.`);
  }

  parts.push(`Users: ${summary.totalUsers} total, ${userAnalytics.activeUsers} active, ${userAnalytics.newUsersThisMonth} new this month.`);

  return parts.join(" ");
}
