# Admin Panel Documentation

## Overview

Admin panel for CodeBook e-commerce platform. Provides dashboard overview with key metrics, order management, and system administration.

## Features

- **Dashboard Overview**: Key metrics (orders, revenue, products, users)
- **Recent Orders**: Latest 5 orders with details
- **Order Status Distribution**: Breakdown by status
- **Role-Based Access**: Admin-only routes with authentication

## Components

### Layout Components
- `AdminLayout`: Main wrapper with sidebar and header
- `AdminSidebar`: Collapsible navigation sidebar
- `AdminHeader`: Top header with user info and logout

### Dashboard Components
- `AdminDashboardPage`: Main dashboard overview page
- `AdminMetricsCard`: Reusable metric display card
- `AdminRecentOrders`: Recent orders table
- `AdminStatsSkeleton`: Loading skeleton

## Hooks

- `useAdminStats()`: Fetches dashboard statistics
- `useAllOrders()`: Fetches all orders (admin only)
- `useAllProducts()`: Fetches all products (admin view)

## Services

- `getAdminStats()`: Calculates dashboard metrics from orders/products
- `getAllOrders()`: Fetches all orders (requires admin role)
- `getAllProducts()`: Fetches all products (admin view)

## Routes

- `/admin` - Dashboard overview (admin only)

## Access Control

Admin routes are protected by `ProtectedRoute` with `requiredRole="admin"`. Users without admin role are redirected to `/products`.

## Data Fetching

Uses React Query (TanStack Query) for:
- Automatic caching and deduplication
- Background refetching
- Loading and error states
- Optimistic updates

## Notes

- Admin service currently uses existing Lambda endpoints
- Future: Add dedicated admin endpoints for better performance
- All admin operations require valid JWT token with admin role

