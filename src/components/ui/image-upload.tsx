/**
 * ImageUpload Component
 *
 * Reusable image upload component with drag-and-drop support.
 * Uses react-dropzone for file handling and displays preview.
 * Follows ShadCN UI patterns for consistency.
 */

import { useCallback, useState, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "../../lib/toast";

interface ImageUploadResult {
  url: string;
}

interface ImageUploadProps {
  value?: string;
  onChange?: (value: string) => void;
  onUpload?: (file: File) => Promise<ImageUploadResult | string>;
  disabled?: boolean;
  label?: string;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export function ImageUpload({
  value = "",
  onChange,
  onUpload,
  disabled = false,
  label = "Upload Image",
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB default
  className = "",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || "");

  // Sync preview from the value prop. Necessarily an effect (not a pure
  // render-time derivation) because preview also gets set independently to a
  // local blob URL mid-upload, before the parent's committed value changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local preview from an external value prop, see comment above
    setPreview(value || "");
  }, [value]);

  // Handle file drop/selection
  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection?.errors) {
          rejection.errors.forEach((error) => {
            if (error.code === "file-too-large") {
              toast.error(
                `File is too large. Maximum size is ${(maxSize / 1024 / 1024).toFixed(0)}MB.`,
              );
            } else if (error.code === "file-invalid-type") {
              toast.error("Invalid file type. Please upload an image file.");
            } else {
              toast.error(error.message || "File upload rejected.");
            }
          });
        }
        return;
      }

      // Handle accepted file
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        if (!file) return;

        // Validate image dimensions (optional - can be configured)
        // For now, we'll just create preview

        // Create preview with optimized size for display
        const reader = new FileReader();
        reader.onload = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload file
        if (onUpload) {
          setUploading(true);
          try {
            const result = await onUpload(file);
            const imageUrl = typeof result === "string" ? result : result.url;
            setPreview(imageUrl);
            if (onChange) {
              onChange(imageUrl);
            }
            toast.success("Image uploaded successfully!");
          } catch (error) {
            console.error("Image upload error:", error);
            toast.error(
              error instanceof Error ? error.message : "Failed to upload image. Please try again.",
            );
            // Reset preview on error
            setPreview(value || "");
          } finally {
            setUploading(false);
          }
        } else if (onChange) {
          // If no upload handler, just pass the file
          onChange(file as unknown as string);
        }
      }
    },
    [onUpload, onChange, maxSize, value],
  );

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    maxSize,
    disabled: disabled || uploading,
    multiple: false,
  });

  // Remove image
  const handleRemove = useCallback(() => {
    setPreview("");
    if (onChange) {
      onChange("");
    }
  }, [onChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Preview */}
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-32 w-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Remove image"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Upload Area */}
      {!preview && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }
            ${disabled || uploading ? "opacity-50 cursor-not-allowed" : ""}
            ${uploading ? "pointer-events-none" : ""}
          `}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uploading...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {isDragActive ? (
                  <p>Drop the image here...</p>
                ) : (
                  <>
                    <p className="font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs mt-1">
                      PNG, JPG, GIF, WebP up to{" "}
                      {(maxSize / 1024 / 1024).toFixed(0)}MB
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Change Image Button (when preview exists) */}
      {preview && !disabled && !uploading && (
        <div
          {...getRootProps()}
          className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 cursor-pointer underline"
        >
          <input {...getInputProps()} />
          Change image
        </div>
      )}
    </div>
  );
}
