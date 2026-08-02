/**
 * Guest Order Lookup Page (REQ-1659)
 *
 * No-account order status lookup for guest checkouts — order id + the exact
 * email used at checkout. Public route, no auth.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { Search, Package, Download } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useGuestOrder } from "../../hooks/useGuestOrder";
import { useCreateGuestReturnRequest } from "../../hooks/useReturns";
import { formatPrice } from "../../utils/formatPrice";
import { Card, PageHeader, StatusBadge, LoadingState, ErrorState, OrderTimeline, RippleButton } from "../../components/ui";
import { ReturnRequestSection } from "../../components";
import { downloadGuestOrderInvoice } from "../../services";
import { toast } from "../../lib/toast";

export const GuestOrderLookupPage = () => {
  useTitle("Track Your Order");
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const { data: order, isLoading, error } = useGuestOrder(orderId.trim(), email.trim(), submitted);
  const createGuestReturnMutation = useCreateGuestReturnRequest();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) return;
    setSubmitted(true);
  };

  // REQ-1673: same on-demand invoice re-download as OrderDetailPage, verified
  // against order.guestEmail (not the live input) for the same reason as the
  // return-request submission below.
  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      await downloadGuestOrderInvoice(order.id, order.guestEmail || email.trim());
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
    <div className="py-8 max-w-2xl mx-auto">
      <PageHeader title="Track Your Order" description="Look up a guest checkout order by its ID and the email you used" />

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="orderId" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Order ID
            </label>
            <input
              id="orderId"
              type="text"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setSubmitted(false);
              }}
              placeholder="e.g. from your confirmation email"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email used at checkout
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSubmitted(false);
              }}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Search className="h-4 w-4" strokeWidth={2} />
            Track Order
          </button>
        </form>
      </Card>

      {submitted && isLoading && (
        <Card className="mt-6 p-6">
          <LoadingState message="Looking up your order..." />
        </Card>
      )}

      {submitted && error && !isLoading && (
        <Card className="mt-6 p-6">
          <ErrorState message={error.message || "Order not found. Double-check the order ID and email."} />
        </Card>
      )}

      {order && !isLoading && (
        <>
          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-white">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                Order #{order.id.slice(0, 8)}
              </h2>
              <div className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <RippleButton
                  onClick={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" strokeWidth={2} />
                  {isDownloadingInvoice ? "Downloading..." : "Invoice"}
                </RippleButton>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {order.cartList?.map((item, i) => (
                <div key={item.id || i} className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>
                    {item.name || "Product"} × {item.quantity || 1}
                  </span>
                  <span>{formatPrice((item.price || 0) * (item.quantity || 1))}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 font-medium text-gray-700 dark:text-white">
                <span>Total</span>
                <span>{formatPrice(order.amount_paid)}</span>
              </div>
            </div>
            {order.trackingNumber && (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Tracking: <span className="font-mono">{order.trackingNumber}</span> ({order.trackingCarrier})
              </p>
            )}
          </Card>

          {/* REQ-1671 — guest-checkout counterpart of OrderDetailPage's return request.
              Verifies against order.guestEmail (the value the lookup itself already
              confirmed), not the live `email` input — editing that field after a
              successful lookup (without re-submitting) must not silently break the
              return request with a stale/edited email. */}
          <div className="mt-6">
            <ReturnRequestSection
              orderStatus={order.status || "pending"}
              existingReturn={order.returnRequest}
              onSubmit={(reason) => createGuestReturnMutation.mutate({ orderId: order.id, reason, email: order.guestEmail || email.trim() })}
              isSubmitting={createGuestReturnMutation.isPending}
            />
          </div>

          <div className="mt-6">
            <OrderTimeline createdAt={order.createdAt} timeline={order.timeline} />
          </div>
        </>
      )}
    </div>
  );
};
