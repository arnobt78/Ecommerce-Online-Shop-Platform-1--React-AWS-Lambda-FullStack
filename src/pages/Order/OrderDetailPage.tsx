/**
 * OrderDetailPage Component (REQ-1617)
 *
 * Customer-facing single-order detail page: itemized line-item breakdown
 * (derived from the order's existing cartList snapshot — this store has no
 * separate tax/shipping-cost line, amount_paid is the exact sum of line
 * totals) and a status-change timeline (derived from ActivityLog entries
 * already written by every admin order action — no new schema needed).
 */

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Download, Undo2 } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useOrderDetail } from "../../hooks/useUser";
import { useMyReturns, useCreateReturnRequest } from "../../hooks/useReturns";
import { Card, StatusBadge, ErrorState, OrderTrackingInfo, OrderTimeline, RippleButton, FormTextarea } from "../../components/ui";
import { OrderDetailSkeleton } from "../../components";
import { getProductImageUrl, getProductImageKey } from "../../utils/productImage";
import { formatPrice } from "../../utils/formatPrice";
import { downloadOrderInvoice } from "../../services";
import { toast } from "../../lib/toast";

const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Return requested — awaiting review",
  approved: "Return approved",
  rejected: "Return request rejected",
  refunded: "Return approved — refunded",
};

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

const OrderDetailContent = ({ orderId }: { orderId: string }) => {
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrderDetail(orderId);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // REQ-1663 — customer-initiated return request, only relevant once delivered.
  const { data: myReturns = [] } = useMyReturns();
  const existingReturn = useMemo(() => myReturns.find((r) => r.orderId === orderId), [myReturns, orderId]);
  const createReturnMutation = useCreateReturnRequest();
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState("");

  useTitle(order ? `Order ${order.id.slice(0, 8)}` : "Order Details");

  // REQ-1670: the back button + page title never depend on `order`, so they
  // render on the very first paint — only the data-dependent sections below
  // swap between a shape-matching skeleton and the real content, instead of
  // the whole page (including this static chrome) disappearing behind a
  // single centered spinner while the order fetch is in flight.
  const itemCount = order ? order.cartList?.reduce((sum, item) => sum + (item.quantity || 1), 0) || order.quantity || 0 : 0;

  // REQ-1640: reuses the same PDF the order-confirmation email already
  // attaches — no separate invoice-storage system, generated on demand.
  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    try {
      await downloadOrderInvoice(orderId);
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "Failed to download invoice", {
        closeButton: true,
        position: "bottom-right",
      });
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

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
          {order ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{order.id}</p>
          ) : (
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1.5" />
          )}
        </div>
        {order && (
          <div className="flex items-center gap-3">
            <StatusBadge
              status={order.status || "pending"}
              customLabels={{ pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" }}
            />
            <RippleButton
              onClick={handleDownloadInvoice}
              disabled={isDownloadingInvoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" strokeWidth={2} />
              {isDownloadingInvoice ? "Downloading..." : "Download Invoice"}
            </RippleButton>
          </div>
        )}
      </div>

      {isLoading && <OrderDetailSkeleton />}
      {error && !isLoading && <ErrorState message={error.message || "Order not found"} />}
      {!isLoading && !error && order && (
        <>
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

      {/* REQ-1663 — customer-initiated return request, only offered once delivered */}
      {order.status === "delivered" && (
        <Card className="p-4 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-white">
            <Undo2 className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            Return This Order
          </h2>
          {existingReturn ? (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300">
              {RETURN_STATUS_LABELS[existingReturn.status] || existingReturn.status}
              {existingReturn.adminNote && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Note: {existingReturn.adminNote}</p>}
            </div>
          ) : showReturnForm ? (
            <div className="space-y-3">
              <FormTextarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Tell us why you'd like to return this order (min 10 characters)..."
                rows={4}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    createReturnMutation.mutate(
                      { orderId, reason: returnReason.trim() },
                      { onSuccess: () => setShowReturnForm(false) },
                    )
                  }
                  disabled={createReturnMutation.isPending || returnReason.trim().length < 10}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {createReturnMutation.isPending ? "Submitting..." : "Submit Return Request"}
                </button>
                <button type="button" onClick={() => setShowReturnForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowReturnForm(true)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Request Return
            </button>
          )}
        </Card>
      )}

      {/* Status/refund/tracking timeline (REQ-1617, shared with the admin order detail page — REQ-1646) */}
      <OrderTimeline createdAt={order.createdAt} timeline={order.timeline} />

      {/* Shipping & tracking (reuses the existing component from the Dashboard order card) */}
      <OrderTrackingInfo order={order} />
        </>
      )}
    </main>
  );
};

export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <main><ErrorState message="Order not found" /></main>;
  return <OrderDetailContent orderId={id} />;
};
