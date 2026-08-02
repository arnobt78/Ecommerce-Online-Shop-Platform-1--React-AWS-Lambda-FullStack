// Parent: REQ-1661 — the actual work run by the cron schedule in
// lib/scheduler.ts. Both jobs reuse already-built features (REQ-1654's
// digest logic, REQ-1613's AI insights chain) rather than duplicating them —
// this file is just "the same thing, on a timer" instead of admin-click-only.

import { prisma } from "../lib/prisma";
import { getStockDigestBreakdown } from "./products.service";
import { sendTemplatedEmail } from "./email.service";
import { getBusinessInsights, AiInsightsUnavailableError } from "./aiInsights.service";

// Matches the frontend's ADMIN_ALERT_EMAIL constant and the fixed inbox
// every other admin-* alert email already goes to (see email.routes.ts).
const ADMIN_ALERT_EMAIL = "arnobt78@gmail.com";

// Parent: REQ-1654/1661 — identical computation to the admin-triggered
// route (email.routes.ts POST /admin/notifications/low-stock-digest), just
// invoked on a timer instead of a button click. Skips sending entirely when
// there's nothing to report, unlike the manual button (which always
// confirms success even at zero — a scheduled run shouldn't email an
// all-clear every single day).
export async function runLowStockDigestJob(): Promise<{ sent: boolean; lowStockCount: number; outOfStockCount: number }> {
  const { lowStockProducts, outOfStockProducts } = await getStockDigestBreakdown();

  if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
    return { sent: false, lowStockCount: 0, outOfStockCount: 0 };
  }

  await sendTemplatedEmail(ADMIN_ALERT_EMAIL, "admin-low-stock-digest", { lowStockProducts, outOfStockProducts });
  return { sent: true, lowStockCount: lowStockProducts.length, outOfStockCount: outOfStockProducts.length };
}

// Parent: REQ-1661 — a lean, server-side-computed equivalent of
// analyticsService.ts's buildAiInsightsSummary(). The interactive dashboard
// deliberately computes its own richer summary client-side (from data
// already in the TanStack Query cache) to avoid extra backend load on every
// page view; a once-a-week cron job has no such per-view cost concern, so a
// direct Prisma read here is the simpler, correct choice rather than
// duplicating the frontend's full client-side aggregation logic in TS on
// the backend too.
export async function runWeeklySalesSummaryJob(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [orders, productCount, newUsers] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: since } } }),
    prisma.product.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
  ]);

  const paidOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amount_paid, 0);

  const salesByProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of paidOrders) {
    const items = Array.isArray(order.cartList) ? (order.cartList as Array<{ id?: string; name?: string; productName?: string; quantity?: number; price?: number }>) : [];
    for (const item of items) {
      if (!item.id) continue;
      const existing = salesByProduct.get(item.id) || { name: item.name || item.productName || "Product", quantity: 0, revenue: 0 };
      existing.quantity += item.quantity || 1;
      existing.revenue += (item.price || 0) * (item.quantity || 1);
      salesByProduct.set(item.id, existing);
    }
  }
  const topProducts = [...salesByProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const summary = [
    `Weekly revenue: $${totalRevenue.toFixed(2)} across ${paidOrders.length} orders (last 7 days).`,
    `Catalog size: ${productCount} products.`,
    topProducts.length > 0
      ? `Top sellers this week: ${topProducts.map((p) => `${p.name} (${p.quantity} sold, $${p.revenue.toFixed(2)})`).join("; ")}.`
      : "No sales recorded this week.",
    `New users this week: ${newUsers}.`,
  ].join(" ");

  try {
    const insights = await getBusinessInsights(summary);
    await sendTemplatedEmail(ADMIN_ALERT_EMAIL, "admin-weekly-summary", { summary, insights: insights.insights });
  } catch (error) {
    // LLM not configured or rate-limited: still send the raw numbers rather
    // than silently dropping the whole weekly email over an optional narrative.
    if (error instanceof AiInsightsUnavailableError) {
      await sendTemplatedEmail(ADMIN_ALERT_EMAIL, "admin-weekly-summary", { summary, insights: [] });
      return;
    }
    throw error;
  }
}
