// Parent: REQ-1202, REQ-1205, REQ-1208, REQ-1301, REQ-1612
// Ported from aws-lambda/functions/email/send-email.js — same Brevo API call,
// same template set and subjects/content, so customer/admin emails look
// identical to the AWS backend.

import { generateInvoicePdf } from "./invoice.service";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "arnobt78@gmail.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "CodeBook Store";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Parent: REQ-1302 — one loosely-typed input shape shared across every
// template function below; each template only reads the subset of fields
// relevant to it (mirrors the AWS Lambda handler's untyped `data` object).
export interface EmailTemplateData {
  orderId?: string;
  orderDate?: string;
  total?: number;
  amount?: number;
  items?: Array<{ name?: string; productName?: string; quantity?: number; price?: number }>;
  totalQuantity?: number;
  itemCount?: number;
  customerName?: string;
  customerEmail?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  refundAmount?: number;
  refundId?: string;
  productName?: string;
  productId?: string;
  currentStock?: number;
  lowStockThreshold?: number;
  error?: string;
  // REQ-1654 — daily low-stock/out-of-stock digest (rollup instead of a ping per order)
  lowStockProducts?: Array<{ id: string; name: string; stock: number; lowStockThreshold: number }>;
  outOfStockProducts?: Array<{ id: string; name: string }>;
}

interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function generateUniqueId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${dateStr}-${timeStr}-${random}`;
}

function wrapEmail({
  headerColor,
  headerTitle,
  bodyHtml,
}: {
  headerColor: string;
  headerTitle: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>${headerTitle}</title></head>
  <body style="margin:0;padding:0;font-family:Arial,Helvetica Neue,Helvetica,sans-serif;background-color:#f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f3f4f6;padding:20px 0;">
      <tr><td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr><td style="background-color:${headerColor};color:#ffffff;padding:24px 20px;text-align:center;"><h1 style="margin:0;font-size:24px;font-weight:600;">${headerTitle}</h1></td></tr>
          <tr><td style="padding:24px 20px;background-color:#ffffff;">${bodyHtml}</td></tr>
          <tr><td style="padding:20px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><p style="margin:0;font-size:12px;color:#6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p></td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function row(label: string, value: string | number): string {
  return `<p style="margin:0;font-size:14px;color:#374151;"><strong style="color:#111827;">${label}:</strong> ${value}</p>`;
}

function infoBox(rowsHtml: string[]): string {
  return `<table role="presentation" width="100%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0;"><tr><td>${rowsHtml.join('</td></tr><tr><td style="padding-top:8px;">')}</td></tr></table>`;
}

export const emailTemplates: Record<string, (data: EmailTemplateData) => EmailContent> = {
  "order-confirmation": (data) => {
    const items = data.items || [];
    const itemsText = items.length
      ? items
          .map(
            (i) =>
              `- ${i.name || i.productName || "Product"} (Qty: ${i.quantity || 1}) - $${((i.price || 0) * (i.quantity || 1)).toFixed(2)}`
          )
          .join("\n")
      : "No items listed";
    const itemsHtml = items.length
      ? `<h3 style="margin:16px 0 8px;color:#2563eb;">Items Ordered</h3>` +
        items
          .map(
            (i) =>
              `<p style="margin:4px 0;font-size:14px;">${i.name || i.productName || "Product"} — Qty ${i.quantity || 1} — $${((i.price || 0) * (i.quantity || 1)).toFixed(2)}</p>`
          )
          .join("")
      : "";
    return {
      subject: `Order Confirmation - Order #${data.orderId} [${generateUniqueId()}]`,
      text: `Order Confirmation\n\nHello ${data.customerName || "Customer"},\n\nYour order has been confirmed and is being processed.\n\nOrder ID: ${data.orderId}\nOrder Date: ${data.orderDate || new Date().toLocaleDateString()}\nTotal Amount: $${(data.total || 0).toFixed(2)}\n\nItems Ordered:\n${itemsText}\n\nWe'll send you another email when your order ships.\n\nThank you for shopping with CodeBook Store!`,
      html: wrapEmail({
        headerColor: "#2563eb",
        headerTitle: "Thank You for Your Order!",
        bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Your order has been confirmed and is being processed.</p>${infoBox([row("Order ID", data.orderId || ""), row("Order Date", data.orderDate || new Date().toLocaleDateString()), row("Total Amount", `$${(data.total || 0).toFixed(2)}`)])}${itemsHtml}<p>We'll send you another email when your order ships.</p><p>Thank you for shopping with CodeBook Store!</p>`,
      }),
    };
  },

  "shipping-notification": (data) => ({
    subject: `Your Order #${data.orderId} Has Shipped! [${generateUniqueId()}]`,
    text: `Your Order Has Shipped!\n\nHello ${data.customerName || "Customer"},\n\nYour order #${data.orderId} has shipped.\n${data.trackingNumber ? `Tracking Number: ${data.trackingNumber}${data.trackingCarrier ? ` (${data.trackingCarrier.toUpperCase()})` : ""}\n` : ""}${data.trackingUrl ? `Track: ${data.trackingUrl}\n` : ""}You can expect delivery within 5-7 business days.`,
    html: wrapEmail({
      headerColor: "#10b981",
      headerTitle: "Your Order Has Shipped!",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Great news! Your order #${data.orderId} has shipped.</p>${data.trackingNumber ? infoBox([row("Tracking Number", data.trackingNumber), ...(data.trackingCarrier ? [row("Carrier", data.trackingCarrier.toUpperCase())] : []), ...(data.trackingUrl ? [row("Track Package", `<a href="${data.trackingUrl}">${data.trackingUrl}</a>`)] : [])]) : ""}<p>Expect delivery within 5-7 business days.</p>`,
    }),
  }),

  "delivery-confirmation": (data) => ({
    subject: `Your Order #${data.orderId} Has Been Delivered! [${generateUniqueId()}]`,
    text: `Your order #${data.orderId} has been delivered. We hope you enjoy your purchase!`,
    html: wrapEmail({
      headerColor: "#059669",
      headerTitle: "Your Order Has Been Delivered!",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Your order #${data.orderId} has been successfully delivered.</p><p>We hope you enjoy your purchase!</p>`,
    }),
  }),

  "payment-processing": (data) => ({
    subject: `Payment Processing - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Processing payment for order #${data.orderId}. Amount: $${(data.amount || 0).toFixed(2)}.`,
    html: wrapEmail({
      headerColor: "#f59e0b",
      headerTitle: "Payment Processing",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>We're processing your payment for order #${data.orderId}.</p><p><strong>Amount:</strong> $${(data.amount || 0).toFixed(2)}</p>`,
    }),
  }),

  "payment-failed": (data) => ({
    subject: `Payment Failed - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Payment for order #${data.orderId} failed. Amount: $${(data.amount || 0).toFixed(2)}.`,
    html: wrapEmail({
      headerColor: "#ef4444",
      headerTitle: "Payment Failed",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Your payment for order #${data.orderId} could not be processed.</p><p><strong>Amount:</strong> $${(data.amount || 0).toFixed(2)}</p><p>Please try again or contact support.</p>`,
    }),
  }),

  "order-canceled": (data) => ({
    subject: `Order Canceled - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Your order #${data.orderId} has been canceled.${data.refundAmount ? ` Refund: $${(data.refundAmount / 100).toFixed(2)}.` : ""}`,
    html: wrapEmail({
      headerColor: "#6b7280",
      headerTitle: "Order Canceled",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Your order #${data.orderId} has been canceled.</p>${data.refundAmount ? `<p><strong>Refund Amount:</strong> $${(data.refundAmount / 100).toFixed(2)}</p>` : ""}`,
    }),
  }),

  "order-refunded": (data) => ({
    subject: `Refund Processed - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Your refund for order #${data.orderId} of $${((data.refundAmount || 0) / 100).toFixed(2)} has been processed.`,
    html: wrapEmail({
      headerColor: "#8b5cf6",
      headerTitle: "Refund Processed",
      bodyHtml: `<p>Hello ${data.customerName || "Customer"},</p><p>Your refund for order #${data.orderId} has been processed.</p><p><strong>Refund Amount:</strong> $${((data.refundAmount || 0) / 100).toFixed(2)}</p><p>Funds return to your original payment method within 5-10 business days.</p>`,
    }),
  }),

  "admin-new-order": (data) => {
    const totalQuantity = data.totalQuantity ?? (data.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
    const itemCount = data.itemCount ?? (data.items || []).length;
    const itemsDisplay = itemCount === totalQuantity ? `${totalQuantity} item(s)` : `${itemCount} item(s), ${totalQuantity} quantity`;
    return {
      subject: `New Order Received - Order #${data.orderId} [${generateUniqueId()}]`,
      text: `New order #${data.orderId} from ${data.customerName || "N/A"} (${data.customerEmail || "N/A"}). Total: $${(data.total || 0).toFixed(2)}. Items: ${itemsDisplay}.`,
      html: wrapEmail({
        headerColor: "#2563eb",
        headerTitle: "New Order Alert",
        bodyHtml: `<p>A new order has been received:</p>${infoBox([row("Order ID", data.orderId || ""), row("Customer", data.customerName || "N/A"), row("Email", data.customerEmail || "N/A"), row("Total Amount", `$${(data.total || 0).toFixed(2)}`), row("Items", itemsDisplay)])}<p>Please process this order in the admin panel.</p>`,
      }),
    };
  },

  "admin-low-stock": (data) => ({
    subject: `Low Stock Alert - ${data.productName} [${generateUniqueId()}]`,
    text: `Low stock: ${data.productName} (${data.productId}) — ${data.currentStock} left (threshold ${data.lowStockThreshold || 10}).`,
    html: wrapEmail({
      headerColor: "#f59e0b",
      headerTitle: "⚠️ Low Stock Alert",
      bodyHtml: `<p>A product is running low on stock:</p>${infoBox([row("Product", data.productName || "N/A"), row("Product ID", data.productId || "N/A"), row("Current Stock", data.currentStock || 0), row("Threshold", data.lowStockThreshold || 10)])}<p>Please restock soon.</p>`,
    }),
  }),

  "admin-out-of-stock": (data) => ({
    subject: `Out of Stock Alert - ${data.productName} [${generateUniqueId()}]`,
    text: `URGENT: ${data.productName} (${data.productId}) is OUT OF STOCK.`,
    html: wrapEmail({
      headerColor: "#ef4444",
      headerTitle: "Out of Stock Alert",
      bodyHtml: `<p><strong>URGENT:</strong> A product has run out of stock:</p>${infoBox([row("Product", data.productName || ""), row("Product ID", data.productId || ""), row("Status", "OUT OF STOCK")])}<p>Please restock immediately.</p>`,
    }),
  }),

  // REQ-1654 — consolidated rollup instead of a ping per order (existing
  // admin-low-stock/admin-out-of-stock templates above stay as the real-time
  // per-order alerts; this is the on-demand digest across the whole catalog).
  "admin-low-stock-digest": (data) => {
    const lowStock = data.lowStockProducts || [];
    const outOfStock = data.outOfStockProducts || [];
    const total = lowStock.length + outOfStock.length;
    const lowStockRows = lowStock.map((p) => row(p.name, `${p.stock} left (threshold ${p.lowStockThreshold})`));
    const outOfStockRows = outOfStock.map((p) => row(p.name, "OUT OF STOCK"));
    return {
      subject: `Stock Digest: ${total} product${total === 1 ? "" : "s"} need attention [${generateUniqueId()}]`,
      text: `Stock digest — ${outOfStock.length} out of stock, ${lowStock.length} low stock. ${[...outOfStock.map((p) => p.name), ...lowStock.map((p) => p.name)].join(", ")}.`,
      html: wrapEmail({
        headerColor: "#f59e0b",
        headerTitle: "📦 Stock Digest",
        bodyHtml:
          (outOfStock.length > 0 ? `<p><strong>Out of stock (${outOfStock.length}):</strong></p>${infoBox(outOfStockRows)}` : "") +
          (lowStock.length > 0 ? `<p><strong>Low stock (${lowStock.length}):</strong></p>${infoBox(lowStockRows)}` : "") +
          (total === 0 ? "<p>No products currently need restocking.</p>" : "<p>Review the admin catalog to restock.</p>"),
      }),
    };
  },

  "admin-payment-failure": (data) => ({
    subject: `Payment Failure Alert - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Payment failed for order #${data.orderId} (${data.customerName || "N/A"}). Amount: $${(data.amount || 0).toFixed(2)}. Error: ${data.error || "Unknown"}.`,
    html: wrapEmail({
      headerColor: "#ef4444",
      headerTitle: "Payment Failure Alert",
      bodyHtml: `<p>A payment has failed:</p>${infoBox([row("Order ID", data.orderId || ""), row("Customer", data.customerName || "N/A"), row("Amount", `$${(data.amount || 0).toFixed(2)}`), row("Error", data.error || "Unknown error")])}<p>Please investigate.</p>`,
    }),
  }),

  "admin-refund-processed": (data) => ({
    subject: `Refund Processed - Order #${data.orderId} [${generateUniqueId()}]`,
    text: `Refund processed for order #${data.orderId} (${data.customerName || "N/A"}): $${((data.refundAmount || 0) / 100).toFixed(2)}.`,
    html: wrapEmail({
      headerColor: "#8b5cf6",
      headerTitle: "Refund Processed",
      bodyHtml: `<p>A refund has been processed:</p>${infoBox([row("Order ID", data.orderId || ""), row("Customer", data.customerName || "N/A"), row("Refund Amount", `$${((data.refundAmount || 0) / 100).toFixed(2)}`), row("Refund ID", data.refundId || "N/A")])}`,
    }),
  }),
};

interface EmailAttachment {
  name: string;
  content: string; // base64-encoded, per Brevo's transactional email API
}

async function sendEmailViaBrevo(
  to: string,
  subject: string,
  content: EmailContent,
  attachments?: EmailAttachment[]
): Promise<{ messageId: string }> {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY environment variable is not set");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: content.html,
      ...(content.text && { textContent: content.text }),
      ...(attachments && attachments.length > 0 && { attachment: attachments }),
      replyTo: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      headers: {
        "X-Mailer": "CodeBook Store Email System",
        "X-Priority": "3",
        Importance: "normal",
        Precedence: "bulk",
        "Auto-Submitted": "auto-generated",
        "List-Unsubscribe": `<mailto:${BREVO_SENDER_EMAIL}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{ messageId: string }>;
}

export async function sendTemplatedEmail(
  to: string,
  template: string,
  data: EmailTemplateData = {}
): Promise<{ messageId: string }> {
  const templateFn = emailTemplates[template];
  if (!templateFn) {
    throw new Error(`Invalid template: ${template}`);
  }
  const content = templateFn(data);

  // Order confirmations get an invoice PDF attached — generated on the fly
  // from the same order data, so there's no separate invoice-storage concern.
  // A PDF-generation failure must never block the confirmation email itself.
  let attachments: EmailAttachment[] | undefined;
  if (template === "order-confirmation" && data.orderId) {
    try {
      const pdfBuffer = await generateInvoicePdf({
        orderId: data.orderId,
        orderDate: data.orderDate,
        customerName: data.customerName,
        customerEmail: data.customerEmail || to,
        items: data.items,
        total: data.total,
      });
      attachments = [{ name: `invoice-${data.orderId}.pdf`, content: pdfBuffer.toString("base64") }];
    } catch (invoiceError) {
      console.error("Invoice PDF generation failed, sending confirmation without attachment:", invoiceError);
    }
  }

  const result = await sendEmailViaBrevo(to, content.subject, content, attachments);
  return { messageId: result.messageId };
}
