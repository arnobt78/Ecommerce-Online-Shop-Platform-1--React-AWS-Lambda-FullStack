import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import {
  HomePage,
  ProductsList,
  ProductDetail,
  Login,
  Register,
  AuthCallback,
  CartPage,
  OrderPage,
  OrderDetailPage,
  DashboardPage,
  PaymentSuccessPage,
  PaymentCancelPage,
  CreateTicketPage,
  TicketsListPage,
  TicketDetailPage,
  PageNotFound,
} from "../pages";
import { LoadingState } from "../components/ui/loading-state";
import { ProtectedRoute } from "./ProtectedRoute";

// Code-split: the entire admin console (charts, tables, forms — ~330KB gzipped)
// loads as one lazy chunk only when an admin actually navigates to /admin/*,
// instead of shipping in every customer's initial bundle. Every admin route is
// already gated behind ProtectedRoute's role check, so the brief chunk-fetch
// (typically already warm from the browser cache after the first /admin visit)
// never affects the customer-facing "instant nav" path.
const AdminDashboardPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminProductsPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminProductsPage }))
);
const AdminProductCreatePage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminProductCreatePage }))
);
const AdminProductEditPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminProductEditPage }))
);
const AdminProductDetailPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminProductDetailPage }))
);
const AdminOrdersPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminOrdersPage }))
);
const AdminOrderDetailPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminOrderDetailPage }))
);
const AdminUsersPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminUsersPage }))
);
const AdminUserDetailPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminUserDetailPage }))
);
const AdminUserEditPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminUserEditPage }))
);
const AdminAnalyticsPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminAnalyticsPage }))
);
const AdminHistoryPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminHistoryPage }))
);
const AdminTicketsPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminTicketsPage }))
);
const AdminReviewsPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminReviewsPage }))
);
const AdminReviewDetailPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminReviewDetailPage }))
);
const AdminSettingsPage = lazy(() =>
  import("../pages/Admin").then((m) => ({ default: m.AdminSettingsPage }))
);

// recharts/d3 (~370KB) is only used by these 4 chart components, themselves
// only rendered on the Analytics page — lazy() defined here (same nesting
// depth as the Admin page defs above) rather than inside AdminAnalyticsPage
// itself. Defining a lazy() boundary *inside* an already-lazy-loaded module
// nests two dynamic-import levels deep, which this bundler hoists into the
// always-loaded main chunk instead of deferring — a single level, defined at
// the router's top level and passed down as props, stays genuinely deferred.
const RevenueChart = lazy(() =>
  import("../components/ui/analytics-charts").then((m) => ({ default: m.RevenueChart }))
);
const SalesTrendChart = lazy(() =>
  import("../components/ui/analytics-charts").then((m) => ({ default: m.SalesTrendChart }))
);
const TopProductsChart = lazy(() =>
  import("../components/ui/analytics-charts").then((m) => ({ default: m.TopProductsChart }))
);
const UserAnalyticsChart = lazy(() =>
  import("../components/ui/analytics-charts").then((m) => ({ default: m.UserAnalyticsChart }))
);

export const AllRoutes = () => {
  return (
    <>
      <Suspense fallback={<LoadingState message="Loading admin console..." className="min-h-[60vh]" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="products" element={<ProductsList />} />
        <Route path="products/:id" element={<ProductDetail />} />

        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="auth/callback" element={<AuthCallback />} />

        <Route
          path="cart"
          element={
            <ProtectedRoute>
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="order-summary"
          element={
            <ProtectedRoute>
              <OrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment-success"
          element={
            <ProtectedRoute>
              <PaymentSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment-cancel"
          element={
            <ProtectedRoute>
              <PaymentCancelPage />
            </ProtectedRoute>
          }
        />

        {/* Support Tickets Routes */}
        <Route
          path="tickets"
          element={
            <ProtectedRoute>
              <TicketsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tickets/create"
          element={
            <ProtectedRoute>
              <CreateTicketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tickets/:ticketId"
          element={
            <ProtectedRoute>
              <TicketDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes - Require admin role */}
        <Route
          path="admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/products"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/products/new"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProductCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/products/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProductDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/products/:id/edit"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminProductEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/orders"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/orders/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminOrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUserDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users/:id/edit"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUserEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/business-insights"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAnalyticsPage
                RevenueChart={RevenueChart}
                SalesTrendChart={SalesTrendChart}
                TopProductsChart={TopProductsChart}
                UserAnalyticsChart={UserAnalyticsChart}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/management-history"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/tickets"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminTicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/tickets/:ticketId"
          element={
            <ProtectedRoute requiredRole="admin">
              <TicketDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reviews"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reviews/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminReviewDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
    </>
  );
};
