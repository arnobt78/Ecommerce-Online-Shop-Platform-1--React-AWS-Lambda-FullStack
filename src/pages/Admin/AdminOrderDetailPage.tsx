/**
 * AdminOrderDetailPage Component
 *
 * Order detail page for admin panel.
 * Displays full order details and allows status update.
 * Uses React Query for efficient data fetching and caching.
 *
 * Features:
 * - Full order details view
 * - Order items list
 * - Status update functionality
 * - Customer information
 * - Real-time updates with cache invalidation
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import { toast } from "../../lib/toast";
import { useTitle } from "../../hooks/useTitle";
import { useOrder, useUpdateOrderStatus, useAllUsers, useRefundOrder, useGenerateShippingLabel, useAddTrackingNumber } from "../../hooks/useAdmin";
import { AdminLayout, useAdminLayout } from "../../components/Layouts/Admin";
import { getProductImageUrl, getProductImageKey } from "../../utils/productImage";
import { formatPrice } from "../../utils/formatPrice";
import { formatDateLong } from "../../utils/formatDate";
import { downloadOrderInvoice } from "../../services";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  Card,
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  FormInput,
  FormSelect,
  FormLabel,
  FormTextarea,
  AddressLines,
  RippleButton,
  OrderTimeline,
} from "../../components/ui";
import type { OrderStatus, OrderWithTimeline, User } from "../../types";

// Inner component that uses the AdminLayout context
const AdminOrderDetailContent = () => {
  const { toggleSidebar } = useAdminLayout();
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: users } = useAllUsers(); // Fetch all users to enrich order data
  const updateStatusMutation = useUpdateOrderStatus();
  const refundMutation = useRefundOrder();
  const generateLabelMutation = useGenerateShippingLabel();
  const addTrackingMutation = useAddTrackingNumber();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [manualTrackingNumber, setManualTrackingNumber] = useState("");
  const [manualTrackingCarrier, setManualTrackingCarrier] = useState("usps");

  // Create a user lookup map by userId for enriching order data
  const userLookup = useMemo(() => {
    if (!users) return {} as Record<string, User>;
    const lookup: Record<string, User> = {};
    users.forEach((user) => {
      lookup[user.id] = user;
    });
    return lookup;
  }, [users]);

  // Enrich order with user data from users table (if order is missing name)
  const enrichedOrder = useMemo<OrderWithTimeline | null>(() => {
    if (!order) return null;

    // If order doesn't have user name but we have user data in lookup, enrich it
    const userFromLookup = userLookup[order.userId || order.user?.id || ""];
    if (userFromLookup && (!order.user?.name || order.user?.name === "" || order.user?.name === "N/A")) {
      return {
        ...order,
        user: {
          ...order.user,
          name: userFromLookup.name || order.user?.name || "",
          email: order.user?.email || userFromLookup.email || "",
          id: order.userId || order.user?.id || userFromLookup.id,
        },
      };
    }
    return order;
  }, [order, userLookup]);

  // Show error toast if API call fails
  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to load order details", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  }, [error]);

  // Handle status update (memoized to prevent unnecessary re-renders)
  // "cancelled" restores stock and emails the customer, so it's confirmed first
  // (same treatment as the refund action below) instead of firing on select.
  const handleStatusUpdate = useCallback(
    async (newStatus: OrderStatus) => {
      if (newStatus === "cancelled") {
        setCancelDialogOpen(true);
        return;
      }
      try {
        await updateStatusMutation.mutateAsync({ orderId: orderId as string, status: newStatus });
      } catch (error) {
        // Error toast is handled by the mutation hook
        console.error("Status update error:", error);
      }
    },
    [orderId, updateStatusMutation],
  );

  const handleCancelConfirm = useCallback(async () => {
    try {
      // REQ-1639: if the order was already paid, the backend automatically
      // refunds it via the same Stripe flow as the explicit Refund action
      // (see orders.routes.ts's isCancellingPaidOrder branch) instead of
      // leaving a "cancelled" order that silently kept the customer's money.
      await updateStatusMutation.mutateAsync({ orderId: orderId as string, status: "cancelled", reason: cancelReason.trim() || undefined });
      setCancelDialogOpen(false);
      setCancelReason("");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Cancel order error:", error);
    }
  }, [orderId, cancelReason, updateStatusMutation]);

  // Handle refund (memoized to prevent unnecessary re-renders)
  const handleRefund = useCallback(async () => {
    try {
      await refundMutation.mutateAsync({ orderId: orderId as string, refundData: { reason: refundReason.trim() || undefined } }); // Full refund by default
      setRefundDialogOpen(false);
      setRefundReason("");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Refund error:", error);
    }
  }, [orderId, refundReason, refundMutation]);

  // REQ-1640: reuses the same PDF the order-confirmation email already
  // attaches — no separate invoice-storage system, generated on demand.
  const handleDownloadInvoice = useCallback(async () => {
    if (!orderId) return;
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
  }, [orderId]);

  // Handle generate shipping label (memoized to prevent unnecessary re-renders)
  const handleGenerateLabel = useCallback(async () => {
    try {
      await generateLabelMutation.mutateAsync({ orderId: orderId as string, options: {} });
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Generate label error:", error);
    }
  }, [orderId, generateLabelMutation]);

  // Handle add manual tracking (memoized to prevent unnecessary re-renders)
  const handleAddTracking = useCallback(async () => {
    if (!manualTrackingNumber.trim()) {
      toast.error("Please enter a tracking number", {
        closeButton: true,
        position: "bottom-right",
      });
      return;
    }

    try {
      await addTrackingMutation.mutateAsync({
        orderId: orderId as string,
        trackingNumber: manualTrackingNumber.trim(),
        trackingCarrier: manualTrackingCarrier,
        status: "shipped",
      });
      // Clear form on success
      setManualTrackingNumber("");
      setManualTrackingCarrier("usps");
    } catch (error) {
      // Error toast is handled by the mutation hook
      console.error("Add tracking error:", error);
    }
  }, [orderId, manualTrackingNumber, manualTrackingCarrier, addTrackingMutation]);

  // Check if order can be refunded
  const canRefund = useMemo(() => {
    if (!enrichedOrder) return false;
    // Can refund if: order is paid, not already refunded, and has paymentIntentId
    return enrichedOrder.paymentStatus === "paid" && enrichedOrder.status !== "refunded" && !!enrichedOrder.paymentIntentId;
  }, [enrichedOrder]);

  // Available status options. "Refunded" is intentionally not selectable here
  // — it's not a backend-recognized manual status (VALID_ORDER_STATUSES) and
  // refunding always goes through either the dedicated Refund Management
  // action below or cancelling a paid order (both hit the real Stripe flow).
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <PageHeader
        title="Order Details"
        description="View and manage order information"
        onToggleSidebar={toggleSidebar}
        showBackButton={true}
        onBack={() => navigate("/admin/orders")}
        actions={
          enrichedOrder && (
            <RippleButton
              onClick={handleDownloadInvoice}
              disabled={isDownloadingInvoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" strokeWidth={2} />
              {isDownloadingInvoice ? "Downloading..." : "Download Invoice"}
            </RippleButton>
          )
        }
      />

      {/* Loading State */}
      {isLoading && <LoadingState message="Loading order details..." />}

      {/* Error State */}
      {error && !isLoading && <ErrorState message={error.message || "Failed to load order details"} />}

      {/* Order Details */}
      {!isLoading && !error && enrichedOrder && (
        <div className="space-y-6">
          {/* Order Summary Card */}
          <Card className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Information */}
              <div>
                <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Order Information</h2>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Order ID</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{enrichedOrder.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{formatDateLong(enrichedOrder.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-1">
                      {/* "refunded" is a terminal state reached only via the real Stripe
                          refund flow (Refund action or cancelling a paid order) — shown as a
                          plain badge, not the editable select, since it isn't one of
                          statusOptions and there's no valid manual next transition from it. */}
                      {enrichedOrder.status === "refunded" ? (
                        <StatusBadge status="refunded" className="px-3 py-1.5" />
                      ) : (
                        <StatusBadge
                          status={enrichedOrder.status || "pending"}
                          asSelect={true}
                          onChange={(value) => handleStatusUpdate(value as OrderStatus)}
                          options={statusOptions}
                          disabled={updateStatusMutation.isPending}
                          className="px-3 py-1.5"
                        />
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Customer Information */}
              <div>
                <h2 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Customer Information</h2>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{enrichedOrder.user?.name || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{enrichedOrder.user?.email || "N/A"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</dt>
                    <dd className="text-sm text-gray-700 dark:text-white">{enrichedOrder.userId || enrichedOrder.user?.id || "N/A"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>

          {/* Order Items Card */}
          <Card
            header={`Order Items (${enrichedOrder.cartList?.reduce((sum, item) => sum + (item.quantity || 1), 0) || enrichedOrder.cartList?.length || 0})`}
            className="p-4 sm:p-6"
          >
            {enrichedOrder.cartList && enrichedOrder.cartList.length > 0 ? (
              <div className="space-y-4">
                {enrichedOrder.cartList.map((item, index) => (
                  <div key={item.id || index} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {/* Product Image */}
                    {getProductImageUrl(item) && (
                      <div className="flex-shrink-0">
                        <img
                          key={getProductImageKey(item)}
                          src={getProductImageUrl(item) || undefined}
                          alt={item.name || "Product"}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 dark:text-white">{item.name || "N/A"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Quantity: {item.quantity || 1}</div>
                      {item.overview && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.overview}</div>}
                    </div>
                    {/* Product Price */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-gray-600 dark:text-gray-400">${formatPrice(item.price)} each</div>
                      <div className="text-sm font-medium text-gray-700 dark:text-white">${formatPrice((item.price || 0) * (item.quantity || 1))}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No items in this order</p>
            )}
          </Card>

          {/* Order Summary Card */}
          <Card header="Order Summary" className="p-4 sm:p-6">
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Items</dt>
                <dd className="text-sm text-gray-700 dark:text-white">
                  {enrichedOrder.cartList?.reduce((sum, item) => sum + (item.quantity || 1), 0) || enrichedOrder.quantity || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Products</dt>
                <dd className="text-sm text-gray-700 dark:text-white">{enrichedOrder.cartList?.length || 0}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <dt className="text-base font-medium text-gray-700 dark:text-white">Total Amount</dt>
                <dd className="text-base font-medium text-gray-700 dark:text-white">${formatPrice(enrichedOrder.amount_paid)}</dd>
              </div>
              {/* Payment Information */}
              {enrichedOrder.paymentIntentId && (
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Intent ID</dt>
                  <dd className="text-sm text-gray-700 dark:text-white font-mono">{enrichedOrder.paymentIntentId}</dd>
                </div>
              )}
              {enrichedOrder.paymentStatus && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={enrichedOrder.paymentStatus} />
                  </dd>
                </div>
              )}
              {enrichedOrder.refundId && (
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Refund ID</dt>
                  <dd className="text-sm text-gray-700 dark:text-white font-mono">{enrichedOrder.refundId}</dd>
                </div>
              )}
              {enrichedOrder.refundAmount && (
                <div className="flex justify-between">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Refund Amount</dt>
                  <dd className="text-sm text-gray-700 dark:text-white">${formatPrice(enrichedOrder.refundAmount / 100)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Status/refund/tracking timeline (REQ-1646) — shared with the customer
              order detail page, previously admins had no timeline visibility at all */}
          {enrichedOrder.timeline && <OrderTimeline createdAt={enrichedOrder.createdAt} timeline={enrichedOrder.timeline} />}

          {/* Shipping & Tracking Card */}
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Shipping & Tracking</h3>

            {/* Customer-selected saved address, if any — REQ-1620. Same address the
                Shippo label generation below will use as the recipient. */}
            {enrichedOrder.shippingAddress && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Shipping Address</p>
                <AddressLines address={enrichedOrder.shippingAddress} className="text-sm text-gray-700 dark:text-gray-300" />
              </div>
            )}

            {/* Display existing tracking information */}
            {enrichedOrder.trackingNumber && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-white">Tracking Number: {enrichedOrder.trackingNumber}</p>
                    {enrichedOrder.trackingCarrier && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Carrier: {enrichedOrder.trackingCarrier.toUpperCase()}</p>}
                    {enrichedOrder.labelUrl && (
                      <a href={enrichedOrder.labelUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-1 inline-block">
                        Download Label PDF
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Generate Label Button (Shippo API) */}
            {!enrichedOrder.trackingNumber && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleGenerateLabel}
                  disabled={generateLabelMutation.isPending || updateStatusMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generateLabelMutation.isPending ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Generating Label...</span>
                    </>
                  ) : (
                    <>
                      <span>📦</span>
                      <span>Generate Shipping Label (Shippo)</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Automatically generate shipping label via Shippo API. Order status will be updated to "shipped".</p>
              </div>
            )}

            {/* Manual Tracking Entry (Fallback) */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-white mb-3">Or Enter Tracking Manually</h4>
              <div className="space-y-3">
                <div>
                  <FormLabel htmlFor="trackingNumber">Tracking Number</FormLabel>
                  <FormInput
                    id="trackingNumber"
                    type="text"
                    value={manualTrackingNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    disabled={addTrackingMutation.isPending || !!enrichedOrder.trackingNumber}
                  />
                </div>
                <div>
                  <FormLabel htmlFor="trackingCarrier">Carrier</FormLabel>
                  <FormSelect
                    id="trackingCarrier"
                    value={manualTrackingCarrier}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setManualTrackingCarrier(e.target.value)}
                    disabled={addTrackingMutation.isPending || !!enrichedOrder.trackingNumber}
                    options={[
                      { value: "usps", label: "USPS" },
                      { value: "ups", label: "UPS" },
                      { value: "fedex", label: "FedEx" },
                      { value: "dhl", label: "DHL" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTracking}
                  disabled={addTrackingMutation.isPending || !manualTrackingNumber.trim() || !!enrichedOrder.trackingNumber || updateStatusMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-600 dark:bg-gray-500 hover:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {addTrackingMutation.isPending ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <span>✏️</span>
                      <span>Add Tracking Number</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Manually enter tracking number. Order status will be updated to "shipped".</p>
              </div>
            </div>
          </Card>

          {/* Refund Action Card */}
          {canRefund && (
            <Card className="p-4 sm:p-6">
              <h3 className="text-lg font-medium text-gray-700 dark:text-white mb-4">Refund Management</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Process a refund for this order. The full amount will be refunded to the customer's original payment method.
              </p>
              <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <AlertDialogTrigger>
                  <button
                    type="button"
                    disabled={refundMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refundMutation.isPending ? "Processing Refund..." : "Process Refund"}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Refund</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to process a refund for this order? The amount of <span className="font-medium">${formatPrice(enrichedOrder.amount_paid)}</span> will be refunded to
                      the customer's original payment method. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-6 pb-2">
                    <FormLabel htmlFor="refund-reason">Reason (optional, internal note)</FormLabel>
                    <FormTextarea
                      id="refund-reason"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="e.g. Customer requested cancellation due to shipping delay"
                      rows={2}
                      disabled={refundMutation.isPending}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={refundMutation.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRefund} disabled={refundMutation.isPending} className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
                      {refundMutation.isPending ? "Processing..." : "Confirm Refund"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          )}

          {/* Cancel Order Confirmation — opened by the status select above, not a trigger button */}
          <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel This Order?</AlertDialogTitle>
                <AlertDialogDescription>
                  This restores stock for every item in the order and emails the customer a cancellation notice.
                  {canRefund && (
                    <>
                      {" "}
                      Since this order was already paid, <span className="font-medium">${formatPrice(enrichedOrder.amount_paid)}</span> will also be automatically refunded to the customer's
                      original payment method.
                    </>
                  )}{" "}
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-6 pb-2">
                <FormLabel htmlFor="cancel-reason">Reason (optional, internal note)</FormLabel>
                <FormTextarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer requested cancellation"
                  rows={2}
                  disabled={updateStatusMutation.isPending}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={updateStatusMutation.isPending}>Keep Order</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelConfirm} disabled={updateStatusMutation.isPending} className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600">
                  {updateStatusMutation.isPending ? "Cancelling..." : "Cancel Order"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};

export const AdminOrderDetailPage = () => {
  useTitle("Admin Order Details");
  const navigate = useNavigate();

  // Check if user is admin before rendering
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
      <AdminOrderDetailContent />
    </AdminLayout>
  );
};
