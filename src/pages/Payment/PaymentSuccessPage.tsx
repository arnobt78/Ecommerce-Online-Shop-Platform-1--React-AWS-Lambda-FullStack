/**
 * Payment Success Page
 *
 * Displays payment confirmation after successful Stripe payment.
 * Creates order in database and clears cart.
 * Uses React Query for payment verification and order creation.
 * Implements proper caching with Infinity staleTime for payment status.
 */

import { useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "../../lib/toast";
import { useCart } from "../../context";
import { useUser } from "../../hooks/useUser";
import { usePaymentStatus } from "../../hooks/usePayment";
import { createOrder, sendOrderConfirmationEmail, sendAdminNewOrderEmail, sendAdminOutOfStockEmail, sendAdminLowStockEmail } from "../../services";
import type { OrderWithStockMeta } from "../../services/dataService";
import { invalidateAfterOrderCreation } from "../../utils/queryInvalidation";
import { Card, PageHeader, LoadingState, ErrorState } from "../../components/ui";
import { formatPrice } from "../../utils/formatPrice";
import type { CartItem, OrderShippingAddress } from "../../types";

interface CreateOrderVariables {
  cartList: CartItem[];
  total: number;
  user: { id?: string; email?: string; name?: string | null };
  paymentInfo: { paymentIntentId?: string; paymentStatus?: string };
  shippingAddress?: OrderShippingAddress;
}

export const PaymentSuccessPage = () => {
  const location = useLocation() as { state?: { paymentIntentId?: string; shippingAddress?: OrderShippingAddress } };
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cartList, total, clearCart } = useCart();
  const { data: user, error: userError } = useUser();

  const orderCreatedRef = useRef(false); // Use ref to track order creation without triggering re-renders

  // Get payment intent ID from URL params or location state
  const paymentIntentId = searchParams.get("payment_intent") || location.state?.paymentIntentId || searchParams.get("payment_intent_client_secret")?.split("_secret")[0];

  const { data: paymentData, isLoading: paymentLoading, error: paymentError } = usePaymentStatus(paymentIntentId, !!paymentIntentId && !!user?.id);

  // Use refs to capture values without triggering re-runs of the create-order effect
  const cartListRef = useRef(cartList);
  const totalRef = useRef(total);
  const shippingAddressRef = useRef(location.state?.shippingAddress);

  useEffect(() => {
    cartListRef.current = cartList;
    totalRef.current = total;
  }, [cartList, total]);

  const createOrderMutation = useMutation({
    mutationFn: ({ cartList, total, user, paymentInfo, shippingAddress }: CreateOrderVariables) => createOrder(cartList, total, user, paymentInfo, shippingAddress),
    retry: false, // Don't retry automatically - prevent duplicate orders
    onSuccess: (orderData: OrderWithStockMeta) => {
      orderCreatedRef.current = true;
      clearCart();
      const userId = user?.id;

      // Invalidate all relevant queries to ensure UI updates immediately
      invalidateAfterOrderCreation(queryClient, userId ?? null);

      // Explicitly refetch admin products to ensure stock updates are visible
      queryClient.invalidateQueries({ queryKey: ["admin-products"], refetchType: "active" });

      toast.success("Order created successfully!", { closeButton: true, position: "bottom-right" });

      // Send order confirmation email to customer (async, don't block)
      sendOrderConfirmationEmail({
        customerEmail: user?.email ?? "",
        customerName: user?.name ?? undefined,
        orderId: orderData.id,
        items: cartListRef.current.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total: totalRef.current,
        orderDate: new Date().toLocaleDateString(),
      }).catch((emailError) => {
        // Log email error but don't show to user (non-critical)
        console.error("Failed to send order confirmation email:", emailError);
      });

      // Send admin alert email (async, don't block)
      const totalQuantity = cartListRef.current.reduce((sum, item) => sum + (item.quantity || 1), 0);

      sendAdminNewOrderEmail({
        orderId: orderData.id,
        customerName: user?.name ?? undefined,
        customerEmail: user?.email,
        total: totalRef.current,
        itemCount: cartListRef.current.length,
        totalQuantity,
        items: cartListRef.current, // Pass items array for detailed display
      }).catch((emailError) => {
        console.error("Failed to send admin new order email:", emailError);
      });

      // Check if any products reached 0 stock and send out-of-stock alert
      orderData._stockUpdates?.forEach((stockUpdate) => {
        if (stockUpdate.success && stockUpdate.newStock === 0) {
          sendAdminOutOfStockEmail({
            productId: stockUpdate.productId,
            productName: stockUpdate.productName,
          }).catch((emailError) => {
            console.error("Failed to send out-of-stock alert email:", emailError);
          });
        }
      });

      // Send low stock alert emails if any products went below threshold
      orderData._lowStockAlerts?.forEach((alert) => {
        sendAdminLowStockEmail({
          productId: alert.productId,
          productName: alert.productName,
          currentStock: alert.currentStock ?? undefined,
          lowStockThreshold: alert.lowStockThreshold,
        }).catch((emailError) => {
          console.error("Failed to send low stock alert email:", emailError);
        });
      });
    },
    onError: (error) => {
      console.error("Error creating order:", error);
      // Don't reset orderCreatedRef on error - prevent retry attempts
      toast.warning("Payment successful, but order creation failed. Please contact support.", { closeButton: true, position: "bottom-right" });
    },
  });

  useEffect(() => {
    // Prevent duplicate order creation
    if (orderCreatedRef.current) return;
    // Don't create if mutation is already in progress
    if (createOrderMutation.isPending) return;

    if (paymentData && paymentData.status === "succeeded" && cartListRef.current.length > 0 && user?.id) {
      // Mark as attempted immediately to prevent duplicate calls
      orderCreatedRef.current = true;
      createOrderMutation.mutate({
        cartList: cartListRef.current,
        total: totalRef.current,
        user,
        paymentInfo: {
          paymentIntentId: paymentData.paymentIntentId,
          paymentStatus: "paid",
        },
        shippingAddress: shippingAddressRef.current,
      });
    }
  }, [paymentData, user?.id, createOrderMutation, user]);

  // Handle loading and error states
  if (!paymentIntentId) {
    return (
      <div className="py-8">
        <ErrorState message="Payment intent ID not found" action={{ label: "Go to Dashboard", onClick: () => navigate("/dashboard") }} />
      </div>
    );
  }

  if (paymentLoading) {
    return (
      <div className="py-8">
        <LoadingState message="Verifying payment..." />
      </div>
    );
  }

  if (paymentError || userError) {
    return (
      <div className="py-8">
        <ErrorState message={paymentError?.message || userError?.message || "Failed to verify payment"} action={{ label: "Go to Dashboard", onClick: () => navigate("/dashboard") }} />
      </div>
    );
  }

  if (paymentData && paymentData.status !== "succeeded") {
    return (
      <div className="py-8">
        <ErrorState message={`Payment status: ${paymentData.status}`} action={{ label: "Go to Dashboard", onClick: () => navigate("/dashboard") }} />
      </div>
    );
  }

  return (
    <div className="py-8">
      <PageHeader title="Payment Successful!" description="Your payment has been processed successfully" />

      <Card className="mt-6">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-medium text-gray-700 dark:text-white mb-2">Thank You for Your Purchase!</h2>
            <p className="text-gray-600 dark:text-gray-400">Your order has been confirmed and payment has been processed.</p>
          </div>

          {paymentData && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Payment Intent ID</p>
                  <p className="font-mono text-sm text-gray-700 dark:text-white">{paymentData.paymentIntentId}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Amount Paid</p>
                  <p className="text-lg font-medium text-gray-700 dark:text-white">{formatPrice(paymentData.amount / 100)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate("/dashboard")} className="px-6 py-3 text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 font-medium rounded-lg transition-colors">
              View Orders
            </button>
            <button onClick={() => navigate("/products")} className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors">
              Continue Shopping
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
