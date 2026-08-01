/**
 * AWS Lambda Function: Send Email via Brevo
 *
 * This Lambda function handles sending transactional emails via Brevo API.
 * Supports multiple email types: order confirmation, shipping, delivery, payment status, admin alerts.
 *
 * Endpoint: POST /email/send
 *
 * Request Body:
 * {
 *   "to": "customer@example.com",
 *   "subject": "Order Confirmation",
 *   "template": "order-confirmation",
 *   "data": {
 *     "orderId": "123",
 *     "customerName": "John Doe",
 *     "items": [...],
 *     "total": 99.99
 *   }
 * }
 */

const { successResponse, errorResponse, handleOptions } = require("../../shared/response");
const { requireAuth } = require("../../shared/auth");

// Brevo API configuration
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "arnobt78@gmail.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "CodeBook Store";
const BREVO_ADMIN_EMAIL = process.env.BREVO_ADMIN_EMAIL || "arnobt78@gmail.com";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Generate unique identifier for email subject to prevent spam filtering
 * Format: YYYYMMDD-HHMMSS-RRRR (date-time-random)
 * @returns {string} Unique identifier string
 */
function generateUniqueId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ""); // HHMMSS
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0"); // 4-digit random
  return `${dateStr}-${timeStr}-${random}`;
}

/**
 * Email templates
 * Simple HTML templates with variable placeholders
 * All subjects include unique identifiers to prevent spam filtering
 */
const emailTemplates = {
  // Customer emails
  "order-confirmation": (data) => {
    const itemsText = data.items && data.items.length > 0
      ? data.items.map(item => `- ${item.name || item.productName || "Product"} (Qty: ${item.quantity || 1}) - $${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`).join("\n")
      : "No items listed";
    
    const plainText = `Order Confirmation\n\nHello ${data.customerName || "Customer"},\n\nYour order has been confirmed and is being processed.\n\nOrder Details:\nOrder ID: ${data.orderId}\nOrder Date: ${data.orderDate || new Date().toLocaleDateString()}\nTotal Amount: $${(data.total || 0).toFixed(2)}\n\nItems Ordered:\n${itemsText}\n\nWe'll send you another email when your order ships.\n\nThank you for shopping with CodeBook Store!\n\n---\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Order Confirmation - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Order Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #2563eb; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Thank You for Your Order!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Your order has been confirmed and is being processed.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Order ID:</strong> ${data.orderId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Order Date:</strong> ${data.orderDate || new Date().toLocaleDateString()}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Total Amount:</strong> $${(data.total || 0).toFixed(2)}</p>
                        </td>
                      </tr>
                    </table>
                    ${data.items && data.items.length > 0 ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 0 0 12px 0;">
                          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #2563eb;">Items Ordered</h3>
                        </td>
                      </tr>
                      ${data.items.map(item => `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">${item.name || item.productName || "Product"}</p>
                          <p style="margin: 4px 0 0 0; font-size: 12px; line-height: 1.6; color: #6b7280;">Quantity: ${item.quantity || 1} | Price: $${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                        </td>
                      </tr>
                      `).join("")}
                    </table>
                    ` : ""}
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">We'll send you another email when your order ships.</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Thank you for shopping with CodeBook Store!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "shipping-notification": (data) => {
    const trackingInfo = data.trackingNumber 
      ? `Tracking Number: ${data.trackingNumber}${data.trackingCarrier ? ` (${data.trackingCarrier.toUpperCase()})` : ""}${data.trackingUrl ? `\nTrack your package: ${data.trackingUrl}` : ""}`
      : "";
    
    const plainText = `Your Order Has Shipped!\n\nHello ${data.customerName || "Customer"},\n\nGreat news! Your order #${data.orderId} has been shipped and is on its way to you.\n${trackingInfo ? `${trackingInfo}\n` : ""}You can expect to receive your order within 5-7 business days.\n\nThank you for shopping with CodeBook Store!\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Your Order #${data.orderId} Has Shipped! [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Order Shipped</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #10b981; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Your Order Has Shipped!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Great news! Your order #${data.orderId} has been shipped and is on its way to you.</p>
                    ${data.trackingNumber ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Tracking Number:</strong> ${data.trackingNumber}</p>
                        </td>
                      </tr>
                      ${data.trackingCarrier ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Carrier:</strong> ${data.trackingCarrier.toUpperCase()}</p>
                        </td>
                      </tr>
                      ` : ""}
                      ${data.trackingUrl ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Track Package:</strong> <a href="${data.trackingUrl}" style="color: #2563eb; text-decoration: underline;">${data.trackingUrl}</a></p>
                        </td>
                      </tr>
                      ` : ""}
                    </table>
                    ` : ""}
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">You can expect to receive your order within 5-7 business days.</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Thank you for shopping with CodeBook Store!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "delivery-confirmation": (data) => {
    const plainText = `Your Order Has Been Delivered!\n\nHello ${data.customerName || "Customer"},\n\nYour order #${data.orderId} has been successfully delivered.\n\nWe hope you enjoy your purchase! If you have any questions or concerns, please don't hesitate to contact us.\n\nThank you for shopping with CodeBook Store!\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Your Order #${data.orderId} Has Been Delivered! [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Order Delivered</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #059669; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Your Order Has Been Delivered!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Your order #${data.orderId} has been successfully delivered.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">We hope you enjoy your purchase! If you have any questions or concerns, please don't hesitate to contact us.</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Thank you for shopping with CodeBook Store!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "payment-processing": (data) => {
    const plainText = `Payment Processing\n\nHello ${data.customerName || "Customer"},\n\nWe're currently processing your payment for order #${data.orderId}.\n\nAmount: $${(data.amount || 0).toFixed(2)}\n\nYou'll receive a confirmation email once your payment is successfully processed.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Payment Processing - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Payment Processing</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #f59e0b; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Payment Processing</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">We're currently processing your payment for order #${data.orderId}.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;"><strong>Amount:</strong> $${(data.amount || 0).toFixed(2)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">You'll receive a confirmation email once your payment is successfully processed.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "payment-failed": (data) => {
    const plainText = `Payment Failed\n\nHello ${data.customerName || "Customer"},\n\nUnfortunately, your payment for order #${data.orderId} could not be processed.\n\nAmount: $${(data.amount || 0).toFixed(2)}\n\nPlease check your payment method and try again, or contact support if the problem persists.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Payment Failed - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Payment Failed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #ef4444; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Payment Failed</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Unfortunately, your payment for order #${data.orderId} could not be processed.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;"><strong>Amount:</strong> $${(data.amount || 0).toFixed(2)}</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Please check your payment method and try again, or contact support if the problem persists.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "order-canceled": (data) => {
    const plainText = `Order Canceled\n\nHello ${data.customerName || "Customer"},\n\nYour order #${data.orderId} has been canceled.\n${data.refundAmount ? `Refund Amount: $${(data.refundAmount / 100).toFixed(2)}\n` : ""}If you have any questions, please contact our support team.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Order Canceled - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Order Canceled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #6b7280; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Order Canceled</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Your order #${data.orderId} has been canceled.</p>
                    ${data.refundAmount ? `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;"><strong>Refund Amount:</strong> $${(data.refundAmount / 100).toFixed(2)}</p>` : ""}
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">If you have any questions, please contact our support team.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "order-refunded": (data) => {
    const plainText = `Refund Processed\n\nHello ${data.customerName || "Customer"},\n\nYour refund for order #${data.orderId} has been processed.\n\nRefund Amount: $${(data.refundAmount / 100).toFixed(2)}\n\nThe refund will be credited back to your original payment method within 5-10 business days.\n\nIf you have any questions, please contact our support team.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Refund Processed - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Refund Processed</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #8b5cf6; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Refund Processed</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Hello ${data.customerName || "Customer"},</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">Your refund for order #${data.orderId} has been processed.</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;"><strong>Refund Amount:</strong> $${(data.refundAmount / 100).toFixed(2)}</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">The refund will be credited back to your original payment method within 5-10 business days.</p>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">If you have any questions, please contact our support team.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  // Admin emails
  "admin-new-order": (data) => {
    // Calculate total quantity if not provided
    const totalQuantity = data.totalQuantity || (data.items && data.items.length > 0
      ? data.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
      : data.itemCount || 0);
    
    // Format items display: "X item(s), Y quantity" or just "Y quantity" if items = quantity
    const itemCount = data.itemCount || (data.items ? data.items.length : 0);
    const itemsDisplay = itemCount === totalQuantity 
      ? `${totalQuantity} item${totalQuantity !== 1 ? 's' : ''}`
      : `${itemCount} item${itemCount !== 1 ? 's' : ''}, ${totalQuantity} quantity`;
    
    // Build items list for plain text
    const itemsText = data.items && data.items.length > 0
      ? data.items.map(item => `- ${item.name || item.productName || "Product"} (Qty: ${item.quantity || 1}) - $${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`).join("\n")
      : "";
    
    const plainText = `New Order Alert\n\nA new order has been received:\n\nOrder ID: ${data.orderId}\nCustomer: ${data.customerName || "N/A"}\nEmail: ${data.customerEmail || "N/A"}\nTotal Amount: $${(data.total || 0).toFixed(2)}\nItems: ${itemsDisplay}${itemsText ? `\n\nItems Ordered:\n${itemsText}` : ""}\n\nPlease process this order in the admin panel.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `New Order Received - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>New Order Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #2563eb; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">New Order Alert</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">A new order has been received:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Order ID:</strong> ${data.orderId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Customer:</strong> ${data.customerName || "N/A"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Email:</strong> ${data.customerEmail || "N/A"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Total Amount:</strong> $${(data.total || 0).toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Items:</strong> ${itemsDisplay}</p>
                        </td>
                      </tr>
                    </table>
                    ${data.items && data.items.length > 0 ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 0 0 12px 0;">
                          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #2563eb;">Items Ordered</h3>
                        </td>
                      </tr>
                      ${data.items.map(item => `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;">${item.name || item.productName || "Product"}</p>
                          <p style="margin: 4px 0 0 0; font-size: 12px; line-height: 1.6; color: #6b7280;">Quantity: ${item.quantity || 1} | Price: $${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                        </td>
                      </tr>
                      `).join("")}
                    </table>
                    ` : ""}
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Please process this order in the admin panel.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "admin-low-stock": (data) => {
    const plainText = `Low Stock Alert\n\nA product is running low on stock:\n\nProduct: ${data.productName}\nProduct ID: ${data.productId}\nCurrent Stock: ${data.currentStock}\nLow Stock Threshold: ${data.lowStockThreshold || 10}\n\nPlease restock this product soon to avoid running out.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Low Stock Alert - ${data.productName} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Low Stock Alert</title>
        <!--[if mso]>
        <style type="text/css">
          body, table, td {font-family: Arial, sans-serif !important;}
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #f59e0b; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">⚠️ Low Stock Alert</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">A product is running low on stock:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Product:</strong> ${data.productName || "N/A"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Product ID:</strong> <span style="font-family: monospace; font-size: 12px;">${data.productId || "N/A"}</span></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Current Stock:</strong> <span style="color: #f59e0b; font-weight: 600;">${data.currentStock || 0}</span></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Low Stock Threshold:</strong> ${data.lowStockThreshold || 10}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Please restock this product soon to avoid running out.</p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "admin-out-of-stock": (data) => {
    const plainText = `Out of Stock Alert\n\nURGENT: A product has run out of stock:\n\nProduct: ${data.productName}\nProduct ID: ${data.productId}\nCurrent Stock: 0\nStatus: OUT OF STOCK\n\nThis product is now marked as out of stock and customers cannot purchase it. Please restock immediately.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Out of Stock Alert - ${data.productName} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Out of Stock Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #ef4444; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Out of Stock Alert</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;"><strong>URGENT:</strong> A product has run out of stock:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef2f2; border: 1px solid #ef4444; border-left: 4px solid #ef4444; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Product:</strong> ${data.productName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Product ID:</strong> <span style="font-family: monospace; font-size: 12px;">${data.productId}</span></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Current Stock:</strong> <span style="color: #ef4444; font-weight: 600;">0</span></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Status:</strong> <span style="color: #ef4444; font-weight: 600;">OUT OF STOCK</span></p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">This product is now marked as out of stock and customers cannot purchase it. Please restock immediately.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "admin-payment-failure": (data) => {
    const plainText = `Payment Failure Alert\n\nA payment has failed:\n\nOrder ID: ${data.orderId}\nCustomer: ${data.customerName || "N/A"}\nAmount: $${(data.amount || 0).toFixed(2)}\nError: ${data.error || "Unknown error"}\n\nPlease investigate this payment failure.\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Payment Failure Alert - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Payment Failure Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #ef4444; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Payment Failure Alert</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">A payment has failed:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Order ID:</strong> ${data.orderId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Customer:</strong> ${data.customerName || "N/A"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Amount:</strong> $${(data.amount || 0).toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Error:</strong> ${data.error || "Unknown error"}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">Please investigate this payment failure.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },

  "admin-refund-processed": (data) => {
    const plainText = `Refund Processed Alert\n\nA refund has been processed:\n\nOrder ID: ${data.orderId}\nCustomer: ${data.customerName || "N/A"}\nRefund Amount: $${(data.refundAmount / 100).toFixed(2)}\nRefund ID: ${data.refundId || "N/A"}\n\n---\nCodeBook Store\nThis is an automated email. Please do not reply.`;
    
    return {
      subject: `Refund Processed - Order #${data.orderId} [${generateUniqueId()}]`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="format-detection" content="telephone=no">
        <title>Refund Processed Alert</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 20px 0;">
          <tr>
            <td align="center" style="padding: 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #8b5cf6; color: #ffffff; padding: 24px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; line-height: 1.2;">Refund Processed</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 20px; background-color: #ffffff;">
                    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">A refund has been processed:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Order ID:</strong> ${data.orderId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Customer:</strong> ${data.customerName || "N/A"}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Refund Amount:</strong> $${(data.refundAmount / 100).toFixed(2)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #374151;"><strong style="color: #111827;">Refund ID:</strong> ${data.refundId || "N/A"}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6b7280;">CodeBook Store<br>This is an automated email. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
      text: plainText,
    };
  },
};

/**
 * Send email via Brevo API
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string|Object} html - Email HTML content (string) or template object with html and text properties
 * @returns {Promise<Object>} Brevo API response
 */
async function sendEmailViaBrevo(to, subject, html) {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY environment variable is not set");
  }

  // Handle both string HTML and object with html/text properties
  const htmlContent = typeof html === "string" ? html : html.html || html;
  const textContent = typeof html === "object" && html.text ? html.text : null;

  const emailData = {
    sender: {
      name: BREVO_SENDER_NAME,
      email: BREVO_SENDER_EMAIL,
    },
    to: [
      {
        email: to,
      },
    ],
    subject: subject,
    htmlContent: htmlContent,
    // Add plain text version for better email client compatibility and deliverability
    // This helps reduce spam warnings and improves accessibility
    ...(textContent && { textContent: textContent }),
    // Add reply-to address (same as sender for transactional emails)
    replyTo: {
      email: BREVO_SENDER_EMAIL,
      name: BREVO_SENDER_NAME,
    },
    // Add headers to improve deliverability and reduce spam warnings
    // These headers help email providers (especially Yahoo) identify legitimate transactional emails
    headers: {
      "X-Mailer": "CodeBook Store Email System",
      "X-Priority": "3",
      "Importance": "normal",
      "Precedence": "bulk", // Indicates automated transactional email
      "Auto-Submitted": "auto-generated", // RFC 3834: Indicates automated email
      "List-Unsubscribe": `<mailto:${BREVO_SENDER_EMAIL}?subject=unsubscribe>`, // Helps with deliverability
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", // One-click unsubscribe support
    },
  };

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(emailData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Lambda Handler Function
 *
 * @param {object} event - Lambda event object
 * @param {object} context - Lambda context object
 * @returns {Promise<object>} Lambda response object
 */
exports.handler = async (event, context) => {
  console.log("Send Email Lambda invoked:", JSON.stringify(event, null, 2));

  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  // Handle CORS preflight request
  if (httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Only allow POST method
  if (httpMethod !== "POST") {
    return errorResponse("Method not allowed. Use POST.", 405);
  }

  try {
    // Require authentication (admin or user can send emails)
    // For customer emails, user can send to themselves
    // For admin emails, require admin role
    const user = await requireAuth(event);

    // Parse request body
    let emailRequest;
    try {
      emailRequest = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    const { to, template, data } = emailRequest;
    if (!to || !template) {
      return errorResponse("'to' and 'template' are required fields", 400);
    }

    // Validate template exists
    if (!emailTemplates[template]) {
      return errorResponse(`Invalid template: ${template}`, 400);
    }

    // Get template content
    const templateContent = emailTemplates[template](data || {});

    // Send email via Brevo
    // Template content can be an object with {subject, html, text} or just {subject, html}
    const result = await sendEmailViaBrevo(to, templateContent.subject, templateContent);

    console.log("Email sent successfully:", result);

    return successResponse(
      {
        message: "Email sent successfully",
        messageId: result.messageId,
        to: to,
        template: template,
      },
      200
    );
  } catch (error) {
    console.error("Send Email Error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    // Handle authentication errors
    if (error.message?.includes("Unauthorized") || error.message?.includes("Invalid token")) {
      return errorResponse({ message: error.message, error: "UnauthorizedError" }, 401);
    }

    return errorResponse(
      {
        message: error.message || "Failed to send email",
        error: error.name || "UnknownError",
      },
      500
    );
  }
};


