/**
 * CartCard Component
 *
 * Modern cart item card with quantity controls, product info, and remove action.
 * Uses ShadCN UI components for consistent design.
 *
 * Features:
 * - Product image with link to product detail
 * - Product name and details
 * - Quantity controls (increase/decrease)
 * - Price display (unit price and total)
 * - Remove button with icon
 * - Badge for best seller/featured status
 */

import { Link } from "react-router-dom";
import { useMemo } from "react";
import type { SyntheticEvent } from "react";
import { Trash2, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useCart } from "../../../context";
import {
  getProductImageUrl,
  getProductImageKey,
} from "../../../utils/productImage";
import { formatPrice } from "../../../utils/formatPrice";
import { Card, StatusBadge, QuantityInput } from "../../../components/ui";
import type { CartItem } from "../../../types";

interface CartCardProps {
  product: CartItem;
}

export const CartCard = ({ product }: CartCardProps) => {
  const { removeFromCart, updateQuantity } = useCart();

  // Memoize calculations for performance (hooks must be called unconditionally)
  const quantity = useMemo(() => product?.quantity || 1, [product?.quantity]);
  const unitPrice = useMemo(() => product?.price || 0, [product?.price]);
  const itemTotal = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (product && product.id) {
      updateQuantity(product, newQuantity);
    }
  };

  // Validate product - return null after hooks
  if (!product || !product.id) {
    return null; // Don't render if product is invalid
  }

  return (
    <Card className="mb-4 p-4 sm:p-6 relative">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-stretch">
        {/* Product Image */}
        <Link
          to={`/products/${product.id}`}
          className="flex-shrink-0 w-full sm:w-48 md:w-64"
        >
          {getProductImageUrl(product) && (
            <img
              key={getProductImageKey(product)}
              className="w-full h-auto sm:w-48 md:w-64 sm:h-full rounded-lg object-cover border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
              src={getProductImageUrl(product) || undefined}
              alt={product.name || "Product"}
              loading="lazy"
              onError={(e: SyntheticEvent<HTMLImageElement>) => {
                // Fallback if image fails to load
                const target = e.target as HTMLImageElement;
                if (product.poster && target.src !== product.poster) {
                  target.src = product.poster;
                } else {
                  target.style.display = "none";
                }
              }}
            />
          )}
        </Link>

        {/* Product Details */}
        <div className="flex-1 min-w-0 w-full flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0 w-full">
              <Link to={`/products/${product.id}`}>
                <h3 className="text-base sm:text-lg font-medium text-gray-700 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors mb-1 w-full">
                  {product.name || "N/A"}
                </h3>
              </Link>
              {product.overview && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 w-full">
                  {product.overview}
                </p>
              )}
            </div>

            {/* Remove Button - Desktop: top right corner */}
            <button
              onClick={() => removeFromCart(product)}
              className="hidden sm:flex flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              aria-label="Remove from cart"
            >
              <Trash2 className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          {/* Product Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {product.best_seller && (
              <StatusBadge
                status="best_seller"
                customLabels={{ best_seller: "Best Seller" }}
              />
            )}
            {(product.featured_product === 1 ||
              (product.featured_product as unknown) === true) && (
              <StatusBadge
                status="featured"
                customLabels={{ featured: "Featured" }}
              />
            )}
            {/* Stock Quantity Badge - Show detailed stock info if available */}
            {product.stock !== undefined ? (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  product.stock === 0
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    : product.stock! <= (product.lowStockThreshold || 10)
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                }`}
              >
                {(() => {
                  const isOut = product.stock === 0;
                  const isLow = !isOut && product.stock! <= (product.lowStockThreshold || 10);
                  const StockIcon = isOut ? XCircle : isLow ? AlertTriangle : CheckCircle2;
                  return <StockIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />;
                })()}
                {product.stock === 0
                  ? "Out of Stock"
                  : product.stock! <= (product.lowStockThreshold || 10)
                    ? `Low Stock (${product.stock} left)`
                    : `${product.stock} in stock`}
              </span>
            ) : (
              // Fallback to in_stock boolean if stock quantity not available
              !product.in_stock && (
                <StatusBadge
                  status="out_of_stock"
                  customLabels={{ out_of_stock: "Out of Stock" }}
                />
              )
            )}
          </div>

          {/* Quantity Controls and Price */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-auto">
            {/* Quantity Controls with Delete Button */}
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quantity:
                </label>
                <QuantityInput
                  value={quantity}
                  onChange={handleQuantityChange}
                  min={1}
                  max={
                    product.stock !== undefined
                      ? product.stock
                      : product.in_stock
                        ? undefined
                        : quantity
                  } // Use stock quantity if available, otherwise fallback to in_stock
                  disabled={
                    product.stock !== undefined
                      ? product.stock === 0
                      : !product.in_stock
                  } // Disable if stock is 0 or in_stock is false
                />
              </div>

              {/* Remove Button - Mobile: in same row with quantity */}
              <button
                onClick={() => removeFromCart(product)}
                className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors sm:hidden"
                aria-label="Remove from cart"
              >
                <Trash2 className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {/* Price Display */}
            <div className="flex flex-col items-start sm:items-end gap-1">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                ${formatPrice(unitPrice)} each
              </div>
              <div className="text-base sm:text-xl font-medium text-gray-700 dark:text-white">
                ${formatPrice(itemTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
