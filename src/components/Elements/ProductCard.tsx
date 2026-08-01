import { useEffect } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { User, XCircle, AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useCart } from "../../context";
import { Rating } from "./Rating";
import { RippleButton } from "../ui/ripple-button";
import { BookCover } from "../ui/book-cover";
import {
  getProductImageUrl,
  getProductImageKey,
} from "../../utils/productImage";
import type { Product } from "../../types";

interface ProductCardProps {
  product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const { cartList, addToCart, removeFromCart } = useCart();
  const [inCart, setInCart] = useState(false);
  const { id, name, author, overview, price, rating, best_seller } = product;
  const productImageUrl = getProductImageUrl(product);
  const queryClient = useQueryClient();

  // Instant navigation: this card already holds the full Product object (from
  // the list query), so seed ProductDetail's ["product", id] cache directly on
  // hover instead of waiting for a network round-trip after the click lands.
  const seedProductDetailCache = () => {
    queryClient.setQueryData(["product", id], product);
  };

  useEffect(() => {
    const productInCart = cartList.find((item) => item.id === product.id);

    if (productInCart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives in-cart UI state from the CartContext list, which lives outside this component
      setInCart(true);
    } else {
      setInCart(false);
    }
  }, [cartList, product.id]);

  return (
    <div className="m-3 flex h-full max-w-sm flex-col bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
      <Link to={`/products/${id}`} className="relative" onMouseEnter={seedProductDetailCache}>
        {best_seller && (
          <span className="absolute top-4 left-2 px-2 bg-orange-500 bg-opacity-90 text-white rounded">
            Best Seller
          </span>
        )}
        {product.coverColor ? (
          // Book-cover style enrichment (REQ: university-library parity) — falls
          // back to the flat image below for products without a coverColor.
          // Subtle "shelf" gradient + drop shadow under the book, with a gentle
          // lift on hover so the card feels tactile rather than a flat sticker.
          <div className="group/cover flex h-64 w-full items-center justify-center overflow-hidden rounded-t-lg bg-gradient-to-b from-gray-100 to-gray-200 py-5 dark:from-gray-800 dark:to-gray-950">
            <div className="aspect-[143/199] h-full drop-shadow-[0_18px_20px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-out group-hover/cover:-translate-y-1 group-hover/cover:scale-[1.03]">
              <BookCover
                variant="fill"
                coverColor={product.coverColor}
                coverImage={productImageUrl}
                alt={name}
              />
            </div>
          </div>
        ) : (
          productImageUrl && (
            <img
              key={getProductImageKey(product)}
              className="rounded-t-lg w-full h-64 object-cover"
              src={productImageUrl}
              alt={name}
              loading="lazy"
              onError={(e) => {
                // Fallback: try poster if image_local fails, or hide if both fail
                const target = e.target as HTMLImageElement;
                if (
                  product.image_local &&
                  target.src !== product.poster &&
                  product.poster
                ) {
                  target.src = product.poster;
                } else {
                  target.style.display = "none";
                }
              }}
            />
          )
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/products/${id}`} onMouseEnter={seedProductDetailCache}>
          <h5 className="mb-1 text-2xl font-medium tracking-tight text-gray-700 dark:text-white">
            {name}
          </h5>
        </Link>
        {author && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">
            <User className="h-3.5 w-3.5 inline mr-1 -mt-0.5" strokeWidth={2} />
            By {author}
          </p>
        )}
        {/* line-clamp keeps every card the same height regardless of each
            product's overview length (3 lines matches ProductCardSkeleton's
            geometry) instead of the grid row growing to the longest overview. */}
        <p className="mb-3 line-clamp-3 font-normal text-gray-700 dark:text-gray-400">
          {overview}
        </p>

        <div className="flex items-center my-2">
          <Rating rating={rating} />
        </div>

        {/* Stock Quantity Display */}
        {product.stock !== undefined && (
          <div className="mb-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                product.stock === 0
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  : (product.stock as number) <= (product.lowStockThreshold || 10)
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              }`}
            >
              {(() => {
                const isOut = product.stock === 0;
                const isLow = !isOut && (product.stock as number) <= (product.lowStockThreshold || 10);
                const StockIcon = isOut ? XCircle : isLow ? AlertTriangle : CheckCircle2;
                return <StockIcon className="h-3.5 w-3.5 mr-1.5" strokeWidth={2} />;
              })()}
              {product.stock === 0
                ? "Out of Stock"
                : (product.stock as number) <= (product.lowStockThreshold || 10)
                  ? `Low Stock (${product.stock} left)`
                  : `${product.stock} in stock`}
            </span>
          </div>
        )}

        <p className="mt-auto flex justify-between items-center">
          <span className="text-2xl dark:text-gray-200">
            <span>$</span>
            <span>{price}</span>
          </span>
          {!inCart && (
            <RippleButton
              onClick={() => {
                // Prevent adding out-of-stock items
                if (!product.in_stock) {
                  return;
                }
                addToCart(product);
              }}
              className={`inline-flex items-center py-2 px-3 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 ${!product.in_stock ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={!product.in_stock}
            >
              Add To Cart <Plus className="ml-1 h-4 w-4" strokeWidth={2} />
            </RippleButton>
          )}
          {inCart && (
            <button
              onClick={() => removeFromCart(product)}
              className="inline-flex items-center py-2 px-3 text-sm font-medium text-center text-white bg-red-600 rounded-lg hover:bg-red-800"
            >
              Remove Item <Trash2 className="ml-1 h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </p>
      </div>
    </div>
  );
};
