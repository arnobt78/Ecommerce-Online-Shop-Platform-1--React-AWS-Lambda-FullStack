/**
 * CartList Component
 *
 * Displays cart items list with modern UI using ShadCN components.
 * Shows total amount and checkout button.
 */

import { useState, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useCart } from "../../../context";
import { CartCard } from "./CartCard";
import { StripeCheckout } from "./StripeCheckout";
import { formatPrice } from "../../../utils/formatPrice";
import { Card, PageHeader, RippleButton } from "../../../components/ui";

export const CartList = () => {
  const [checkout, setCheckout] = useState(false);
  const { cartList, total } = useCart();

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
                <div className="text-2xl font-medium text-gray-700 dark:text-white">
                  ${formatPrice(total)}
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

      {checkout && <StripeCheckout setCheckout={setCheckout} />}
    </>
  );
};
