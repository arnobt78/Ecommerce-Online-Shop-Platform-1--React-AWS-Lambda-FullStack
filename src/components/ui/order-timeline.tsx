/**
 * OrderTimeline — shared status-change/refund/tracking timeline (REQ-1617,
 * REQ-1646), derived from ActivityLog entries already written by every order
 * action (status update, refund, tracking/label). Used on both the
 * customer-facing order detail page and the admin order detail page so the
 * two never drift out of sync with each other.
 */

import { Package, CheckCircle2, Clock, XCircle, RefreshCcw, Truck, Sparkles } from "lucide-react";
import { Card } from "./card";
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

interface OrderTimelineProps {
  createdAt: string;
  timeline: ActivityLog[];
  className?: string;
}

export function OrderTimeline({ createdAt, timeline, className = "p-4 sm:p-6" }: OrderTimelineProps) {
  return (
    <Card className={className}>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(createdAt)}</p>
          </div>
        </li>
        {timeline.map((entry) => {
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
  );
}
