/**
 * React Query hook for image uploads with caching and error handling.
 * Provides mutation for uploading images to Cloudinary/ImageKit.
 */

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { uploadImage } from "../services/imageService";

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

interface UseImageUploadOptions {
  onSuccess?: (data: UploadResult, variables: File) => void;
  onError?: (error: Error, variables: File) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}): UseMutationResult<UploadResult, Error, File> {
  return useMutation({
    mutationFn: async (file: File) => {
      if (!file) {
        throw new Error("No file provided");
      }

      // Upload with folder structure for products
      return uploadImage(file, {
        folder: "codebook/products",
      });
    },
    onSuccess: (data, variables) => {
      options.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      console.error("Image upload error:", error);

      // Only show error toast if not already shown by component
      // The ImageUpload component handles its own error toasts to avoid duplicates
      options.onError?.(error, variables);
    },
    retry: false, // Don't retry failed uploads
  });
}
