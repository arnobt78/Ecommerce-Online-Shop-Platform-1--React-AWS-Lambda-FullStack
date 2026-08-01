/**
 * Order Tracking Info Component
 *
 * Displays shipping tracking information for orders.
 * Shows tracking number, carrier, tracking URL, and label PDF download.
 * Only displays for shipped orders (hides for cancelled/refunded orders).
 */

import { Truck, ExternalLink, Download, MapPin } from "lucide-react";
import type { Order } from "../../types";
import { Card } from "./card";
import { StatusBadge } from "./status-badge";
import { AddressLines } from "./address-lines";

interface OrderTrackingInfoProps {
  order: Order & { trackingUrl?: string | null };
  className?: string;
}

export function OrderTrackingInfo({ order, className = "" }: OrderTrackingInfoProps) {
  // Don't show tracking info for cancelled or refunded orders
  // Check both order.status and paymentStatus (order can be shipped but payment refunded)
  const isInvalidStatus =
    order.status === "cancelled" ||
    order.status === "refunded" ||
    order.paymentStatus === "refunded";

  // Only show tracking info if order is shipped/delivered and has tracking number
  // Hide if order is cancelled/refunded (tracking is no longer valid)
  const hasTrackingInfo =
    (order.status === "shipped" || order.status === "delivered") &&
    order.trackingNumber &&
    !isInvalidStatus;

  // REQ-1620: the saved shipping address is set at checkout time (independent
  // of shipment status), so it's shown whenever present, not gated on tracking.
  const hasAddress = !!order.shippingAddress && !isInvalidStatus;

  if (!hasTrackingInfo && !hasAddress) {
    return null;
  }

  // Generate tracking URL based on carrier if not provided
  const getTrackingUrl = () => {
    if (order.trackingUrl) {
      return order.trackingUrl;
    }

    const trackingNumber = order.trackingNumber;
    const carrier = (order.trackingCarrier || "usps").toLowerCase();

    // Generate carrier-specific tracking URLs
    switch (carrier) {
      case "usps":
        return `https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum=${trackingNumber}`;
      case "ups":
        return `https://www.ups.com/track?tracknum=${trackingNumber}`;
      case "fedex":
        return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
      case "dhl":
        return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
      default:
        return null;
    }
  };

  const trackingUrl = getTrackingUrl();
  const carrier = (order.trackingCarrier || "usps").toUpperCase();

  return (
    <Card className={`mt-4 ${className}`}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-purple-600 dark:text-purple-400" strokeWidth={2} />
          <h4 className="text-sm font-medium text-gray-700 dark:text-white">
            Shipping & Tracking
          </h4>
        </div>

        {hasAddress && order.shippingAddress && (
          <div className="flex items-start gap-2 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <AddressLines address={order.shippingAddress} className="text-sm text-gray-700 dark:text-gray-300" />
          </div>
        )}

        {hasTrackingInfo && (
        <div className="space-y-3">
          {/* Tracking Number */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Tracking Number:
            </span>
            <span className="text-sm font-mono text-gray-700 dark:text-white break-all">
              {order.trackingNumber}
            </span>
          </div>

          {/* Carrier Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Carrier:
            </span>
            <StatusBadge
              status={carrier}
              className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
            />
          </div>

          {/* Tracking URL Link */}
          {trackingUrl && (
            <div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                <span>Track Package</span>
              </a>
            </div>
          )}

          {/* Label PDF Download (only if available) */}
          {order.labelUrl && (
            <div>
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2} />
                <span>Download Label PDF</span>
              </a>
            </div>
          )}
        </div>
        )}
      </div>
    </Card>
  );
}
