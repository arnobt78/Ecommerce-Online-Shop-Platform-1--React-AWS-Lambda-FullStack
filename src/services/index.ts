export { login, register, logout, getDemoAccounts, demoLogin } from "./authService";
export { getUser, getUserOrders, getOrderDetail, createOrder, downloadOrderInvoice } from "./dataService";
export { getProductList, getProduct } from "./productService";
export {
  getAllOrders,
  getAllProducts,
  getAllUsers,
  getAdminStats,
  createProduct,
  updateProduct,
  deleteProduct,
  updateOrderStatus,
  getOrderById,
  refundOrder,
  generateShippingLabel,
  addTrackingNumber,
  updateUser,
  deleteUser,
  getUserById,
  getActivityLogs,
} from "./adminService";
export { createPaymentIntent, verifyPaymentStatus } from "./paymentService";
export {
  sendEmail,
  sendOrderConfirmationEmail,
  sendShippingNotificationEmail,
  sendDeliveryConfirmationEmail,
  sendPaymentProcessingEmail,
  sendPaymentFailedEmail,
  sendOrderCanceledEmail,
  sendOrderRefundedEmail,
  sendAdminNewOrderEmail,
  sendAdminLowStockEmail,
  sendAdminOutOfStockEmail,
  sendAdminPaymentFailureEmail,
  sendAdminRefundProcessedEmail,
} from "./emailService";
export { uploadImage, deleteImage, getOptimizedImageUrl } from "./imageService";
export { getNotificationCount, markNotificationsRead } from "./notificationService";
export {
  createTicket,
  getTickets,
  getTicket,
  replyToTicket,
  updateTicketStatus,
  updateTicketPriority,
  generateTicketReplyDraft,
} from "./ticketService";
export type { CreateTicketInput, TicketReplyDraftResult } from "./ticketService";
export { getAddresses, createAddress, updateAddress, deleteAddress } from "./addressService";
export type { AddressInput } from "./addressService";
export { getWishlist, addToWishlist, removeFromWishlist } from "./wishlistService";
export type { WishlistEntry } from "./wishlistService";
export { validateCoupon, getAllCoupons, createCoupon, updateCoupon, deleteCoupon } from "./couponService";
export type { Coupon, CouponValidationResult, CreateCouponInput } from "./couponService";
export { getMyReturns, createReturnRequest, getAllReturns, approveReturn, rejectReturn } from "./returnService";
export type { ReturnRequest, ReturnStatus } from "./returnService";
export { subscribeToStockAlert } from "./stockAlertService";
export { getGuestOrder } from "./guestOrderService";
export type { GuestOrderResult } from "./guestOrderService";
