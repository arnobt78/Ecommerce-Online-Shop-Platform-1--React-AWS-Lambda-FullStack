// Parent: REQ-1302
// Single-source domain DTOs for the frontend. Mirrors backend/prisma/schema.prisma
// field-for-field (no frontend/backend shared package exists, so these are kept
// in sync by hand — see docs/PROJECT_WALKTHROUGH.md §4 for the source of truth).
// Every hook/service/component should import these instead of re-declaring
// ad hoc shapes.

export interface Product {
  id: string;
  name: string;
  author?: string | null;
  category?: string | null;
  level?: string | null;
  pages?: number | null;
  price: number;
  overview?: string | null;
  long_description?: string | null;
  image_local?: string | null;
  poster?: string | null;
  in_stock: boolean;
  stock?: number | null;
  lowStockThreshold?: number | null;
  best_seller: boolean;
  featured_product: 0 | 1;
  rating?: number | null;
  size?: number | null;
  qrCode?: string | null;
  // REQ-1616: catalog/inventory metadata
  sku?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  language?: string | null;
  edition?: string | null;
  fileFormat?: string | null;
  // Optional/nullable rather than a required array: rows seeded/cached before
  // this field existed (including entries already sitting in a user's
  // persisted localStorage query cache) may genuinely lack it at runtime.
  tags?: string[] | null;
  // Cover art / trailer pass — optional, additive. Absent on rows seeded before
  // this field existed, so every consumer must fall back to the flat image /
  // hide the video block when null (see BookCover / ProductVideo).
  coverColor?: string | null;
  videoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  image?: string | null;
  googleId?: string | null;
  emailVerified?: string | null;
  notificationsReadAt?: string | null;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Parent: REQ-1618 — customer address book.
export interface Address {
  id: string;
  userId: string;
  label?: string | null;
  fullName: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderUserSnapshot {
  id: string;
  name?: string;
  email?: string;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";

// Parent: REQ-1620 — snapshot of the customer's selected saved Address,
// captured at checkout time (deliberately not a live reference: the order
// must keep its own copy even if the source Address is later edited/deleted).
export interface OrderShippingAddress {
  label?: string | null;
  fullName: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string | null;
}

export interface Order {
  id: string;
  userId: string;
  user: OrderUserSnapshot;
  cartList: CartItem[];
  amount_paid: number;
  quantity: number;
  status: OrderStatus;
  paymentIntentId?: string | null;
  paymentStatus?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  labelUrl?: string | null;
  shippingAddress?: OrderShippingAddress | null;
  refundId?: string | null;
  refundAmount?: number | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Parent: REQ-1618 — GET /admin/users/:id embeds this user's order history
// and address book in the same response (avoids two extra admin round-trips).
// Optional/nullable rather than required arrays: a persisted query-cache
// entry from before this field existed may genuinely lack it at runtime
// (same class of issue as Product.tags, REQ-1616).
export interface AdminUserDetail extends User {
  orders?: Order[] | null;
  addresses?: Address[] | null;
}

// REQ-1617: GET /orders/:id embeds the order's status-change timeline
// (derived from ActivityLog, see backend/src/services/activityLog.service.ts)
// in the same response — one network call for the customer order detail page.
export interface OrderWithTimeline extends Order {
  timeline: ActivityLog[];
}

export type ReviewStatus = "approved" | "pending" | "rejected";

export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId: string;
  rating: number;
  comment: string;
  userName: string;
  userEmail: string;
  status: ReviewStatus;
  // REQ-1619: public seller response to a review
  adminReply?: string | null;
  adminReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "billing" | "technical" | "refund" | "account" | "other";

export interface Ticket {
  id: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  subject: string;
  status: TicketStatus;
  // REQ-1619: triage metadata
  priority: TicketPriority;
  category: TicketCategory;
  orderId?: string | null;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// Parent: REQ-1305 — discriminated union for API results, used by services
// that need to distinguish success/failure without throwing (most services
// throw and let TanStack Query's error state handle it, but this is available
// for call sites that want an explicit result type instead).
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
