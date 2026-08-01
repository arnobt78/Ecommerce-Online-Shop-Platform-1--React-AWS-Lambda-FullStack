/**
 * Stripe Checkout Component
 *
 * Modern Stripe checkout using latest Payment Element.
 * Replaces the old mock checkout with real Stripe integration.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import type { PaymentIntent } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock, MapPin, Home } from "lucide-react";
import { toast } from "../../../lib/toast";
import { useCart } from "../../../context";
import { useUser, useAddresses } from "../../../hooks/useUser";
import { useCreatePaymentIntent } from "../../../hooks/usePayment";
import { formatPrice } from "../../../utils/formatPrice";
import {
  sendPaymentProcessingEmail,
  sendPaymentFailedEmail,
} from "../../../services";
import {
  Card,
  PageHeader,
  LoadingState,
  FormError,
  ErrorState,
  RippleButton,
} from "../../../components/ui";
import type { SessionUser } from "../../../services/dataService";
import type { Address } from "../../../types";

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUB_KEY ||
    "pk_test_51PxHnCJVFBSIpdSDZSoSMcvdVcqAdO6tCNbxSRElWx6FINtJ3r2vLQT7bneHcrugaC3L2j3WkxbY180HlgGF4Ffm00HecLun2u",
);

interface TestCredential {
  label: string;
  value: string;
}

/**
 * Test Credentials Section Component
 * Displays Stripe test credentials with copy-to-clipboard functionality
 * Uses ShadCN Card and Badge components for consistent styling
 */
function TestCredentialsSection() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Test credentials data
  const testCredentials: TestCredential[] = [
    { label: "Card Number", value: "4242424242424242" },
    { label: "Expiry", value: "12/34" },
    { label: "CVC", value: "123" },
  ];

  /**
   * Copy text to clipboard and show success feedback
   * @param {string} text - Text to copy
   * @param {string} field - Field identifier for visual feedback
   */
  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard!", {
        closeButton: true,
        position: "bottom-right",
        autoClose: 2000,
      });
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy. Please try again.", {
        closeButton: true,
        position: "bottom-right",
      });
    }
  };

  // Render copy icon button
  const renderCopyButton = (credential: TestCredential) => (
    <button
      type="button"
      onClick={() => handleCopy(credential.value, credential.label)}
      className="ml-2 p-1.5 text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
      aria-label={`Copy ${credential.label}`}
    >
      {copiedField === credential.label ? (
        <svg
          className="w-4 h-4 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );

  // Get individual credentials
  const cardNumber = testCredentials.find((c) => c.label === "Card Number");
  const expiry = testCredentials.find((c) => c.label === "Expiry");
  const cvc = testCredentials.find((c) => c.label === "CVC");

  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
          Note: Test Credentials
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200">
          Test Mode
        </span>
      </div>
      <p className="text-xs text-sky-700 dark:text-sky-300 mb-3">
        Use these test credentials to complete payment without entering real
        card details:
      </p>
      <div className="space-y-2">
        {/* Card Number - Full Width */}
        {cardNumber && (
          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
            <div className="flex-1">
              <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                {cardNumber.label}:
              </span>
              <span className="text-sm font-mono text-gray-700 dark:text-white">
                {cardNumber.value}
              </span>
            </div>
            {renderCopyButton(cardNumber)}
          </div>
        )}

        {/* Expiry and CVC - Same Line */}
        <div className="flex items-center gap-3">
          {expiry && (
            <div className="flex-1 flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
              <div className="flex-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                  {expiry.label}:
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-white">
                  {expiry.value}
                </span>
              </div>
              {renderCopyButton(expiry)}
            </div>
          )}
          {cvc && (
            <div className="flex-1 flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
              <div className="flex-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                  {cvc.label}:
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-white">
                  {cvc.value}
                </span>
              </div>
              {renderCopyButton(cvc)}
            </div>
          )}
        </div>
      </div>

      {/* Shipping Address Note */}
      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
        <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
          <strong className="font-medium">Note:</strong> In this demo project,
          we haven't implemented user address collection during checkout. For
          shipping label generation and tracking, we're using fallback test
          addresses. In production, customers would provide their shipping
          address during checkout.
        </p>
      </div>
    </div>
  );
}

interface CheckoutFormProps {
  onSuccess: (paymentIntent: PaymentIntent) => void;
  onCancel: () => void;
}

/**
 * Checkout Form Component
 * Handles payment submission using Stripe Elements
 * @param {Function} onSuccess - Callback when payment succeeds
 * @param {Function} onCancel - Callback when payment is cancelled
 */
function CheckoutForm({ onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // Submit payment to Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: "if_required", // Only redirect if required (3D Secure, etc.)
      });

      if (error) {
        setMessage(error.message || null);
        toast.error(error.message, {
          closeButton: true,
          position: "bottom-right",
        });
        setIsProcessing(false);
        return;
      }

      // Payment succeeded
      if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent);
      } else {
        // Payment requires additional action (3D Secure, etc.)
        // Stripe will handle redirect automatically
        setMessage("Processing payment...");
      }
    } catch (err) {
      console.error("Payment error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during payment";
      setMessage(errorMessage);
      toast.error(errorMessage, {
        closeButton: true,
        position: "bottom-right",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        options={{
          layout: "tabs", // Modern tabbed layout
        }}
      />

      {message && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <FormError message={message} />
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <RippleButton
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-3 text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <span className="inline-block animate-spin mr-2">⏳</span>
              Processing...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-2 inline" strokeWidth={2} fill="currentColor" />Pay Now
            </>
          )}
        </RippleButton>
      </div>
    </form>
  );
}

interface StripeCheckoutProps {
  setCheckout: Dispatch<SetStateAction<boolean>>;
}

/**
 * Main Stripe Checkout Component
 * Displays Stripe Payment Element in a modal overlay
 * Uses React Query for payment intent creation with proper caching
 * @param {Function} setCheckout - Function to close checkout modal
 */
export const StripeCheckout = ({ setCheckout }: StripeCheckoutProps) => {
  const { cartList, total } = useCart();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const {
    data: user = {} as SessionUser,
    error: userError,
    isLoading: userLoading,
  } = useUser();
  const paymentIntentCreatedRef = useRef(false); // Track if payment intent was created

  // REQ-1620: optional saved-address selection — never blocks checkout (this
  // storefront delivers digital downloads; a shipping address only feeds the
  // admin's optional physical-label/tracking demo feature).
  const { data: addresses = [] } = useAddresses();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const selectedAddressIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedAddressId !== null || addresses.length === 0) return;
    const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
    if (defaultAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding a user-editable selection from an async fetch, same pattern as TicketDetailPage's status dropdown
      setSelectedAddressId(defaultAddress.id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    selectedAddressIdRef.current = selectedAddressId;
  }, [selectedAddressId]);

  // Use React Query hook for payment intent creation
  const createPaymentIntentMutation = useCreatePaymentIntent({
    onSuccess: (data) => {
      if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
        paymentIntentCreatedRef.current = true;

        // Send payment processing email to customer (async, don't block)
        if (user?.email && user?.id) {
          sendPaymentProcessingEmail({
            customerEmail: user.email,
            customerName: user.name || "Customer",
            orderId: data?.paymentIntentId || "pending",
            amount: total,
          }).catch((emailError) => {
            console.error(
              "Failed to send payment processing email:",
              emailError,
            );
          });
        }
      } else {
        console.error("No clientSecret in response:", data);
        toast.error("Payment initialization failed. Please try again.", {
          closeButton: true,
          position: "bottom-right",
        });
        setCheckout(false);
      }
    },
    onError: (error) => {
      console.error("Payment intent creation error:", error);
      // Reset ref on error so user can try again if they want
      paymentIntentCreatedRef.current = false;

      // Send payment failed email to customer (async, don't block)
      if (user?.email && user?.id) {
        sendPaymentFailedEmail({
          customerEmail: user.email,
          customerName: user.name || "Customer",
          orderId: "pending",
          amount: total,
        }).catch((emailError) => {
          console.error("Failed to send payment failed email:", emailError);
        });
      }

      // Error toast is already shown by the hook
      // Don't close checkout immediately - let user see the error and retry
    },
  });

  // Get clientSecret from mutation data if state hasn't updated yet
  const effectiveClientSecret =
    clientSecret || createPaymentIntentMutation.data?.clientSecret;

  // Show error toast if user fetch fails
  useEffect(() => {
    if (userError) {
      toast.error(userError.message, {
        closeButton: true,
        position: "bottom-right",
      });
      setCheckout(false);
    }
  }, [userError, setCheckout]);

  // Create payment intent on mount - use refs to capture values
  const userRef = useRef(user);
  const cartListRef = useRef(cartList);
  const totalRef = useRef(total);

  // Update refs when values change
  useEffect(() => {
    userRef.current = user;
    cartListRef.current = cartList;
    totalRef.current = total;
  }, [user, cartList, total]);

  // Create payment intent once user data is loaded
  useEffect(() => {
    // Wait for user data to load
    if (userLoading) {
      return; // Don't proceed if user is still loading
    }

    // Prevent duplicate payment intent creation
    if (paymentIntentCreatedRef.current) {
      return;
    }

    // Don't create if mutation is already in progress or has failed
    if (
      createPaymentIntentMutation.isPending ||
      createPaymentIntentMutation.isError
    ) {
      return;
    }

    // Validate user is logged in
    if (!userRef.current.id || !userRef.current.email) {
      toast.error("Please log in to continue", {
        closeButton: true,
        position: "bottom-right",
      });
      setCheckout(false);
      return;
    }

    if (cartListRef.current.length === 0) {
      toast.error("Your cart is empty", {
        closeButton: true,
        position: "bottom-right",
      });
      setCheckout(false);
      return;
    }

    if (totalRef.current <= 0) {
      toast.error("Invalid order total", {
        closeButton: true,
        position: "bottom-right",
      });
      setCheckout(false);
      return;
    }

    // Create payment intent using React Query mutation (only once)
    paymentIntentCreatedRef.current = true; // Mark as attempted immediately
    createPaymentIntentMutation.mutate({
      cartList: cartListRef.current,
    });
    // Note: createPaymentIntentMutation and setCheckout are stable (from React Query and useState),
    // so including them in dependencies won't cause unnecessary re-runs
  }, [userLoading, createPaymentIntentMutation, setCheckout]);

  const handlePaymentSuccess = (paymentIntent: PaymentIntent) => {
    const selectedAddress = addresses.find((a) => a.id === selectedAddressIdRef.current);

    // Navigate to success page with payment intent ID
    navigate("/payment-success", {
      state: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        ...(selectedAddress && {
          shippingAddress: {
            label: selectedAddress.label,
            fullName: selectedAddress.fullName,
            street1: selectedAddress.street1,
            street2: selectedAddress.street2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zip: selectedAddress.zip,
            country: selectedAddress.country,
            phone: selectedAddress.phone,
          },
        }),
      },
    });
  };

  const handleCancel = () => {
    setCheckout(false);
  };

  // Detect dark mode - memoized to avoid recalculation (must be before early return)
  const isDarkMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }, []);

  // Stripe Elements options - memoized to prevent recreation (must be before early return)
  const options = useMemo(
    () => ({
      clientSecret: effectiveClientSecret,
      appearance: {
        theme: isDarkMode ? ("night" as const) : ("stripe" as const), // Auto-detect dark mode
        variables: {
          colorPrimary: "#2563eb",
          colorBackground: isDarkMode ? "#1f2937" : "#ffffff",
          colorText: isDarkMode ? "#f9fafb" : "#1f2937",
          colorDanger: "#ef4444",
          fontFamily: "system-ui, sans-serif",
          spacingUnit: "4px",
          borderRadius: "8px",
        },
      },
    }),
    [effectiveClientSecret, isDarkMode],
  );

  // Show error if mutation failed
  if (createPaymentIntentMutation.isError) {
    return (
      <section>
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40"></div>
        <div className="fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-full flex justify-center items-center p-4">
          <Card className="p-8 max-w-md w-full">
            <ErrorState
              message={
                createPaymentIntentMutation.error?.message ||
                "Failed to initialize payment"
              }
              action={{
                label: "Close",
                onClick: () => setCheckout(false),
              }}
            />
          </Card>
        </div>
      </section>
    );
  }

  // Loading state - use reusable LoadingState component (after all hooks)
  // Only show loading if we're actually loading AND don't have clientSecret yet
  // Use effectiveClientSecret to check both state and mutation data
  const isLoading =
    userLoading ||
    (createPaymentIntentMutation.isPending && !effectiveClientSecret) ||
    (!createPaymentIntentMutation.isSuccess &&
      !createPaymentIntentMutation.isError &&
      !effectiveClientSecret);

  if (isLoading) {
    return (
      <section>
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40"></div>
        <div className="fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-full flex justify-center items-center p-4">
          <Card className="p-8 max-w-md w-full">
            <LoadingState
              message={
                userLoading
                  ? "Loading user data..."
                  : createPaymentIntentMutation.isPending
                    ? "Creating payment intent..."
                    : "Initializing payment..."
              }
            />
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40"
        onClick={handleCancel}
      ></div>

      {/* Modal */}
      <div className="fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-full flex justify-center items-center p-4">
        <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <PageHeader
                title="Complete Payment"
                description="Secure payment powered by Stripe"
              />
              <button
                onClick={handleCancel}
                type="button"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Order Summary */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {/* Header with Order Summary and Items count */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-md font-medium text-gray-600 dark:text-gray-400">
                    Order Summary
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <span>Items ({cartList.length})</span>
                  {(() => {
                    const totalQuantity = cartList.reduce(
                      (sum, item) => sum + (item.quantity || 1),
                      0,
                    );
                    return totalQuantity !== cartList.length ? (
                      <span className="text-gray-500 dark:text-gray-500">
                        • Quantity ({totalQuantity})
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Individual Items List */}
              <div className="space-y-2 text-sm mb-3">
                {cartList.map((item, index) => {
                  const itemQuantity = item.quantity || 1;
                  const itemPrice = item.price || 0;
                  const itemTotal = itemPrice * itemQuantity;
                  const itemName =
                    item.name ||
                    (item as typeof item & { productName?: string })
                      .productName ||
                    "Product";
                  // Badge shows only item number
                  const badgeText = `${index + 1}`;

                  return (
                    <div
                      key={item.id || index}
                      className="flex justify-between items-start py-1"
                    >
                      <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                        {/* Item Number Badge - ShadCN Style */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-sky-800 dark:bg-blue-900 dark:text-sky-200 flex-shrink-0">
                          {badgeText}
                        </span>
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className="text-gray-700 dark:text-white">
                            {itemName}
                          </span>
                          {itemQuantity > 1 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              Qty: {itemQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-700 dark:text-white font-medium whitespace-nowrap">
                        {formatPrice(itemTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex justify-between font-medium text-lg pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-700 dark:text-white">Total</span>
                <span className="text-gray-700 dark:text-white">
                  {formatPrice(total)}
                </span>
              </div>
            </div>

            {/* Shipping Address — REQ-1620, optional (digital delivery; feeds the admin tracking/label demo) */}
            {addresses.length > 0 && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" strokeWidth={2} />
                  <span className="text-sm font-medium text-gray-700 dark:text-white">Shipping Address (optional)</span>
                </div>
                <select
                  value={selectedAddressId || ""}
                  onChange={(e) => setSelectedAddressId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="">None</option>
                  {addresses.map((address: Address) => (
                    <option key={address.id} value={address.id}>
                      {address.label || "Address"} — {address.street1}, {address.city}
                    </option>
                  ))}
                </select>
                {selectedAddressId &&
                  (() => {
                    const selected = addresses.find((a) => a.id === selectedAddressId);
                    if (!selected) return null;
                    return (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Home className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />
                        <span>
                          {selected.fullName}, {selected.street1}
                          {selected.street2 ? `, ${selected.street2}` : ""}, {selected.city}, {selected.state} {selected.zip}
                        </span>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Test Credentials */}
            <TestCredentialsSection />

            {/* Stripe Payment Element */}
            {effectiveClientSecret && (
              <Elements stripe={stripePromise} options={options}>
                <CheckoutForm
                  onSuccess={handlePaymentSuccess}
                  onCancel={handleCancel}
                />
              </Elements>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};
