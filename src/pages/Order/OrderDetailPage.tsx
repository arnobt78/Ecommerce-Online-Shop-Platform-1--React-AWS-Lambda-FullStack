/**
 * OrderDetailPage Component (REQ-1617)
 *
 * Customer-facing single-order detail page: itemized line-item breakdown
 * (derived from the order's existing cartList snapshot — this store has no
 * separate tax/shipping-cost line, amount_paid is the exact sum of line
 * totals) and a status-change timeline (derived from ActivityLog entries
 * already written by every admin order action — no new schema needed).
 */

import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Package, CheckCircle2, Clock, XCircle, RefreshCcw, Truck, Sparkles } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useOrderDetail } from "../../hooks/useUser";
import { Card, StatusBadge, LoadingState, ErrorState, OrderTrackingInfo } from "../../components/ui";
import { getProductImageUrl, getProductImageKey } from "../../utils/productImage";
import { formatPrice } from "../../utils/formatPrice";
import type { ActivityLog, OrderStatus } from "../../types";

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "Date not available";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Date not available";
  }
}

const TIMELINE_ICON: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: RefreshCcw,
};

function timelineLabel(entry: ActivityLog): string {
  const details = entry.details as { newStatus?: string; trackingNumber?: string; refundAmount?: number; labelGenerated?: boolean };
  const status = details.newStatus || "updated";
  if (status === "shipped" && details.trackingNumber) {
    return details.labelGenerated ? "Shipping label generated and order marked shipped" : `Order shipped (tracking: ${details.trackingNumber})`;
  }
  if (status === "refunded" && details.refundAmount) {
    return `Order refunded ($${(details.refundAmount / 100).toFixed(2)})`;
  }
  return `Order marked ${status}`;
}

const OrderDetailContent = ({ orderId }: { orderId: string }) => {
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrderDetail(orderId);

  useTitle(order ? `Order ${order.id.slice(0, 8)}` : "Order Details");

  if (isLoading) return <main><LoadingState message="Loading order details..." /></main>;
  if (error || !order) return <main><ErrorState message={error?.message || "Order not found"} /></main>;

  const itemCount = order.cartList?.reduce((sum, item) => sum + (item.quantity || 1), 0) || order.quantity || 0;

  return (
    <main className="py-8 space-y-6">
      <button
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to Dashboard
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-medium text-gray-700 dark:text-white">Order Details</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{order.id}</p>
        </div>
        <StatusBadge
          status={order.status || "pending"}
          customLabels={{ pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" }}
        />
      </div>

      {/* Summary */}
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Order Date</div>
            <div className="text-sm text-gray-700 dark:text-white flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
              {formatDateTime(order.createdAt)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Items</div>
            <div className="text-sm text-gray-700 dark:text-white">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Payment Status</div>
            <div className="text-sm text-gray-700 dark:text-white capitalize">{order.paymentStatus || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Paid</div>
            <div className="text-lg font-medium text-gray-700 dark:text-white">${formatPrice(order.amount_paid)}</div>
          </div>
        </div>
      </Card>

      {/* Itemized breakdown */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Order Items</h2>
        <div className="space-y-3">
          {order.cartList?.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Link to={`/products/${item.id}`} className="flex-shrink-0">
                <img
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
                  src={getProductImageUrl(item) || "/images/10001.avif"}
                  key={getProductImageKey(item)}
                  alt={item.name}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.id}`} className="text-sm font-medium text-gray-700 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors line-clamp-1">
                  {item.name}
                </Link>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  ${formatPrice(item.price)} &times; {item.quantity || 1}
                </div>
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-white flex-shrink-0">${formatPrice((item.price || 0) * (item.quantity || 1))}</div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-white">Total</span>
            <span className="text-lg font-medium text-gray-700 dark:text-white">${formatPrice(order.amount_paid)}</span>
          </div>
        </div>
      </Card>

      {/* Status timeline (REQ-1617) */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" strokeWidth={2} />
          Order Timeline
        </h2>
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 h-8 w-8 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-sky-600 dark:text-sky-400" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-white">Order placed</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(order.createdAt)}</p>
            </div>
          </li>
          {order.timeline.map((entry) => {
            const details = entry.details as { newStatus?: string };
            const Icon = TIMELINE_ICON[details.newStatus as OrderStatus] || CheckCircle2;
            return (
              <li key={entry.id} className="flex items-start gap-3">
                <span className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-white">{timelineLabel(entry)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(entry.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Shipping & tracking (reuses the existing component from the Dashboard order card) */}
      <OrderTrackingInfo order={order} />
    </main>
  );
};

export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <main><ErrorState message="Order not found" /></main>;
  return <OrderDetailContent orderId={id} />;
};
