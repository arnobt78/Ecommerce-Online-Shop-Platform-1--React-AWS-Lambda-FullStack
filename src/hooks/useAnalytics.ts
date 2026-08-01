/**
 * React Query hooks for analytics data
 *
 * Provides automatic caching, deduplication, and loading states for analytics.
 * All analytics calculations are done client-side from existing data.
 * Uses infinite cache strategy - data cached until manually invalidated.
 */

import { useMemo } from "react";
import { useAllOrders, useAllProducts, useAllUsers } from "./useAdmin";
import {
  calculateRevenueByPeriod,
  calculateSalesTrends,
  calculateTopProducts,
  calculateProductPerformance,
  calculateUserAnalytics,
  calculateAnalyticsSummary,
  type RevenuePeriod,
  type RevenueByPeriodEntry,
  type SalesTrendEntry,
  type TopProductEntry,
  type ProductPerformance,
  type UserAnalytics,
  type AnalyticsSummary,
} from "../services/analyticsService";

interface AnalyticsResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

export function useRevenueByPeriod(period: RevenuePeriod = "monthly", enabled = true): AnalyticsResult<RevenueByPeriodEntry[]> {
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);

  const revenueData = useMemo(() => {
    if (ordersLoading || ordersError || !orders.length) return [];
    return calculateRevenueByPeriod(orders, period);
  }, [orders, period, ordersLoading, ordersError]);

  return { data: revenueData, isLoading: ordersLoading, error: ordersError };
}

export function useSalesTrends(days = 30, enabled = true): AnalyticsResult<SalesTrendEntry[]> {
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);

  const trendsData = useMemo(() => {
    if (ordersLoading || ordersError || !orders.length) return [];
    return calculateSalesTrends(orders, days);
  }, [orders, days, ordersLoading, ordersError]);

  return { data: trendsData, isLoading: ordersLoading, error: ordersError };
}

export function useTopProducts(limit = 10, enabled = true): AnalyticsResult<TopProductEntry[]> {
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);
  const { data: products = [], isLoading: productsLoading, error: productsError } = useAllProducts(enabled);

  const topProducts = useMemo(() => {
    if (ordersLoading || productsLoading || ordersError || productsError || !orders.length || !products.length) {
      return [];
    }
    return calculateTopProducts(orders, products, limit);
  }, [orders, products, limit, ordersLoading, productsLoading, ordersError, productsError]);

  return { data: topProducts, isLoading: ordersLoading || productsLoading, error: ordersError || productsError };
}

const EMPTY_PERFORMANCE: ProductPerformance = {
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

export function useProductPerformance(enabled = true): AnalyticsResult<ProductPerformance> {
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);
  const { data: products = [], isLoading: productsLoading, error: productsError } = useAllProducts(enabled);

  const performance = useMemo(() => {
    if (ordersLoading || productsLoading || ordersError || productsError) {
      return EMPTY_PERFORMANCE;
    }
    return calculateProductPerformance(orders, products);
  }, [orders, products, ordersLoading, productsLoading, ordersError, productsError]);

  return { data: performance, isLoading: ordersLoading || productsLoading, error: ordersError || productsError };
}

const EMPTY_USER_ANALYTICS: UserAnalytics = {
  totalUsers: 0,
  activeUsers: 0,
  newUsersThisMonth: 0,
  registrationTrends: [],
};

export function useUserAnalytics(enabled = true): AnalyticsResult<UserAnalytics> {
  const { data: users = [], isLoading: usersLoading, error: usersError } = useAllUsers(enabled);
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);

  const userAnalytics = useMemo(() => {
    if (usersLoading || ordersLoading || usersError || ordersError) {
      return EMPTY_USER_ANALYTICS;
    }
    return calculateUserAnalytics(users, orders);
  }, [users, orders, usersLoading, ordersLoading, usersError, ordersError]);

  return { data: userAnalytics, isLoading: usersLoading || ordersLoading, error: usersError || ordersError };
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalRevenue: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalUsers: 0,
  averageOrderValue: 0,
};

export function useAnalyticsSummary(enabled = true): AnalyticsResult<AnalyticsSummary> {
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useAllOrders(enabled);
  const { data: products = [], isLoading: productsLoading, error: productsError } = useAllProducts(enabled);
  const { data: users = [], isLoading: usersLoading, error: usersError } = useAllUsers(enabled);

  const summary = useMemo(() => {
    if (ordersLoading || productsLoading || usersLoading || ordersError || productsError || usersError) {
      return EMPTY_SUMMARY;
    }
    return calculateAnalyticsSummary(orders, products, users);
  }, [orders, products, users, ordersLoading, productsLoading, usersLoading, ordersError, productsError, usersError]);

  return {
    data: summary,
    isLoading: ordersLoading || productsLoading || usersLoading,
    error: ordersError || productsError || usersError,
  };
}
