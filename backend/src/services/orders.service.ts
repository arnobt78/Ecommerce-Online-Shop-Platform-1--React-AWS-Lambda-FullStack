// Parent: REQ-1202, REQ-1205, REQ-1301, REQ-1304
// Ported from aws-lambda/shared/orders.js — same function contracts, stock
// decrement/rollback logic, and status transitions, Prisma instead of DynamoDB.

import { z } from "zod";
import Stripe from "stripe";
import { Prisma, type Order } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { decrementProductStock, incrementProductStock } from "./products.service";
import { incrementCouponUsage } from "./coupons.service";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const cartItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
});

// Parent: REQ-1620 — a snapshot of the customer's selected saved Address,
// captured at checkout time (see addresses.service.ts for the source shape).
const shippingAddressSchema = z.object({
  label: z.string().nullable().optional(),
  fullName: z.string(),
  street1: z.string(),
  street2: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string(),
  phone: z.string().nullable().optional(),
});

// Parent: REQ-1304 — validated at the /orders POST route boundary.
export const createOrderSchema = z.object({
  cartList: z.array(cartItemSchema).min(1, "Cart list is required and must not be empty"),
  amount_paid: z.coerce.number(),
  quantity: z.coerce.number(),
  user: z.object({ id: z.string(), name: z.string().optional(), email: z.string().optional() }),
  status: z.string().optional(),
  paymentIntentId: z.string().optional(),
  paymentStatus: z.string().optional(),
  shippingAddress: shippingAddressSchema.optional(),
  // REQ-1658: snapshot only — the route reads these from the verified Stripe
  // PaymentIntent metadata, never trusts them as-is from the request body.
  couponCode: z.string().optional(),
  discountAmount: z.coerce.number().optional(),
  // REQ-1659: also route-derived (never client-trusted) — see orders.routes.ts.
  isGuest: z.boolean().optional(),
  guestEmail: z.string().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export interface StockUpdateResultEntry {
  productId: string;
  productName: string;
  quantity: number;
  newStock?: number | null;
  success: boolean;
  error?: string;
  shouldTriggerLowStockAlert?: boolean;
  lowStockThreshold?: number;
}

export interface OrderWithStockMeta extends Order {
  _stockUpdates?: StockUpdateResultEntry[];
  _lowStockAlerts?: Array<{
    productId: string;
    productName: string;
    currentStock: number | null | undefined;
    lowStockThreshold: number | undefined;
  }>;
  _stockRestores?: StockUpdateResultEntry[];
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  return prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getAllOrders(): Promise<Order[]> {
  return prisma.order.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  return prisma.order.findUnique({ where: { id: orderId } });
}

// Parent: REQ-1660 — the Shippo tracking webhook only carries a tracking
// number, not our own order id, so lookup goes the other direction.
export async function getOrderByTrackingNumber(trackingNumber: string): Promise<Order | null> {
  return prisma.order.findFirst({ where: { trackingNumber } });
}

export async function createOrder(orderData: CreateOrderInput): Promise<OrderWithStockMeta> {
  const { cartList, amount_paid, quantity, user } = orderData;

  if (!cartList || !Array.isArray(cartList) || cartList.length === 0) {
    throw new Error("Cart list is required and must not be empty");
  }
  if (!user || !user.id) {
    throw new Error("User information is required");
  }

  // REQ-1641: idempotency — a double-click or a retried request after a
  // network blip must never create two orders (and double-decrement stock)
  // for the same Stripe payment. Checked first, before touching stock at all.
  if (orderData.paymentIntentId) {
    const existingOrder = await prisma.order.findUnique({ where: { paymentIntentId: orderData.paymentIntentId } });
    if (existingOrder) return existingOrder;
  }

  // Decrement stock for each cart item before creating the order (reserves stock).
  // Rolls back any successful decrements if a later item fails or order creation fails,
  // mirroring the AWS Lambda backend's compensating-transaction behavior.
  const stockUpdateResults: StockUpdateResultEntry[] = [];
  const stockUpdatesToRollback: Array<{ productId: string; quantity: number }> = [];

  for (const item of cartList) {
    if (!item.id || !item.quantity) continue;
    try {
      const updatedProduct = await decrementProductStock(item.id, item.quantity);
      stockUpdateResults.push({
        productId: item.id,
        productName: item.name || item.productName || "Product",
        quantity: item.quantity,
        newStock: updatedProduct.stock,
        success: true,
        shouldTriggerLowStockAlert: updatedProduct._shouldTriggerLowStockAlert || false,
        lowStockThreshold: updatedProduct._lowStockThreshold,
      });
      stockUpdatesToRollback.push({ productId: item.id, quantity: item.quantity });
    } catch (stockError) {
      const message = stockError instanceof Error ? stockError.message : String(stockError);
      stockUpdateResults.push({
        productId: item.id,
        productName: item.name || item.productName || "Product",
        quantity: item.quantity,
        success: false,
        error: message,
      });
      if (message.includes("Insufficient stock") || message.includes("ConditionalCheckFailedException")) {
        for (const rollback of stockUpdatesToRollback) {
          await incrementProductStock(rollback.productId, rollback.quantity).catch(() => {});
        }
        throw stockError;
      }
    }
  }

  let order: Order;
  try {
    order = await prisma.order.create({
      data: {
        userId: user.id,
        user: { id: user.id, name: user.name || "", email: user.email || "" },
        cartList,
        amount_paid: Number(amount_paid) || 0,
        quantity: Number(quantity) || 0,
        status: orderData.status || "pending",
        ...(orderData.paymentIntentId && { paymentIntentId: orderData.paymentIntentId }),
        ...(orderData.paymentStatus && { paymentStatus: orderData.paymentStatus }),
        ...(orderData.shippingAddress && { shippingAddress: orderData.shippingAddress }),
        ...(orderData.couponCode && { couponCode: orderData.couponCode, discountAmount: orderData.discountAmount }),
        ...(orderData.isGuest && { isGuest: true, guestEmail: orderData.guestEmail }),
      },
    });

    // REQ-1658: increment usage only on an actual new-row insert (this line),
    // never on the idempotency pre-check or P2002 race-fallback return paths
    // above/below — an abandoned or duplicate request must never consume a
    // limited-use coupon's redemption count.
    if (orderData.couponCode) {
      await incrementCouponUsage(orderData.couponCode).catch((usageError) => {
        console.error(`Failed to increment coupon usage for ${orderData.couponCode}:`, usageError);
      });
    }
  } catch (orderError) {
    // This request's stock decrement is rolled back on any insert failure —
    // including the race-condition case below, since the *other* concurrent
    // request's order is the one that legitimately reserved that stock.
    for (const rollback of stockUpdatesToRollback) {
      await incrementProductStock(rollback.productId, rollback.quantity).catch(() => {});
    }

    // REQ-1641: race-condition safety net — two near-simultaneous requests
    // for the same PaymentIntent could both pass the pre-check above before
    // either inserts; the DB's unique constraint on paymentIntentId is the
    // final arbiter. The losing request returns the winner's order instead of
    // surfacing a duplicate-order error to the client.
    if (orderError instanceof Prisma.PrismaClientKnownRequestError && orderError.code === "P2002" && orderData.paymentIntentId) {
      const winningOrder = await prisma.order.findUnique({ where: { paymentIntentId: orderData.paymentIntentId } });
      if (winningOrder) return winningOrder;
    }

    const message = orderError instanceof Error ? orderError.message : String(orderError);
    throw new Error(`Failed to create order: ${message}`);
  }

  const lowStockAlerts = stockUpdateResults
    .filter((u) => u.shouldTriggerLowStockAlert && u.success)
    .map((u) => ({
      productId: u.productId,
      productName: u.productName,
      currentStock: u.newStock,
      lowStockThreshold: u.lowStockThreshold,
    }));

  return { ...order, _stockUpdates: stockUpdateResults, _lowStockAlerts: lowStockAlerts };
}

const VALID_ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

export async function updateOrderStatus(orderId: string, status: string): Promise<OrderWithStockMeta> {
  if (!(VALID_ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`);
  }

  const existingOrder = await getOrderById(orderId);
  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const previousStatus = existingOrder.status;
  const stockRestoreResults: StockUpdateResultEntry[] = [];

  // Restore stock when an order transitions into "cancelled".
  if (status === "cancelled" && previousStatus !== "cancelled" && existingOrder.cartList) {
    const cartList = existingOrder.cartList as Array<{ id?: string; name?: string; productName?: string; quantity?: number }>;
    for (const item of cartList) {
      if (!item.id || !item.quantity) continue;
      try {
        const updatedProduct = await incrementProductStock(item.id, item.quantity);
        stockRestoreResults.push({
          productId: item.id,
          productName: item.name || item.productName || "Product",
          quantity: item.quantity,
          newStock: updatedProduct.stock,
          success: true,
        });
      } catch (stockError) {
        const message = stockError instanceof Error ? stockError.message : String(stockError);
        stockRestoreResults.push({
          productId: item.id,
          productName: item.name || item.productName || "Product",
          quantity: item.quantity,
          success: false,
          error: message,
        });
      }
    }
  }

  const updatedOrder = await prisma.order.update({ where: { id: orderId }, data: { status } });

  if (status === "cancelled" && stockRestoreResults.length > 0) {
    return { ...updatedOrder, _stockRestores: stockRestoreResults };
  }
  return updatedOrder;
}

export interface UpdateOrderTrackingInput {
  trackingNumber?: string | null;
  trackingCarrier?: string;
  labelUrl?: string;
  status?: string;
}

export async function updateOrderTracking(orderId: string, trackingData: UpdateOrderTrackingInput): Promise<Order> {
  const { trackingNumber, trackingCarrier, labelUrl, status } = trackingData;

  const existingOrder = await getOrderById(orderId);
  if (!existingOrder) {
    throw new Error("Order not found");
  }

  const data: Record<string, unknown> = {};
  if (trackingNumber !== undefined && trackingNumber !== null) data.trackingNumber = trackingNumber;
  if (trackingCarrier) data.trackingCarrier = trackingCarrier;
  if (labelUrl) data.labelUrl = labelUrl;
  if (status) data.status = status;

  return prisma.order.update({ where: { id: orderId }, data });
}

// Parent: REQ-1200 (admin/refund-order.js parity)
export async function updateOrderWithRefund(orderId: string, refundId: string, refundAmount: number): Promise<Order> {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: "refunded",
      paymentStatus: "refunded",
      refundId,
      refundAmount,
      refundedAt: new Date(),
    },
  });
}

export interface RefundResult {
  updatedOrder: Order;
  refund: Stripe.Response<Stripe.Refund>;
  stockRestoreResults: Array<Record<string, unknown>>;
}

// Stripe's own `reason` param is a fixed 3-value enum for its dispute/reporting
// tooling — it is NOT a free-text field. The admin-facing "reason" (REQ-1643,
// e.g. "customer requested shipping delay refund") is our own audit-log note
// and must never be forwarded to Stripe as-is, or the API call 400s.
const STRIPE_REFUND_REASONS = new Set<Stripe.RefundCreateParams.Reason>(["duplicate", "fraudulent", "requested_by_customer"]);
function toStripeRefundReason(reason?: string): Stripe.RefundCreateParams.Reason {
  return reason && STRIPE_REFUND_REASONS.has(reason as Stripe.RefundCreateParams.Reason) ? (reason as Stripe.RefundCreateParams.Reason) : "requested_by_customer";
}

// Parent: REQ-1639/1643/1663 — shared by the explicit "Process Refund"
// action, cancelling a paid order, and an approved return/RMA request: any
// path that returns a customer's money goes through this exact same Stripe
// flow, not a parallel one-off implementation per caller.
export async function refundOrderPayment(order: Order, options: { amount?: number; reason?: string }): Promise<RefundResult> {
  if (!stripe) throw new Error("Payment service is not configured. Please contact support.");

  const paymentIntentId = order.paymentIntentId;
  if (!paymentIntentId) throw new Error("Order does not have a payment intent ID. Cannot process refund.");

  const wasAlreadyCancelled = order.status === "cancelled";
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = paymentIntent.latest_charge;
  if (!chargeId) throw new Error("Payment intent does not have a charge. Cannot process refund.");

  const refundParams: Stripe.RefundCreateParams = {
    charge: typeof chargeId === "string" ? chargeId : chargeId.id,
    reason: toStripeRefundReason(options.reason),
  };
  if (options.amount && options.amount > 0) {
    const orderAmountInCents = Math.round((order.amount_paid || 0) * 100);
    if (options.amount > orderAmountInCents) {
      throw new Error(`Refund amount (${options.amount} cents) exceeds order amount (${orderAmountInCents} cents)`);
    }
    refundParams.amount = options.amount;
  }

  const refund = await stripe.refunds.create(refundParams);

  const stockRestoreResults: Array<Record<string, unknown>> = [];
  const cartList = order.cartList as Array<{ id?: string; name?: string; productName?: string; quantity?: number }>;
  if (!wasAlreadyCancelled && Array.isArray(cartList)) {
    for (const item of cartList) {
      if (!item.id || !item.quantity) continue;
      try {
        const updatedProduct = await incrementProductStock(item.id, item.quantity);
        stockRestoreResults.push({
          productId: item.id,
          productName: item.name || item.productName || "Product",
          quantity: item.quantity,
          newStock: updatedProduct.stock,
          success: true,
        });
      } catch (stockError) {
        stockRestoreResults.push({
          productId: item.id,
          productName: item.name || item.productName || "Product",
          quantity: item.quantity,
          success: false,
          error: stockError instanceof Error ? stockError.message : String(stockError),
        });
      }
    }
  }

  const updatedOrder = await updateOrderWithRefund(order.id, refund.id, refund.amount);
  return { updatedOrder, refund, stockRestoreResults };
}
