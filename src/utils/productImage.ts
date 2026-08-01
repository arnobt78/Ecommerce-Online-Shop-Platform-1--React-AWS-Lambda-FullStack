/**
 * Product Image Utility
 *
 * Centralized utility for getting product images with proper priority, cache-busting, and optimization.
 * Ensures consistent image handling across admin and customer-facing pages.
 * Integrates with Cloudinary/ImageKit for automatic image optimization.
 *
 * Priority:
 * 1. image_local (local images in /images/ or Cloudinary URLs)
 * 2. poster (external URLs like Unsplash)
 *
 * Cache-busting: Adds query parameter to local images to prevent browser caching.
 * Optimization: Uses Cloudinary transformations for optimal delivery (auto format, quality).
 */

import { getOptimizedImageUrl, type ImageTransformations } from "../services/imageService";

type ImageSource = {
  image_local?: string | null;
  poster?: string | null;
  updatedAt?: string | null;
  id?: string;
};

export function getProductImageUrl(product: ImageSource | null | undefined, options: ImageTransformations = {}): string | null {
  if (!product) return null;

  let imageUrl: string | null = null;

  // Prefer image_local (local images or Cloudinary URLs) over poster (external URLs)
  if (product.image_local) {
    imageUrl = product.image_local;
  } else if (product.poster) {
    imageUrl = product.poster;
  }

  if (!imageUrl) return null;

  // If it's a Cloudinary URL, apply optimizations
  if (imageUrl.includes("cloudinary.com")) {
    // Apply optimizations with default settings for web delivery
    const optimizationOptions: ImageTransformations = {
      quality: "auto",
      ...options, // Allow override for specific use cases
    };
    return getOptimizedImageUrl(imageUrl, optimizationOptions);
  }

  // If it's an ImageKit URL, apply optimizations
  if (imageUrl.includes("imagekit.io")) {
    return getOptimizedImageUrl(imageUrl, options);
  }

  // For local images, add cache-busting parameter to force browser refresh
  if (imageUrl.startsWith("/") || imageUrl.startsWith("./")) {
    const separator = imageUrl.includes("?") ? "&" : "?";
    const cacheBuster = product.updatedAt || product.id || Date.now();
    return `${imageUrl}${separator}v=${cacheBuster}`;
  }

  // Return external URLs (poster) as-is (they have their own cache control)
  return imageUrl;
}

// Get React key for product image element — forces re-render when image changes.
export function getProductImageKey(product: ImageSource | null | undefined): string {
  if (!product) return "";
  return `${product.id}-${product.image_local || product.poster || ""}-${product.updatedAt || ""}`;
}
