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
export { createTicket, getTickets, getTicket, replyToTicket, updateTicketStatus } from "./ticketService";
export { getAddresses, createAddress, updateAddress, deleteAddress } from "./addressService";
export type { AddressInput } from "./addressService";
