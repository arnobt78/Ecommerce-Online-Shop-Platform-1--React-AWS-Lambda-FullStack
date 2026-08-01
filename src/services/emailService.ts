/**
 * Email Service - Send transactional emails via Brevo
 *
 * This service handles sending emails through the backend email API.
 * Used for order confirmations, shipping notifications, admin alerts, etc.
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";

interface Session {
  token: string | null;
  cbid: string | null;
}

function getSession(): Session {
  try {
    const token = JSON.parse(sessionStorage.getItem("token") || "null");
    const cbid = JSON.parse(sessionStorage.getItem("cbid") || "null");
    return { token, cbid };
  } catch {
    return { token: null, cbid: null };
  }
}

export interface EmailSendResult {
  message: string;
  messageId?: string;
  to: string;
  template: string;
}

// Available templates:
// - Customer: order-confirmation, shipping-notification, delivery-confirmation, payment-processing, payment-failed, order-canceled, order-refunded
// - Admin: admin-new-order, admin-low-stock, admin-payment-failure, admin-refund-processed
export async function sendEmail(to: string, template: string, data: Record<string, unknown> = {}): Promise<EmailSendResult> {
  const browserData = getSession();
  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browserData.token}`,
    },
    body: JSON.stringify({ to, template, data }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.message || "Failed to send email", response.status);
  }

  return response.json();
}

interface OrderConfirmationData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  items?: unknown[];
  total?: number;
  orderDate?: string;
}

export async function sendOrderConfirmationEmail(orderData: OrderConfirmationData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, items, total, orderDate } = orderData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "order-confirmation", { orderId, customerName, items, total, orderDate });
}

interface ShippingNotificationData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
}

export async function sendShippingNotificationEmail(shippingData: ShippingNotificationData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, trackingNumber, trackingCarrier, trackingUrl } = shippingData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "shipping-notification", {
    orderId,
    customerName,
    trackingNumber,
    trackingCarrier: trackingCarrier || "usps",
    trackingUrl: trackingUrl || null,
  });
}

interface DeliveryConfirmationData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
}

export async function sendDeliveryConfirmationEmail(deliveryData: DeliveryConfirmationData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId } = deliveryData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "delivery-confirmation", { orderId, customerName });
}

interface PaymentEmailData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  amount?: number;
}

export async function sendPaymentProcessingEmail(paymentData: PaymentEmailData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, amount } = paymentData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "payment-processing", { orderId, customerName, amount });
}

export async function sendPaymentFailedEmail(paymentData: PaymentEmailData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, amount } = paymentData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "payment-failed", { orderId, customerName, amount });
}

interface CancelEmailData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  refundAmount?: number;
}

export async function sendOrderCanceledEmail(cancelData: CancelEmailData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, refundAmount } = cancelData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "order-canceled", { orderId, customerName, refundAmount });
}

interface RefundEmailData {
  customerEmail: string;
  customerName?: string;
  orderId: string;
  refundAmount?: number;
  refundId?: string;
}

export async function sendOrderRefundedEmail(refundData: RefundEmailData): Promise<EmailSendResult> {
  const { customerEmail, customerName, orderId, refundAmount, refundId } = refundData;

  if (!customerEmail) {
    throw new ApiError("Customer email is required", 400);
  }

  return sendEmail(customerEmail, "order-refunded", { orderId, customerName, refundAmount, refundId });
}

const ADMIN_ALERT_EMAIL = "arnobt78@gmail.com";

interface AdminNewOrderData {
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  total?: number;
  itemCount?: number;
  totalQuantity?: number;
  items?: unknown[];
}

export async function sendAdminNewOrderEmail(orderData: AdminNewOrderData): Promise<EmailSendResult> {
  const { orderId, customerName, customerEmail, total, itemCount, totalQuantity, items } = orderData;

  return sendEmail(ADMIN_ALERT_EMAIL, "admin-new-order", {
    orderId,
    customerName,
    customerEmail,
    total,
    itemCount,
    totalQuantity,
    items,
  });
}

interface StockAlertData {
  productId: string;
  productName?: string;
  currentStock?: number;
  lowStockThreshold?: number;
}

export async function sendAdminLowStockEmail(stockData: StockAlertData): Promise<EmailSendResult> {
  const { productId, productName, currentStock, lowStockThreshold } = stockData;

  return sendEmail(ADMIN_ALERT_EMAIL, "admin-low-stock", { productId, productName, currentStock, lowStockThreshold });
}

export async function sendAdminOutOfStockEmail(stockData: Pick<StockAlertData, "productId" | "productName">): Promise<EmailSendResult> {
  const { productId, productName } = stockData;

  return sendEmail(ADMIN_ALERT_EMAIL, "admin-out-of-stock", { productId, productName });
}

interface AdminPaymentFailureData {
  orderId: string;
  customerName?: string;
  amount?: number;
  error?: string;
}

export async function sendAdminPaymentFailureEmail(paymentData: AdminPaymentFailureData): Promise<EmailSendResult> {
  const { orderId, customerName, amount, error } = paymentData;

  return sendEmail(ADMIN_ALERT_EMAIL, "admin-payment-failure", { orderId, customerName, amount, error });
}

interface AdminRefundData {
  orderId: string;
  customerName?: string;
  refundAmount?: number;
  refundId?: string;
}

export async function sendAdminRefundProcessedEmail(refundData: AdminRefundData): Promise<EmailSendResult> {
  const { orderId, customerName, refundAmount, refundId } = refundData;

  return sendEmail(ADMIN_ALERT_EMAIL, "admin-refund-processed", { orderId, customerName, refundAmount, refundId });
}
