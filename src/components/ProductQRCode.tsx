/**
 * ProductQRCode Component
 *
 * Displays a QR code for a product in a responsive ShadCN Card.
 * Includes download functionality.
 * Supports multiple QR code formats:
 * - URL string (stored in DB): Generates QR code client-side from URL (preferred, low cost)
 * - Base64 PNG (legacy): Displays pre-generated QR code image (backward compatibility)
 * - Fallback: Generates QR code from productUrl if qrCode not provided
 *
 * @param {string} [qrCode] - QR code data: URL string (e.g., "http://localhost:3000/products/abc123") or base64 PNG (legacy)
 * @param {string} [productUrl] - Product URL to encode in QR code (fallback if qrCode not provided)
 * @param {string} [productName] - Product name (for download filename)
 * @param {string} [productId] - Product ID (for download filename)
 * @param {string} [className] - Additional CSS classes
 */

import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { Card } from "./ui/card";
import { useState, useMemo, useCallback } from "react";

interface ProductQRCodeProps {
  qrCode?: string | null;
  productUrl?: string | null;
  productName?: string | null;
  productId?: string | null;
  className?: string;
}

/**
 * ProductQRCode Component
 *
 * Displays a QR code for a product in a responsive ShadCN Card.
 * Includes download functionality.
 *
 * QR Code Format Priority:
 * 1. URL string (stored in DB) → Generates QR code client-side (preferred, low cost)
 * 2. Base64 PNG (legacy) → Displays pre-generated image (backward compatibility)
 * 3. Fallback → Generates from productUrl if qrCode not provided
 *
 * Performance optimizations:
 * - Memoized QR code ID generation (useMemo)
 * - Memoized download handler (useCallback)
 * - Proper error handling for download failures
 * - Graceful fallback if QR code generation fails
 * - Client-side generation (no AWS cost, instant display)
 *
 * @param {ProductQRCodeProps} props - Component props
 */
export const ProductQRCode = ({
  qrCode,
  productUrl,
  productName,
  productId,
  className = "",
}: ProductQRCodeProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Generate unique ID for QR code SVG element
  const qrCodeId = useMemo(() => {
    return `qr-code-${
      productId || productName?.replace(/\s+/g, "-") || "product"
    }`;
  }, [productId, productName]);

  // Download QR code as PNG
  // Memoized to prevent unnecessary re-renders
  const handleDownload = useCallback(() => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      if (qrCode) {
        // Check if qrCode is base64 image or URL string
        if (qrCode.startsWith("data:image")) {
          // Download base64 QR code (legacy support)
          const qrData = qrCode;
          if (!qrData) return;

          // Create a temporary anchor element
          const link = document.createElement("a");
          link.href = qrData;
          link.download = `${productName || "product"}-${
            productId || "qr"
          }-code.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else if (qrCode.startsWith("http")) {
          // qrCode is a URL string - generate QR code from URL
          const svg = document.querySelector(`#${qrCodeId}`);
          if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();

            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
              canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${productName || "product"}-${
                  productId || "qr"
                }-code.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              });
            };

            img.src =
              "data:image/svg+xml;base64," +
              btoa(unescape(encodeURIComponent(svgData)));
          }
        }
      } else if (productUrl) {
        // Generate QR code SVG and convert to PNG
        const svg = document.querySelector(`#${qrCodeId}`);
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();

          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${productName || "product"}-${
                productId || "qr"
              }-code.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            });
          };

          img.src =
            "data:image/svg+xml;base64," +
            btoa(unescape(encodeURIComponent(svgData)));
        }
      }
    } catch (error) {
      console.error("Failed to download QR code:", error);
      setDownloadError("Failed to download QR code. Please try again.");
      // Show error toast if available
      const globalToast = (window as unknown as { toast?: { error: (message: string) => void } }).toast;
      if (typeof window !== "undefined" && globalToast) {
        globalToast.error("Failed to download QR code");
      }
    } finally {
      setIsDownloading(false);
    }
  }, [qrCode, productUrl, productName, productId, qrCodeId]);

  // If no QR code and no URL, don't render
  if (!qrCode && !productUrl) {
    return null;
  }

  // Determine what to display:
  // 1. If qrCode is a base64 PNG (starts with "data:image") → display as image
  // 2. If qrCode is a URL string (starts with "http") → generate QR code from URL
  // 3. If qrCode doesn't exist but productUrl does → generate QR code from productUrl
  const isBase64Image = qrCode && qrCode.startsWith("data:image");
  const qrData = isBase64Image ? qrCode : null;
  const urlToEncode =
    qrCode && qrCode.startsWith("http") ? qrCode : productUrl || null;

  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        {/* QR Code Title */}
        <h3 className="text-sm font-medium text-gray-700 dark:text-white">
          Product QR Code
        </h3>

        {/* QR Code Display */}
        <div className="w-full max-w-[200px] sm:max-w-[200px] aspect-square bg-white dark:bg-gray-100 p-2 rounded-lg border border-gray-200 dark:border-gray-300 flex items-center justify-center">
          {qrData ? (
            // Display base64 QR code image (legacy support for existing products)
            <img
              src={qrData}
              alt={`QR code for ${productName || "product"}`}
              className="w-full h-full object-contain"
            />
          ) : urlToEncode ? (
            // Generate QR code from URL (stored in DB or generated from productUrl)
            <QRCodeSVG
              id={qrCodeId}
              value={urlToEncode}
              size={200}
              level="H"
              includeMargin={true}
              className="w-full h-full"
            />
          ) : null}
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Download QR code"
        >
          <Download className="h-4 w-4 mr-2" strokeWidth={2} />
          {isDownloading ? "Downloading..." : "Download QR"}
        </button>

        {/* Error Message */}
        {downloadError && (
          <p className="text-xs text-red-600 dark:text-red-400 text-center mt-1">
            {downloadError}
          </p>
        )}
      </div>
    </Card>
  );
};
