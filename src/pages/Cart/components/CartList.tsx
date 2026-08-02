/**
 * CartList Component
 *
 * Displays cart items list with modern UI using ShadCN components.
 * Shows total amount and checkout button.
 */

import { useState, useMemo } from "react";
import { ArrowRight, Tag, X } from "lucide-react";
import { useCart } from "../../../context";
import { CartCard } from "./CartCard";
import { StripeCheckout } from "./StripeCheckout";
import { formatPrice } from "../../../utils/formatPrice";
import { Card, PageHeader, RippleButton } from "../../../components/ui";
import { useValidateCoupon } from "../../../hooks/useCoupon";
import type { CouponValidationResult } from "../../../services/couponService";

export const CartList = () => {
  const [checkout, setCheckout] = useState(false);
  const { cartList, total } = useCart();

  // REQ-1658: coupon applied at checkout — re-validated server-side (never
  // trusted as-is) again at both create-intent and order-creation time.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const validateCouponMutation = useValidateCoupon();

  const handleApplyCoupon = () => {
    if (!couponInput.trim()) return;
    validateCouponMutation.mutate(
      { code: couponInput.trim(), subtotalCents: Math.round(total * 100) },
      { onSuccess: (result) => setAppliedCoupon(result) },
    );
  };
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    validateCouponMutation.reset();
  };

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmountCents / 100 : 0;
  const finalTotal = Math.max(0, total - discountAmount);

  // Calculate total items count (sum of all quantities)
  const totalItems = useMemo(() => {
    return cartList.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cartList]);

  return (
    <>
      <div className="py-6">
        {/* Page Header */}
        <PageHeader
          title={`My Cart (${totalItems} ${
            totalItems === 1 ? "item" : "items"
          })`}
          description="Review your items before checkout"
        />

        {/* Cart Items */}
        <div className="mt-6">
          {cartList.map((product) => (
            <CartCard key={product.id} product={product} />
          ))}
        </div>

        {/* Coupon Code — REQ-1658 */}
        <Card className="mt-6">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
            <p className="text-sm font-medium text-gray-700 dark:text-white">Have a coupon code?</p>
          </div>
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 mt-2">
              <span className="text-sm text-green-800 dark:text-green-300">
                <strong>{appliedCoupon.code}</strong> applied — {appliedCoupon.type === "percent" ? `${appliedCoupon.value}% off` : `$${appliedCoupon.value.toFixed(2)} off`}
              </span>
              <button type="button" onClick={handleRemoveCoupon} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200">
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={validateCouponMutation.isPending || !couponInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {validateCouponMutation.isPending ? "Checking..." : "Apply"}
              </button>
            </div>
          )}
          {validateCouponMutation.isError && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{validateCouponMutation.error.message}</p>
          )}
        </Card>

        {/* Order Summary */}
        <Card className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <p className="text-lg font-medium text-gray-700 dark:text-white mb-1">
                Total Amount
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                {appliedCoupon && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 line-through">${formatPrice(total)}</div>
                )}
                <div className="text-2xl font-medium text-gray-700 dark:text-white">
                  ${formatPrice(finalTotal)}
                </div>
              </div>
              <RippleButton
                onClick={() => setCheckout(true)}
                type="button"
                className="flex items-center gap-2 px-6 py-3 text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 font-medium rounded-lg transition-colors"
              >
                <span>PLACE ORDER</span>
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </RippleButton>
            </div>
          </div>
        </Card>
      </div>

      {checkout && <StripeCheckout setCheckout={setCheckout} couponCode={appliedCoupon?.code} />}
    </>
  );
};
