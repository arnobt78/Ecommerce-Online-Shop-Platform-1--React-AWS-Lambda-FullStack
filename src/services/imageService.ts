/**
 * Image Service - Cloudinary/ImageKit Integration
 *
 * Handles image uploads to Cloudinary or ImageKit.
 * Uses unsigned uploads for simplicity (can be secured with a backend
 * endpoint later).
 *
 * @see https://cloudinary.com/documentation/upload_images
 * @see https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload
 */

import { ApiError } from "./apiError";

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dstnkgg1p";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "codebook_products";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ImageKit Configuration (alternative)
const IMAGEKIT_URL_ENDPOINT = (import.meta.env as Record<string, string | undefined>).VITE_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/arnobt78";
const IMAGEKIT_PUBLIC_KEY =
  (import.meta.env as Record<string, string | undefined>).VITE_IMAGEKIT_PUBLIC_KEY || "public_YZnlSVIfQX0AtubHREKqEnnzWSA=";

// Use Cloudinary by default, can be switched to ImageKit
const IMAGE_SERVICE = import.meta.env.VITE_IMAGE_SERVICE || "cloudinary"; // "cloudinary" or "imagekit"

interface UploadOptions {
  folder?: string;
  publicId?: string;
  fileName?: string;
}

interface UploadResult {
  url: string;
  publicId?: string;
  fileId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  size?: number;
}

async function uploadToCloudinary(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  // Add optional parameters (only allowed for unsigned uploads)
  // Note: transformation parameter is NOT allowed in unsigned uploads
  // Transformations should be applied when generating display URLs, not during upload
  if (options.folder) {
    formData.append("folder", options.folder);
  }
  if (options.publicId) {
    formData.append("public_id", options.publicId);
  }

  try {
    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.error?.message || "Failed to upload image to Cloudinary", response.status);
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
      bytes: data.bytes,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

async function uploadToImageKit(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);

  if (options.folder) {
    formData.append("folder", options.folder);
  }
  if (options.fileName) {
    formData.append("fileName", options.fileName);
  }

  try {
    const response = await fetch(`${IMAGEKIT_URL_ENDPOINT}/api/v1/files/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.message || "Failed to upload image to ImageKit", response.status);
    }

    const data = await response.json();
    return {
      url: data.url,
      fileId: data.fileId,
      width: data.width,
      height: data.height,
      size: data.size,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

export async function uploadImage(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  // Validate file
  if (!file) {
    throw new ApiError("No file provided", 400);
  }

  // Validate file type
  const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!validTypes.includes(file.type)) {
    throw new ApiError("Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.", 400);
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new ApiError("File size exceeds 10MB limit. Please upload a smaller image.", 400);
  }

  // Upload based on configured service
  if (IMAGE_SERVICE === "imagekit") {
    return uploadToImageKit(file, options);
  } else {
    return uploadToCloudinary(file, options);
  }
}

// Note: this requires server-side implementation with the Cloudinary API
// secret. For now, returns success (images can be manually deleted from the
// Cloudinary dashboard). A backend endpoint can be added later for secure deletion.
export async function deleteImage(_publicId: string): Promise<{ success: boolean; message: string }> {
  console.warn("Image deletion requires server-side implementation");
  return { success: true, message: "Image deletion requires server-side implementation" };
}

export interface ImageTransformations {
  width?: number;
  height?: number;
  quality?: string;
  crop?: string;
  gravity?: string;
}

// Generate optimized image URL with transformations, e.g.
// getOptimizedImageUrl(url, { width: 400, height: 300, quality: 'auto', crop: 'fill' })
export function getOptimizedImageUrl(imageUrl: string | null | undefined, transformations: ImageTransformations = {}): string {
  if (!imageUrl) return "";

  // If Cloudinary URL
  if (imageUrl.includes("cloudinary.com")) {
    const parts = imageUrl.split("/upload/");
    if (parts.length === 2) {
      const baseUrl = parts[0] + "/upload";
      const imagePath = parts[1];

      // Build transformation string with automatic optimizations
      const transforms: string[] = [];

      // Add automatic format and quality optimization
      transforms.push("f_auto"); // Auto format (WebP when supported)
      transforms.push("q_auto:good"); // Auto quality optimization

      // Add user-specified transformations
      if (transformations.width) transforms.push(`w_${transformations.width}`);
      if (transformations.height) transforms.push(`h_${transformations.height}`);
      if (transformations.quality && transformations.quality !== "auto") {
        // Replace auto quality if specific quality requested
        const autoIndex = transforms.indexOf("q_auto:good");
        if (autoIndex > -1) transforms.splice(autoIndex, 1);
        transforms.push(`q_${transformations.quality}`);
      }
      if (transformations.crop) transforms.push(`c_${transformations.crop}`);
      if (transformations.gravity) transforms.push(`g_${transformations.gravity}`);

      const transformString = transforms.length > 0 ? transforms.join(",") + "/" : "";
      return `${baseUrl}/${transformString}${imagePath}`;
    }
  }

  // If ImageKit URL
  if (imageUrl.includes("imagekit.io")) {
    const url = new URL(imageUrl);
    if (transformations.width) url.searchParams.set("tr", `w-${transformations.width}`);
    if (transformations.height) url.searchParams.set("tr", `h-${transformations.height}`);
    if (transformations.quality) url.searchParams.set("q", transformations.quality);
    return url.toString();
  }

  // Return original URL if not Cloudinary or ImageKit
  return imageUrl;
}
