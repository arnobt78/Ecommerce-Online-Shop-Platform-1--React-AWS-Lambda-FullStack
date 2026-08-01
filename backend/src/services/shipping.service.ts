// Parent: REQ-1200, REQ-1208, REQ-1301 — ported from
// aws-lambda/functions/admin/generate-label.js `generateShippoLabel` (same
// Shippo API calls, same test-mode USPS filtering, same address fallbacks).

import type { Order } from "@prisma/client";

interface ShippoAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

export interface GenerateLabelOptions {
  carrier?: string;
  service?: string;
  fromAddress?: ShippoAddress;
  toAddress?: ShippoAddress;
  length?: string;
  width?: string;
  height?: string;
}

// Loosely-typed Shippo API response shapes — only the fields this module
// actually reads are declared (Shippo's real payloads carry many more).
interface ShippoErrorBody {
  detail?: string;
  message?: string;
}
interface ShippoShipment {
  object_id: string;
  carrier?: string;
  rates?: Array<Record<string, unknown>>;
}
interface ShippoRatesResponse {
  results?: Array<Record<string, unknown>>;
}
interface ShippoTransaction {
  status: string;
  object_id: string;
  id?: string;
  carrier?: string;
  messages?: Array<{ text?: string }>;
  tracking_number?: string;
  tracking_status?: { tracking_number?: string; tracking_number_provider?: string };
  label_url?: string;
  label_url_pdf?: string;
  tracking_url_provider?: string;
}

export interface GeneratedLabel {
  trackingNumber: string | null;
  trackingCarrier: string;
  labelUrl: string | null;
  trackingUrl: string | null;
  status: string;
  shippoTransactionId: string;
}

// The Order + a few legacy/alternate field names the AWS Lambda payload
// sometimes carried (`address` vs the real `shippingAddress` column added in
// REQ-1620, `items` vs `cartList`, etc.). Prisma's generated `shippingAddress`
// stays `Json | null` here (matches the real Order type) and is narrowed with
// a runtime-safe cast at the point of use below.
type OrderLike = Order & {
  address?: Record<string, string>;
  customerName?: string;
  customerEmail?: string;
  items?: Array<{ quantity?: number }>;
};

export async function generateShippoLabel(order: OrderLike, options: GenerateLabelOptions = {}): Promise<GeneratedLabel> {
  const shippoApiKey = process.env.SHIPPO_API_KEY;
  if (!shippoApiKey) {
    throw new Error("Shippo API key not configured");
  }

  const shippingAddress = (order.shippingAddress as Record<string, string> | null) || order.address || {};
  const orderUser = order.user as { name?: string; email?: string; phone?: string } | null;

  const fromAddress: ShippoAddress = options.fromAddress || {
    name: process.env.SHIPPO_FROM_NAME || "CodeBook Store",
    street1: process.env.SHIPPO_FROM_STREET1 || "123 Main St",
    city: process.env.SHIPPO_FROM_CITY || "New York",
    state: process.env.SHIPPO_FROM_STATE || "NY",
    zip: process.env.SHIPPO_FROM_ZIP || "10001",
    country: process.env.SHIPPO_FROM_COUNTRY || "US",
    phone: process.env.SHIPPO_FROM_PHONE || "+1 555 123 4567",
    email: process.env.SHIPPO_FROM_EMAIL || "arnobt78@gmail.com",
  };

  if (!fromAddress.email || !fromAddress.phone) {
    throw new Error(
      "Sender address must include both email and phone number for USPS shipping. Set SHIPPO_FROM_EMAIL and SHIPPO_FROM_PHONE."
    );
  }

  let toAddress = options.toAddress;
  if (!toAddress) {
    const hasValidAddress = Boolean(
      shippingAddress.street1 && shippingAddress.city && shippingAddress.state && shippingAddress.zip
    );

    if (hasValidAddress) {
      toAddress = {
        // REQ-1620: real saved addresses use `fullName` (matches the Address
        // model); `name` kept as a fallback for any legacy/alternate payload shape.
        name: shippingAddress.fullName || shippingAddress.name || orderUser?.name || order.customerName || "Customer",
        street1: shippingAddress.street1 || shippingAddress.address || shippingAddress.street || "",
        street2: shippingAddress.street2 || shippingAddress.address2 || "",
        city: shippingAddress.city || "",
        state: shippingAddress.state || "",
        zip: shippingAddress.zip || shippingAddress.postalCode || shippingAddress.zipCode || "",
        country: shippingAddress.country || "US",
        phone: shippingAddress.phone || orderUser?.phone || "+1 555 123 4567",
        email: orderUser?.email || order.customerEmail || "",
      };
    } else if (shippoApiKey.startsWith("shippo_test_")) {
      toAddress = {
        name: orderUser?.name || order.customerName || "Test Customer",
        street1: "965 Mission St",
        street2: "",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
        country: "US",
        phone: orderUser?.phone || shippingAddress.phone || "+1 555 123 4567",
        email: orderUser?.email || order.customerEmail || "customer@example.com",
      };
    } else {
      throw new Error("Incomplete shipping address. Please ensure street, city, state, and zip are provided.");
    }
  }
  if (!toAddress) {
    throw new Error("Incomplete shipping address. Please ensure street, city, state, and zip are provided.");
  }

  if (!toAddress.street1 || !toAddress.city || !toAddress.state || !toAddress.zip) {
    throw new Error("Recipient address is incomplete. Required fields: street1, city, state, zip");
  }
  if (!toAddress.phone) toAddress.phone = orderUser?.phone || "+1 555 123 4567";
  if (!toAddress.email) toAddress.email = orderUser?.email || order.customerEmail || "customer@example.com";

  const orderItems = order.items || (order.cartList as Array<{ quantity?: number }>) || [];
  const totalWeight = orderItems.reduce((sum, item) => sum + (item.quantity || 1) * 0.5, 0) || 1.0;
  const isTestMode = shippoApiKey.startsWith("shippo_test_");

  const shipmentData = {
    address_from: fromAddress,
    address_to: toAddress,
    parcels: [
      {
        length: options.length || "10",
        width: options.width || "8",
        height: options.height || "4",
        distance_unit: "in",
        weight: totalWeight.toString(),
        mass_unit: "lb",
      },
    ],
    async: false,
  };

  const shippoResponse = await fetch("https://api.goshippo.com/shipments", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${shippoApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(shipmentData),
  });

  if (!shippoResponse.ok) {
    const errorData = (await shippoResponse.json().catch(() => ({}))) as ShippoErrorBody;
    throw new Error(errorData.detail || errorData.message || `Shippo API error: ${shippoResponse.status}`);
  }

  const shipment = (await shippoResponse.json()) as ShippoShipment;

  let rates: Array<Record<string, unknown>> = shipment.rates || [];
  if (!rates.length) {
    const ratesResponse = await fetch(`https://api.goshippo.com/shipments/${shipment.object_id}/rates`, {
      headers: { Authorization: `ShippoToken ${shippoApiKey}`, "Content-Type": "application/json" },
    });
    if (ratesResponse.ok) {
      const ratesData = (await ratesResponse.json()) as ShippoRatesResponse | Array<Record<string, unknown>>;
      rates = (Array.isArray(ratesData) ? ratesData : ratesData.results) || [];
    }
  }

  if (!rates.length) {
    throw new Error("No shipping rates available for this shipment. Please check address and parcel dimensions.");
  }

  let availableRates = rates;
  if (isTestMode) {
    availableRates = rates.filter((rate) => {
      const servicelevel = rate.servicelevel as { carrier?: string } | undefined;
      const carrier = String(rate.carrier || rate.provider || servicelevel?.carrier || "").toLowerCase();
      return carrier === "usps" || carrier.includes("usps");
    });
    if (!availableRates.length) {
      throw new Error(
        "No USPS rates available in test mode. USPS doesn't require carrier registration. Please ensure your shipment addresses are valid US addresses."
      );
    }
  }

  const selectedRate = options.service
    ? availableRates.find((rate) => (rate.servicelevel as { token?: string } | undefined)?.token === options.service) ||
      availableRates[0]
    : availableRates[0];

  if (!selectedRate) {
    throw new Error("No suitable shipping rate found for the specified service level");
  }

  const transactionResponse = await fetch("https://api.goshippo.com/transactions", {
    method: "POST",
    headers: { Authorization: `ShippoToken ${shippoApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ rate: selectedRate.object_id, async: false }),
  });

  if (!transactionResponse.ok) {
    const errorData = (await transactionResponse.json().catch(() => ({}))) as ShippoErrorBody;
    throw new Error(errorData.detail || errorData.message || `Shippo transaction error: ${transactionResponse.status}`);
  }

  const transaction = (await transactionResponse.json()) as ShippoTransaction;

  if (transaction.status === "ERROR") {
    const errorMessage = transaction.messages?.[0]?.text || "Shippo transaction failed to create label.";
    if (isTestMode && (errorMessage.includes("not yet registered") || errorMessage.includes("registration"))) {
      throw new Error(
        `Carrier account not registered. In test mode, we use USPS which doesn't require registration. Error: ${errorMessage}`
      );
    }
    throw new Error(errorMessage);
  }

  const trackingNumber =
    transaction.tracking_number ||
    transaction.tracking_status?.tracking_number ||
    transaction.tracking_status?.tracking_number_provider ||
    null;
  const labelUrl = transaction.label_url || transaction.label_url_pdf || null;

  let finalTrackingNumber = trackingNumber;
  if (!finalTrackingNumber && shippoApiKey.startsWith("shippo_test_")) {
    const idSource =
      transaction.object_id?.replace(/[^a-zA-Z0-9]/g, "") ||
      transaction.id?.replace(/[^a-zA-Z0-9]/g, "") ||
      Date.now().toString();
    finalTrackingNumber = `TEST-${idSource.slice(-12).toUpperCase()}`;
  }

  return {
    trackingNumber: finalTrackingNumber,
    trackingCarrier: transaction.carrier || shipment.carrier || "usps",
    labelUrl,
    trackingUrl: transaction.tracking_url_provider || null,
    status: transaction.status,
    shippoTransactionId: transaction.object_id,
  };
}
