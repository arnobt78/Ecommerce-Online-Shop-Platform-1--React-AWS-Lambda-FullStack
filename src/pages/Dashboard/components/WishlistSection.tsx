/**
 * Wishlist Section (REQ-1656)
 *
 * Customer-facing "My Wishlist" on the Dashboard — lists saved products with
 * a quick Add to Cart / Remove. Mirrors AddressBook's Card layout for a
 * consistent Dashboard look.
 */

import { Link } from "react-router-dom";
import { Heart, ShoppingCart, X } from "lucide-react";
import { useWishlist, useRemoveFromWishlist } from "../../../hooks/useWishlist";
import { useCart } from "../../../context";
import { Card, LoadingState } from "../../../components/ui";
import { getProductImageUrl, getProductImageKey } from "../../../utils/productImage";

export const WishlistSection = () => {
  const { data: wishlist = [], isLoading } = useWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const { cartList, addToCart } = useCart();

  if (isLoading) {
    return (
      <Card className="mb-6 p-4 sm:p-6">
        <LoadingState message="Loading wishlist..." />
      </Card>
    );
  }

  if (wishlist.length === 0) return null;

  return (
    <Card className="mb-6 p-4 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-white">
        <Heart className="h-5 w-5 text-red-500" strokeWidth={2} fill="currentColor" />
        My Wishlist ({wishlist.length})
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wishlist.map((entry) => {
          const product = entry.product;
          const inCart = cartList.some((item) => item.id === product.id);
          const imageUrl = getProductImageUrl(product);
          return (
            <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {imageUrl && (
                <img
                  key={getProductImageKey(product)}
                  src={imageUrl}
                  alt={product.name}
                  className="h-14 w-14 shrink-0 rounded object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <Link to={`/products/${product.id}`} className="truncate text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
                  {product.name}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400">${product.price?.toFixed(2)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!inCart && (
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={!product.in_stock}
                    aria-label="Add to cart"
                    className="rounded-full p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    <ShoppingCart className="h-4 w-4" strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeFromWishlistMutation.mutate(product.id)}
                  disabled={removeFromWishlistMutation.isPending}
                  aria-label="Remove from wishlist"
                  className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
