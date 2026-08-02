/**
 * Data Service - Direct backend API calls (orders/user session helpers).
 */

import { ApiError } from "./apiError";
import { API_BASE_URL } from "../lib/apiBase";
import type { CartItem, Order, OrderShippingAddress, OrderUserSnapshot, OrderWithTimeline } from "../types";

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

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  image: string | null;
}

// Note: backend doesn't expose GET /users/{id} yet. For now, returns user
// info from session storage (maintains compatibility with the AWS Lambda-era contract).
export async function getUser(): Promise<SessionUser> {
  const browserData = getSession();

  if (!browserData.cbid) {
    throw new ApiError("User not authenticated", 401);
  }

  const userEmail = sessionStorage.getItem("userEmail");
  const userName = sessionStorage.getItem("userName");
  const userRole = sessionStorage.getItem("userRole");
  const userImage = sessionStorage.getItem("userImage");

  if (!userEmail) {
    throw new ApiError("User data not found", 404);
  }

  return {
    id: browserData.cbid,
    email: userEmail,
    name: userName || null,
    role: userRole || "user",
    image: userImage || null, // Google profile picture, if signed in with Google
  };
}

export async function getUserOrders(): Promise<Order[]> {
  const browserData = getSession();

  if (!browserData.cbid) {
    throw new ApiError("User not authenticated", 401);
  }

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browserData.token}`,
    },
  };

  const response = await fetch(`${API_BASE_URL}/orders?user.id=${browserData.cbid}`, requestOptions);

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

// REQ-1617: single order + its status-change timeline, for the customer-facing
// order detail page (`/orders/:id`). Ownership-checked server-side.
export async function getOrderDetail(orderId: string): Promise<OrderWithTimeline> {
  const browserData = getSession();

  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${browserData.token}`,
    },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}

// REQ-1640: on-demand invoice PDF, shared by both the customer order detail
// page and the admin order detail page (same endpoint — ownership-checked
// server-side, so an admin's own token is accepted for any order). Triggers a
// real browser download instead of returning JSON like every other call here.
export async function downloadOrderInvoice(orderId: string): Promise<void> {
  const browserData = getSession();

  if (!browserData.token) {
    throw new ApiError("User not authenticated", 401);
  }

  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`, {
    method: "GET",
    headers: { Authorization: `Bearer ${browserData.token}` },
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(errorMessage, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

interface PaymentInfo {
  paymentIntentId?: string;
  paymentStatus?: string;
}

interface OrderUserInput {
  id?: string;
  name?: string | null;
  email?: string;
}

interface StockUpdateResultEntry {
  productId: string;
  productName: string;
  quantity: number;
  newStock?: number | null;
  success: boolean;
  error?: string;
  shouldTriggerLowStockAlert?: boolean;
  lowStockThreshold?: number;
}

// Mirrors backend/src/services/orders.service.ts's OrderWithStockMeta — the
// create-order response includes stock-side-effect metadata beyond the plain Order.
export interface OrderWithStockMeta extends Order {
  _stockUpdates?: StockUpdateResultEntry[];
  _lowStockAlerts?: Array<{
    productId: string;
    productName: string;
    currentStock: number | null | undefined;
    lowStockThreshold: number | undefined;
  }>;
}

export async function createOrder(
  cartList: CartItem[],
  total: number,
  user: OrderUserInput,
  paymentInfo: PaymentInfo = {},
  shippingAddress?: OrderShippingAddress
): Promise<OrderWithStockMeta> {
  const browserData = getSession();

  // REQ-1659: a guest checkout has no session at all — the caller (guest
  // flow in PaymentSuccessPage) always supplies an explicit user.id (the
  // synthetic id minted by create-intent) in that case, so only require a
  // real session when the caller didn't already provide one.
  if (!browserData.cbid && !user.id) {
    throw new ApiError("User not authenticated", 401);
  }

  // Calculate total quantity (sum of all item quantities)
  const totalQuantity = cartList.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Ensure cartList items have quantity field (for backward compatibility)
  const cartListWithQuantities = cartList.map((item) => ({
    ...item,
    quantity: item.quantity || 1, // Ensure quantity exists, default to 1
  }));

  const orderUser: OrderUserSnapshot = {
    name: user.name ?? undefined,
    email: user.email,
    // Guaranteed non-null by the guard above (user.id or browserData.cbid).
    id: (user.id || browserData.cbid)!,
  };

  const order = {
    cartList: cartListWithQuantities, // Include quantities in each item
    amount_paid: total,
    quantity: totalQuantity, // Total number of items (sum of all quantities)
    user: orderUser,
    // Include payment information if provided
    ...(paymentInfo.paymentIntentId && { paymentIntentId: paymentInfo.paymentIntentId }),
    ...(paymentInfo.paymentStatus && { paymentStatus: paymentInfo.paymentStatus }),
    // REQ-1620: customer's selected saved address, if any (checkout never requires one)
    ...(shippingAddress && { shippingAddress }),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (browserData.token) headers.Authorization = `Bearer ${browserData.token}`;

  const requestOptions: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(order),
  };

  const response = await fetch(`${API_BASE_URL}/orders`, requestOptions);

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || response.statusText;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(errorMessage, response.status);
  }

  return response.json();
}
