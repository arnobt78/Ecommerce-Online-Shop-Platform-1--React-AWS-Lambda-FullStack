/**
 * Guest Order Lookup Page (REQ-1659)
 *
 * No-account order status lookup for guest checkouts — order id + the exact
 * email used at checkout. Public route, no auth.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { Search, Package } from "lucide-react";
import { useTitle } from "../../hooks/useTitle";
import { useGuestOrder } from "../../hooks/useGuestOrder";
import { formatPrice } from "../../utils/formatPrice";
import { Card, PageHeader, StatusBadge, LoadingState, ErrorState, OrderTimeline } from "../../components/ui";

export const GuestOrderLookupPage = () => {
  useTitle("Track Your Order");
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: order, isLoading, error } = useGuestOrder(orderId.trim(), email.trim(), submitted);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) return;
    setSubmitted(true);
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
              <StatusBadge status={order.status} />
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

          <div className="mt-6">
            <OrderTimeline createdAt={order.createdAt} timeline={order.timeline} />
          </div>
        </>
      )}
    </div>
  );
};
