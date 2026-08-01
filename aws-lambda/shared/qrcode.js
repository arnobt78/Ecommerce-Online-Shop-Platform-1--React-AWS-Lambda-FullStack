/**
 * AWS Lambda - QR Code Helper Functions
 *
 * This module provides QR code generation utilities for products.
 * Generates QR codes as base64-encoded PNG images.
 */

const QRCode = require("qrcode");

/**
 * Generate QR code for a product URL
 *
 * @param {string} productUrl - Full URL to the product detail page
 * @returns {Promise<string>} Base64-encoded PNG image data URL
 *
 * Example:
 * const qrCode = await generateProductQRCode("https://codebook-aws.vercel.app/products/abc123");
 * // Returns: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 */
async function generateProductQRCode(productUrl) {
  try {
    if (!productUrl || typeof productUrl !== "string") {
      throw new Error("Product URL is required and must be a string");
    }

    // Generate QR code as base64 data URL
    // Options:
    // - errorCorrectionLevel: 'M' (Medium) - good balance of size and error correction
    // - type: 'image/png' - PNG format
    // - quality: 0.92 - good quality
    // - margin: 1 - small margin for better scanning
    const qrCodeDataUrl = await QRCode.toDataURL(productUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 300, // Size in pixels
      color: {
        dark: "#000000", // Black QR code
        light: "#FFFFFF", // White background
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error("generateProductQRCode error:", {
      message: error.message,
      name: error.name,
      productUrl,
    });
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

module.exports = {
  generateProductQRCode,
};

